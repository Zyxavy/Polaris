# Polaris: Navigate by the Fixed Star

Build systems that survive your worst days. Define your floor. Log daily. Review weekly.

A personal systems design web app. The unit of the product is the *system*: a defined protocol with a floor action, a schedule, a dedicated workspace, and a recurring review loop that feeds changes back into the design.

---

## Tech Stack

- **Frontend:** SvelteKit (CSR/SPA) + Tailwind CSS
- **Backend:** Hono (TypeScript) on Cloudflare Workers
- **Database:** Cloudflare D1 (primary) + MongoDB Atlas (journal/reflections only)
- **Storage:** Cloudflare R2
- **Auth:** Better Auth (self-hosted on D1)
- **AI:** Workers AI (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`)
- **Scheduling:** Cloudflare Cron Triggers
- **Monorepo:** pnpm workspaces

## Documentation

- [Product Requirements Document](docs/PRD/PRD-systems-app.md): feature scope, data model, user flows
- [Tech Stack ADR](docs/ADRs/001-tech-stack-adr.md): architecture decisions, component roles, rationale
- [Testing Strategy](docs/ADRs/002-testing-strategy.md): testing layers, tooling, CI pipeline
- [AI Workers Reference](docs/ADRs/003-cloudflare-ai-workers.md): AI feature design, prompt management, free-tier analysis
- [Systems Framework](docs/core/systems-framework.md): the five-step system-build process that informs the product
- [Research Insights](docs/core/insights.md): product-specific synthesis of systems-thinking literature
- [Sources](docs/core/sources.md): transcripts and summaries of source material
