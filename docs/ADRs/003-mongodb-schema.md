# MongoDB Schema

**Project:** *Polaris*
**Document type:** Database schema ADR for the one bounded, document-shaped feature in the stack -- companion to the [D1 Schema](002-d1-schema.md) (owns the `widget_entries` pointer row this document's collection is referenced from) and the [Tech Stack ADR](001-tech-stack-adr.md) S5.5 (owns the decision to use MongoDB at all, and the failure-mode/retry strategy via Cloudflare Queues). This document owns the collection shape, field-level meaning, indexes, versioning, and retention for `journal_entries` -- nothing else lives in MongoDB.
**Status:** Draft -- v1 scope
**Last updated:** July 2, 2026

---

## 1. Scope

MongoDB holds exactly one collection: **`journal_entries`**, backing the Log/Journal widget's freeform entries (PRD S5.5, ADR 001 S5.5: "one genuinely document-shaped feature -- free-form journal / reflection entries, and nothing else"). No other widget type, no other data, lives here. If a future widget type turns out to need document-shaped storage, that is a new ADR decision, not a default extension of this collection (PRD S10).

This document does not own:

- **Why MongoDB was chosen**, the write-failure/retry design via Cloudflare Queues, or the cold-start/connection-pooling tradeoff -- all owned by ADR 001 S5.5.
- **The D1-side pointer row** (`widget_entries` with `entry_type = 'log_meta'`) -- owned by D1 Schema S3.3.1. This document owns only what's on the other end of that pointer.
- **Better Auth's tables** -- irrelevant here; auth never touches Mongo.

---

## 2. The D1 <-> Mongo Seam

Per D1 Schema S3.3.1, a `widget_entries` row with `entry_type = 'log_meta'` does **not** hold the journal text itself. It holds a small JSON pointer:

```json
{ "mongo_id": "64f1a2b3c4d5e6f7a8b9c0d1" }
```

`mongo_id` is the string form of the `journal_entries` document's `_id` (a Mongo `ObjectId`). This is the entire seam: D1 knows *that* a journal entry exists and which instance it belongs to; Mongo knows what the entry actually says. Nothing else crosses this boundary.

**Why the pointer isn't reversed** (i.e. why Mongo doesn't hold a `d1_widget_entry_id` instead): the `widget_entries` row is what the Dashboard's `workspace_snapshot` read cache resolves against (D1 Schema S3.3.1) -- D1 needs to know Mongo exists, but Mongo never needs to look anything up in D1. Denormalizing D1's `system_id`/`instance_id`/`widget_id`/`user_id` directly onto the Mongo document (S3.2 below) is what makes this one-directional -- a Mongo-native query never needs to round-trip to D1 first.

---

## 3. Collection: `journal_entries`

### 3.1 Document shape

```javascript
db.createCollection("journal_entries", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["system_id", "instance_id", "widget_id", "user_id", "text", "schema_version", "created_at", "updated_at"],
      properties: {
        system_id:      { bsonType: "string", description: "D1 systems.id (UUID) -- denormalized, see S3.2" },
        instance_id:    { bsonType: "string", description: "D1 instances.id (UUID) -- denormalized" },
        widget_id:      { bsonType: "string", description: "soft-reference into workspaces.layout JSON, same non-FK pattern as D1's widget_entries.widget_id" },
        user_id:        { bsonType: "string", description: "Better Auth user.id (UUID) -- denormalized" },
        text:           { bsonType: "string", description: "the freeform journal content -- no structured sub-fields, see S3.2" },
        schema_version: { bsonType: "int", description: "document shape version, see S5" },
        created_at:     { bsonType: "date" },
        updated_at:     { bsonType: "date" }
      }
    }
  }
})
```

**Example document:**

```json
{
  "_id": ObjectId("64f1a2b3c4d5e6f7a8b9c0d1"),
  "system_id": "sys_a1b2c3",
  "instance_id": "inst_d4e5f6",
  "widget_id": "w_journal1",
  "user_id": "usr_g7h8i9",
  "text": "Finished chapter 3. Slower going than expected but the concept finally clicked once I re-read the diagram.",
  "schema_version": 1,
  "created_at": ISODate("2026-07-01T13:45:00.000Z"),
  "updated_at": ISODate("2026-07-01T13:45:00.000Z")
}
```

