# Polaris

Build systems that survive your worst days. Define your floor. Log daily. Review weekly.

A personal systems design web app. The unit of the product is the *system*: a defined protocol with a floor action, a schedule, a dedicated workspace, and a recurring review loop that feeds changes back into the design.

**Implementation status:** Current

---

## Tech Stack (Current)

| Layer | Choice | Status |
|---|---|---|
| Frontend | SvelteKit (CSR/SPA) + Tailwind CSS | Active |
| Backend API | Hono (TypeScript) on Cloudflare Workers | Active (auth + systems CRUD) |
| Primary database | Cloudflare D1 (SQLite) | Configured (binding exists) |
| File storage | Cloudflare R2 | Configured (binding exists) |
| Auth | Better Auth (self-hosted on D1) | Active |
| Monorepo | pnpm workspaces | Active |

## Tech Stack (Planned)

| Layer | Choice | Status |
|---|---|---|
| Secondary database | MongoDB Atlas (journal/reflections only) | Design complete, not yet implemented |
| AI | Workers AI (`@cf/deepseek-ai/deepseek-r1-distill-qwen-32b`) | Design complete, not yet implemented |
| Scheduling | Cloudflare Cron Triggers | Design complete, not yet implemented |
| Message queue | Cloudflare Queues | Design complete, not yet implemented |

## Documentation

### Current

- [AGENTS.md](AGENTS.md): coding conventions and tooling
- [Implementation Plan](docs/plans/implementation-plan-p0.md): P0 feature build plan

### Reference Documentation

- [Product Requirements Document](docs/PRD/PRD-systems-app.md)
- [Tech Stack ADR](docs/ADRs/001-tech-stack-adr.md)
- [D1 Schema](docs/ADRs/002-d1-schema.md)
- [MongoDB Schema](docs/ADRs/003-mongodb-schema.md)
- [API Route Design](docs/reference/api-routes.md)
- [Auth Integration](docs/reference/auth-integration.md)
- [SvelteKit Route Architecture](docs/reference/sveltekit-route-architecture.md)
- [AI Workers Reference](docs/reference/ai-workers.md)
- [Security Review](docs/reference/security-review.md)
- [CI/CD & Deployment](docs/reference/cicd-deploy.md)
- [Testing Strategy](docs/reference/testing-strategy.md)
- [Observability](docs/reference/observability.md)
- [Disaster Recovery](docs/reference/disaster-recovery.md)
- [Definition of Done](docs/reference/definition-of-done.md)
- [Systems Framework](docs/core/systems-framework.md)
- [Research Insights](docs/core/insights.md)
- [Sources](docs/core/sources.md)
