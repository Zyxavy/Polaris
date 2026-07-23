# Disaster Recovery

**Project:** *Paragon*

**Document type:** Operational runbook -- backup procedures and recovery paths for each stateful component in the stack. Companion to the [Tech Stack ADR](../ADRs/001-tech-stack-adr.md) (owns why each storage layer was chosen) and the [D1 Schema](../ADRs/002-d1-schema.md) / [MongoDB Schema](../ADRs/003-mongodb-schema.md) (own the shape of what's being backed up). This document owns backup cadence, storage destination, and step-by-step recovery procedures -- not schema, not architecture rationale.

**Status:** Draft -- v1 scope

**Implementation status:** Planned / Target Architecture

**Last updated:** July 2, 2026

---

## 0. Scope and Approach

Three stateful components exist in this stack: **D1** (Systems, Instances, Schedules, Workspaces, Reviews, Templates, Attachments pointers, Auth), **R2** (attachment files), and **MongoDB Atlas** (journal entries only). Each gets its own section below with the same shape: what the actual risk is, what the recovery procedure is (if any), and why.

This is a runbook for personal app. Consistent with the proportionality principle already applied throughout this project ([cicd-deploy.md](cicd-deploy.md) S6's manual rollback philosophy, [security-review.md](security-review.md) S0's "checked, risk accepted" framing) -- every procedure here is sized to the actual blast radius of losing that specific component's data, not a generic "backup everything maximally" default.

---

## 1. D1 -- No Point-in-Time Recovery on the Free Tier

**The risk:** Cloudflare D1's free tier does not include point-in-time recovery (that's a paid-plan feature). D1 holds the core of the app -- Systems, Instances, Schedules, Reviews, Templates, and the auth tables (Better Auth-managed). A bad migration, an accidental destructive query run by hand, or a Cloudflare-side incident affecting the database has no automatic undo.

### 1.1 Backup procedure -- manual, periodic export to R2

**Cadence:** run before any migration you're not fully confident in, and roughly weekly otherwise. This is a manual safety net, not an automated pipeline.

**Why not automated:** `wrangler d1 export` is a CLI command, not something callable from a Workers binding -- you can't add it to the existing nightly Cron trigger. The two automation paths are both disproportionate for v1: a GitHub Actions scheduled workflow (needs its own secret, workflow file, and maintenance surface for a non-critical safety net), or calling D1's HTTP API from inside the existing scheduled Cron handler (adds real code surface to the one Cron job that exists purely for Instance pre-generation per ADR 001 S5.8). Neither is worth it for when "run one command before risky operations" is sufficient.

**Command:**

```bash
wrangler d1 export paragon-db --remote --output=backups/paragon-db-$(date -I).sql
wrangler r2 object put paragon-backups/$(date -I).sql --file=backups/paragon-db-$(date -I).sql
rm backups/paragon-db-$(date -I).sql   # don't keep local copies lying around after upload
```

This exports the full D1 database as a `.sql` file and uploads it into a dedicated R2 bucket (`paragon-backups` -- create this once via `wrangler r2 bucket create paragon-backups`, separate from the `paragon-attachments` bucket per ADR 001 S5.7, so backup retention/cleanup never risks touching live attachment data).

**Why R2, not git:** R2 is already in the stack (zero egress fees on the Cloudflare side, ADR 001 S5.7), and a D1 export contains real user data (journal entry pointers, System blueprints, freeform text) that shouldn't end up in git history -- even a private repo's history is a worse home for that than an object store with no public exposure.

**No automated rotation.** Old backup files accumulate in `paragon-backups` until manually deleted. At personal-app scale and weekly-ish cadence, this is a handful of small `.sql` files a year -- negligible against R2's free-tier storage ceiling (10 GB, ADR 001 S5.7). Clean up manually when you notice it; not worth scripting for v1.

### 1.2 Recovery path 1 (default): corrective forward migration

If a migration is bad but the database is still queryable (e.g. a migration applied cleanly but produced wrong data, or a `CHECK` constraint is too strict), the correct fix is a **new, forward-only migration** that corrects the problem -- never editing or reverting an already-applied migration file. This is already the stated philosophy in [cicd-deploy.md](cicd-deploy.md) S6.3 ("a broken migration is fixed by writing a corrective one, not by reverting history") and matches the append-only migration convention in [D1 Schema](../ADRs/002-d1-schema.md) S6.2. Nothing new here -- this document just restates it as the *default* recovery path, to be tried before S1.3 below, not instead of it.

### 1.3 Recovery path 2 (last resort): restore from backup -- **this is a data-loss event**