### 3.2 Field notes

- **`text` is the only content field, deliberately.** No tags, mood/rating, or attachment references. This is a direct consequence of ADR 001 S5.5's own reasoning for why Mongo exists at all: a D1 `TEXT` column felt wrong for potentially long freeform entries. Adding structured fields here would undercut that reasoning and start turning this into a second relational table with extra steps. If structured metadata about a journal entry is ever wanted, that's a new field added deliberately (and a `schema_version` bump, S5) -- not a default.
- **`system_id`, `instance_id`, `widget_id`, `user_id` are all denormalized**, not looked up via a join back to D1 (Mongo has none). This is a conscious normalization tradeoff: the storage cost of four small UUID strings per document is negligible at personal-app scale, and it means every Mongo-native query (S4) resolves without a round-trip to D1 first.
- **`widget_id` is a soft-reference**, matching the exact same non-FK pattern D1 already uses for `widget_entries.widget_id` and `counter_logs.widget_id` (D1 Schema S3.3.1) -- widgets live inside the `layout` JSON blob on `workspaces`, not as their own rows anywhere, so there is nothing to formally reference in either database. If a widget is removed from the layout, its Mongo documents become orphaned data, not a referential-integrity violation -- same accepted tradeoff as D1's orphan handling.
- **No `notes`, `title`, or free second field.** One entry = one `text` blob = one document. If the Log/Journal widget ever needs multiple sub-entries per instance, that's still just multiple documents (one instance can have many journal entries), not a schema change to this document.

---

## 4. Indexes

```javascript
db.journal_entries.createIndex({ system_id: 1, created_at: -1 });
db.journal_entries.createIndex({ instance_id: 1 });
```

| Index | Backs |
|---|---|
| `{system_id: 1, created_at: -1}` | System detail / Workspace view: "all journal entries for this system, most recent first." The compound shape lets Mongo satisfy both the filter and the sort from the same index without an in-memory sort stage. |
| `{instance_id: 1}` | Dashboard drill-in: "the journal entry (or entries) logged against this specific instance." |

**No text index / Atlas Search in v1.** Full-text search over entry content is a real future feature but is explicitly out of scope here -- it requires enabling Atlas Search, which is extra Atlas-side configuration and a separate free-tier ceiling to verify, neither of which is justified by a v1 feature nobody's asked for yet. See S9.

---

## 5. Versioning

Every document carries `schema_version: 1` (an integer, not a string, matching D1's `layout.v` convention in D1 Schema S3.4 but without the accompanying upgrade-chain infrastructure -- that machinery isn't justified yet for a single-field, unlikely-to-change document shape).

**The rule going forward:** if the document shape ever changes (a field renamed, added, or restructured), bump `schema_version` for all *newly written* documents and handle old-shape documents with upgrade-on-read logic in the API's Mongo read path -- same philosophy as D1's `upgradeLayout()`, just without a dedicated versioned-file-per-bump convention, since one field changing every few years doesn't warrant that ceremony yet. If this collection ever grows enough fields that upgrade logic becomes nontrivial, promoting it to D1's full versioning discipline (ADR 001 S5.4) is the right move at that point, not before.

---

## 6. Write Path (reference only)

The write path, retry strategy, and failure handling are fully specified in ADR 001 S5.5 and are not repeated here. Summary for context only:

1. Hono Worker attempts a direct MongoDB write on journal entry save.
2. Success -> `200`, done.
3. Failure -> entry payload enqueued to `polaris-journal-retry` (Cloudflare Queue), Worker returns `202 Accepted`, entry shows optimistically in the UI.
4. A Queue consumer retries the write with exponential backoff; persistent failure goes to the dead-letter queue for manual inspection.

**One document-shape implication worth noting here:** the queued retry payload must be the *complete* document (including `schema_version`, denormalized IDs, and timestamps) as originally constructed, not just a partial diff -- because the consumer performs the same insert the direct path would have, with no D1 round-trip available to reconstruct missing fields at retry time.

---

