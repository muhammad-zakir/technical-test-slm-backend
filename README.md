# Mini ERP — Backend

NestJS REST API for a mini ERP invoicing system. Serverless-first (Vercel + Neon), built with a **Modular Monolith** architecture designed for future microservice extraction.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, NestJS 11 |
| Database | PostgreSQL 18 (Neon — serverless) |
| ORM | Prisma 6 |
| Auth | JWT (passport-jwt), bcrypt |
| Validation | class-validator, class-transformer |
| Testing | Jest + ts-jest |
| Deployment | Vercel (serverless functions) |

## Architecture

### Modular Monolith

Each domain is a self-contained NestJS module. No module reaches into another module's internals — communication happens only through injected services. This makes each domain trivially extractable into a standalone microservice:

```
src/
  auth/          → future: Auth Service (NATS/TCP consumer)
  customers/     → future: Customer Service
  invoices/      → future: Invoice Service
  dashboard/     → future: Aggregation/Reporting Service
  prisma/        → @Global() shared DB client
  common/        → shared types, decorators (transport-agnostic)
```

### Service Layer Separation

Controllers handle HTTP only — routing, extracting validated inputs, returning responses. All business logic lives in the service layer. Swapping HTTP transport for a message broker (NATS, RabbitMQ) requires zero changes to the service layer.

The `@CurrentUser()` custom param decorator extracts the authenticated user in a transport-agnostic way, replacing the HTTP-only `@Request()` pattern.

### Security

- JWT tokens signed with `JWT_SECRET` via `ConfigService.getOrThrow` — the app **throws at startup** if the secret is missing; no insecure fallback
- Passwords hashed with bcrypt (saltRounds=10)
- Global `JwtAuthGuard` as `APP_GUARD` — all routes are protected by default; public routes opt out with `@Public()`
- Role self-assignment disabled — `register` always assigns `UserRole.USER`; role changes require a privileged endpoint

### Database Design Decisions

- `InvoiceItem.total` is **not stored** — computed at the service layer as `quantity * unitPrice` to prevent stale derived data
- Revenue aggregation uses a single `$queryRaw` SQL query with `GROUP BY status` instead of loading all invoice records into application memory
- Invoice numbers (`INV-YYYYMMDD-NNNN`) are generated inside a Prisma transaction. In a high-concurrency production system, a PostgreSQL sequence would eliminate the theoretical race condition; a DB-level unique constraint on `invoiceNumber` is already in place as a safety net

## API Reference

All routes are prefixed with `/api`.

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create user account |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user profile |

### Customers

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/customers` | JWT | List with search + pagination |
| POST | `/api/customers` | JWT | Create customer |
| PATCH | `/api/customers/:id` | JWT | Update customer |
| DELETE | `/api/customers/:id` | JWT | Delete customer |

Query params for GET: `search` (filters name OR email), `page` (default: 1), `limit` (default: 20, max: 100).

### Invoices

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/invoices` | JWT | List with filter + pagination |
| POST | `/api/invoices` | JWT | Create invoice with line items |
| GET | `/api/invoices/:id` | JWT | Full invoice detail |
| PATCH | `/api/invoices/:id/status` | JWT | Update status |

Query params for GET: `status` (DRAFT/SENT/PAID/OVERDUE), `customerId`, `page`, `limit`.

Invoice creation is **transactional** — the invoice and all line items are created atomically, or nothing is created.

### Dashboard

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/dashboard/summary` | JWT | Revenue, pending, counts, recent invoices |

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | API and DB connectivity check |

## Getting Started

### Prerequisites

- Node.js 22+
- A PostgreSQL database (Neon recommended, or local via Docker Compose)

### Local Development

```bash
git clone git@github.com:muhammad-zakir/technical-test-slm-backend.git
cd technical-test-slm-backend
npm install
cp .env.example .env
# Fill in DATABASE_URL and JWT_SECRET in .env
npx prisma migrate deploy
npm run start:dev
```

API available at `http://localhost:3000/api`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens (min 32 chars recommended) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS (e.g. `http://localhost:3001`) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | `production` enables Vercel serverless handler |

## Testing

```bash
npm test           # run all unit tests
npm run test:cov   # with coverage report
```

Test coverage targets the non-trivial business logic only:

- `AuthService` — password hashing, conflict detection, credential validation, role enforcement
- `InvoicesService` — sequential invoice number generation, transaction item creation, not-found handling
- `DashboardService` — revenue aggregation isolation (PAID vs SENT/OVERDUE), zero-state handling

Controllers, DTOs, and pure Prisma wrappers are intentionally not unit tested — they have no logic to assert beyond what the framework and ORM already guarantee.

## Docker

```bash
# Start Postgres + backend (creates the shared Docker network)
docker compose up -d

# View logs
docker compose logs -f backend
```

The backend `docker-compose.yml` defines the `mini-erp-network` bridge network. The frontend compose file joins it as `external: true`, allowing the frontend container to reach the backend by service name (`http://backend:3000`).

## Deployment (Vercel)

`vercel.json` configures all routes to the NestJS serverless handler. `main.ts` exports a Vercel-compatible default function and also runs a standard `bootstrap()` for local development.

```bash
vercel deploy --prod
```

Set all required environment variables in the Vercel dashboard before deploying.

## Project Structure

```
src/
  auth/
    dto/                           validated input shapes
    auth.controller.ts
    auth.service.ts                business logic
    jwt.strategy.ts                Passport JWT strategy
    jwt-auth.guard.ts              global guard with @Public() opt-out
    public.decorator.ts
  common/
    decorators/
      current-user.decorator.ts   transport-agnostic user extraction
    types/
      authenticated-request.interface.ts
  customers/
    dto/
    customers.controller.ts
    customers.service.ts
  invoices/
    dto/
    invoices.controller.ts
    invoices.service.ts
  dashboard/
    dashboard.controller.ts
    dashboard.service.ts
  prisma/
    prisma.module.ts               @Global() module
    prisma.service.ts              PrismaClient wrapper
  main.ts                          local bootstrap + Vercel handler
  app.module.ts                    root module, wires all features + APP_GUARD
```
