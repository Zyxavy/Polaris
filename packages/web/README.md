# Polaris Web

SvelteKit SPA (CSR only, SSR disabled) deployed as Workers Static Assets on Cloudflare. Part of the Polaris pnpm monorepo.

**Implementation status:** Current

## Quick Start

From the repo root:

```bash
pnpm install
cd packages/web && pnpm run dev    # starts Vite dev server
```

## Available Scripts

| Command | Does |
|---|---|
| `pnpm run dev` | Start Vite dev server (port 5173) |
| `pnpm run build` | SvelteKit sync + Vite production build |
| `pnpm run deploy` | Build + wrangler deploy |
| `pnpm run check` | SvelteKit sync + svelte-check type-check |
| `pnpm run test:unit` | Vitest unit tests |
| `pnpm run test:e2e` | Playwright E2E tests |

## Configuration

Wrangler config: `wrangler.jsonc` — deploys `build/` directory as Workers Static Assets with SPA fallback.

## Documentation

Full route architecture, auth integration, and frontend conventions live in the root `docs/` directory:

- [SvelteKit Route Architecture](../../docs/reference/sveltekit-route-architecture.md)
- [Auth Integration](../../docs/reference/auth-integration.md)
- [CI/CD & Deployment](../../docs/reference/cicd-deploy.md)
- [Testing Strategy](../../docs/reference/testing-strategy.md)