## 7. Retention and Deletion

D1 Schema S4 hard-deletes archived Systems (and everything FK-cascaded beneath them) 30 days after archiving. **Mongo documents are not part of that cascade** -- Mongo has no foreign keys, and nothing in the nightly Cron job currently issues a corresponding Mongo delete.

**v1 behavior: orphaned documents are accepted, matching the precedent already set for R2 (ADR 001 S5.7) and D1's own `widget_entries`/`counter_logs`/`timer_sessions` soft-references (D1 Schema S3.3.1).** When a System is hard-deleted in D1, its `journal_entries` documents remain in Mongo indefinitely, now unreachable from the app (their `system_id` no longer resolves to anything). At personal-app scale, this is negligible storage cost, consistent with every other "accepted orphan" decision already made across this stack.

**Options considered and deferred, not chosen:**

- **Cron cleanup step** -- the same nightly Cron job that hard-deletes archived Systems could also issue `db.journal_entries.deleteMany({ system_id: { $in: [...] } })` for the batch of Systems it's about to delete. Straightforward to add later; not worth the complexity for v1 given the orphan cost is already accepted elsewhere.
- **TTL index** (`created_at` + `expireAfterSeconds`) -- rejected. A TTL tied to `created_at` would delete journal entries on a fixed clock unrelated to whether their parent System is even archived yet, which could delete entries for still-active systems. The System's actual lifecycle (active -> archived -> 30-day window -> hard-delete) has no clean mapping onto a single TTL value, so this would need to be paired with application logic anyway -- at which point it's simpler to just do the Cron cleanup step above instead of maintaining a TTL index alongside it.

If orphan volume ever becomes a real problem (unlikely at this scale), the Cron cleanup step is the first thing to add -- not a TTL index.

---

## 8. Local Development

Miniflare does not emulate MongoDB (Testing Strategy S3.2, S4) -- local development against journal-entry features needs a real local Mongo instance running alongside `wrangler dev`.

**Getting a local Mongo running:**

```bash
docker run -d -p 27017:27017 --name polaris-mongo-dev mongo:7
```

**Connection string convention**, consistent with `reference/cicd-deploy.md` S2.1's `MONGODB_URI` entry:

| Environment | `MONGODB_URI` |
|---|---|
| Local dev | `mongodb://localhost:27017/polaris` |
| Production | Atlas cluster connection string, set via `wrangler secret put MONGODB_URI` |

The local dev database needs no manual schema setup -- MongoDB creates the collection and applies the validator (S3.1) on first write if the collection doesn't already exist, or the validator can be applied once manually via `mongosh` against `mongodb://localhost:27017/polaris` using the `createCollection` call in S3.1.

**Assumption for anyone working on journal-entry features locally:** the local Mongo container (or an equivalent local instance) must already be running before `wrangler dev` is started in `packages/api` -- there is no automatic startup wiring between the two in v1. If the container isn't running, journal-entry writes fail closed into the Cloudflare Queues retry path (S6) during local dev exactly as they would in production against a genuinely unreachable Atlas cluster -- which is a reasonable way to exercise that failure path locally, incidentally, but isn't a substitute for actually having Mongo up when testing the happy path.

---

## 9. Future Considerations (not v1 scope)

- **Full-text search over `text`** via Atlas Search -- would need its own index definition, a check against Atlas Search's free-tier limits, and likely its own short ADR given the added operational surface. Not built until there's an actual user-facing need (e.g. "search my journal entries").
- **Cron-driven orphan cleanup** (S7) -- straightforward addition once/if orphan volume is ever worth caring about.
- **Structured sub-fields on `text`** (mood, tags) -- deliberately deferred per S3.2; would need its own product decision (PRD-level, not schema-level) before landing here.

---

## 10. Summary

| Collection | Row growth driver | Managed by |
|---|---|---|
| `journal_entries` | 1 per Log/Journal widget entry saved | This document |

The only MongoDB collection in the stack. Everything else -- Systems, Instances, Schedules, Workspaces, Reviews, Templates, Attachments, Counter/Timer/Checklist widget data -- lives in D1 per D1 Schema S1.1 and ADR 001 S5.4/S5.5.
