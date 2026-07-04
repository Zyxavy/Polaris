# Polaris API

Hono Worker deployed on Cloudflare Workers. Part of the Polaris pnpm monorepo.

**Implementation status:** Current

## Quick Start

From the repo root:

```bash
pnpm install
cd packages/api && pnpm run dev      # starts wrangler dev
```

Or from the API package directory directly:

```bash
pnpm run dev
```

## Available Scripts

| Command | Does |
|---|---|
| `pnpm run dev` | Start local dev server (wrangler dev) |
| `pnpm run deploy` | Apply D1 migrations then deploy to Cloudflare |
| `pnpm run cf-typegen` | Generate `CloudflareBindings` types from wrangler.jsonc |

## Configuration

Wrangler config: `wrangler.jsonc` — declares D1 (`DB`) and R2 (`ATTACHMENTS`) bindings plus production environment overrides.

## Documentation

Full architecture, schema, and route design docs live in the root `docs/` directory:

- [Tech Stack ADR](../../docs/ADRs/001-tech-stack-adr.md)
- [D1 Schema](../../docs/ADRs/002-d1-schema.md)
- [API Route Design](../../docs/reference/api-routes.md)
- [Auth Integration](../../docs/reference/auth-integration.md)
