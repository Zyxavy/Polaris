# Changelog

## [Unreleased]

### Slice 0 — Repo & Cloud Bootstrap

- Provisioned D1 databases: `polaris-db-dev`, `polaris-db`
- Provisioned R2 buckets: `polaris-attachments`, `polaris-backups`
- Provisioned Queue: `polaris-journal-retry`
- Created MongoDB Atlas cluster: `PolarisCluster`

### Slice 1 — Monorepo Scaffolding (WIP)

- Initialized pnpm workspace at root
- Scaffolded `packages/api` with Hono + wrangler via `pnpm create hono`
- **Note:** Cloudflare Workers now use `wrangler.jsonc` (JSONC format) instead of `wrangler.toml`. The plan references `.toml` syntax, but all binding configs have been adapted to the JSONC equivalent.