If the database is genuinely broken (a destructive query ran against production, a migration corrupted data in a way no corrective migration can cleanly fix), the only remaining path is restoring from the most recent S1.1 export:

```bash
wrangler r2 object get paragon-backups/<date>.sql --file=restore.sql
wrangler d1 execute paragon-db --remote --file=restore.sql
```

**Be explicit with yourself about what this costs:** everything written to D1 *after* the backup's timestamp is gone -- every Instance marked, every Review submitted, every System edited since that export. This is why S1.1's cadence matters: a weekly-ish backup means a worst-case restore loses up to a week of data. If this ever feels too risky for how the app is actually being used, the fix is backing up more often, not building more infrastructure -- the command above works the same whether it's run weekly or daily.

**Before restoring:** take one more `wrangler d1 export --remote` of the *current* (broken) state first, even though it's broken -- if the restore doesn't fully fix things, having the broken snapshot preserved is cheap insurance and costs one extra command.

---

## 2. R2 -- Durable by Default, No Action Needed

**The risk:** loss of uploaded attachments (source PDFs, form-check photos -- PRD S5.5).

**Status: checked, no additional backup procedure required for v1.**

R2 provides the same durability guarantee as S3-standard object storage (eleven nines) at the platform level -- this is Cloudflare's baseline, not something this app configures or verifies itself. Combined with the fact that attachments are user-uploaded files that, in the realistic worst case, could simply be re-uploaded if somehow lost, there's no proportional reason to add a backup procedure on top of R2's own durability.

**Versioning** (keeping prior versions of an object on overwrite/delete) is available as an R2 bucket-level configuration toggle, but bills per stored version and isn't justified at current attachment volume. Noted here as a **future consideration** if attachment usage grows significantly -- not a v1 gap.

---

## 3. MongoDB Atlas -- Accepted Risk, No Backup in v1

**The risk:** loss of `journal_entries` documents (Log/Journal widget freeform text -- [MongoDB Schema](../ADRs/003-mongodb-schema.md) S3).

**Status: accepted risk, no backup in v1.**

Atlas's free tier (M0) does not include continuous backup or point-in-time recovery -- that's an M10+ paid-tier feature, and running a paid Atlas tier purely for backup coverage of one non-critical feature isn't proportional (consistent with ADR 001 S5.5's own framing of Mongo as "one bounded, document-shaped feature," not core data).

This matches the "accepted orphan" precedent already established elsewhere in this stack -- R2 orphaned objects (ADR 001 S5.7), D1's soft-referenced `widget_entries`/`counter_logs`/`timer_sessions` rows (D1 Schema S3.3.1), and Mongo's own orphaned-on-System-hard-delete documents ([MongoDB Schema](../ADRs/003-mongodb-schema.md) S7). Journal entries are reflection text the user wrote for themselves -- losing them is a mild inconvenience, not a data disaster, and is qualitatively different from losing a System's blueprint or Instance history, which live in D1 and *are* covered by S1 above.

**Appendix -- if you want a manual backup anyway:** `mongodump` works against the Atlas connection string and can be run the same way as the D1 export in S1.1, uploaded to the same `paragon-backups` R2 bucket if desired:

```bash
mongodump --uri="$MONGODB_URI" --out=backups/mongo-$(date -I)
wrangler r2 object put paragon-backups/mongo-$(date -I).tar.gz --file=<tarball of the above>
```

This is explicitly **not part of v1's backup posture** -- it's documented here only so the option is easy to reach for later if journal entries ever become more valuable than they are today (e.g. if the widget gains features that make entries less trivially replaceable).

---

## 4. Summary Table

| Component | Backup exists? | Cadence | Destination | Recovery cost if worst case happens |
|---|---|---|---|---|
| **D1** | Yes | Manual, weekly-ish + before risky migrations | R2 (`paragon-backups` bucket) | Data loss back to last export's timestamp |
| **R2** (attachments) | No -- platform durability only | N/A | N/A | Effectively none (11 nines durability); re-upload if truly lost |
| **MongoDB** (journal entries) | No -- accepted risk | N/A (manual `mongodump` documented as optional) | N/A | Full loss of journal text; no core app data affected |

---

## 5. Review Cadence

Re-visit this document if: D1 usage grows enough that a week of potential data loss (S1.3) feels unacceptable (tighten the export cadence, or reconsider automating it), Atlas is ever upgraded past M0 for other reasons (re-evaluate whether Mongo backup should move from "accepted risk" to "covered"), or R2 attachment volume grows enough that versioning (S2) becomes worth its per-version cost.
