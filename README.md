# Tanseek P4 - Backend

Timetable, Room & Lab Allocation System - Node.js/Express/PostgreSQL Backend

## Quick Start

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# 3. Create database and run schema + seed
# Requires PostgreSQL 15+
createdb tanseek
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/seed.sql

# 4. Start development server
npm run dev
# Server runs on http://localhost:5000
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string: `postgres://user:pass@host:port/db` |
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` (default: development) |
| `JWT_SECRET` | Yes (prod) | Long random string for JWT signing. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | No | JWT expiry (default: 12h) |
| `FRONTEND_URL` | No | Comma-separated CORS origins (default: http://localhost:5173) |
| `SUPER_ADMIN_EMAIL` | Yes | Must be `engramzy9@gmail.com` (per schema constraint) |
| `SUPER_ADMIN_PASSWORD` | Yes | Super Admin password (8+ chars, upper/lower/digit/symbol) |
| `DEV_EXPOSE_OTP` | No | `true` in dev to return OTP in response (default: true outside production). **Must be false in production.** |

## Database

- **Schema:** `database/schema.sql` - Run once on fresh database
- **Seed:** `database/seed.sql` - Synthetic data for development (20 rooms, 15 staff, 25 sections, 50 student groups)
- **Constraint Cases:** `database/constraint_cases.json` - 10 official test scenarios

The backend does **not** run migrations automatically. Apply schema/seed manually.

## Authentication

- **JWT** Bearer tokens in `Authorization: Bearer <token>` header
- **Super Admin** (`engramzy9@gmail.com`): Never requires OTP, password still verified via bcrypt
- **Other roles**: Require OTP challenge on first login from new device
- **Trusted Device**: 30-day device token via `X-Device-Token` header skips OTP
- **Password Policy**: 8+ chars, upper, lower, digit, symbol

## API Endpoints

All endpoints under `/api/v1`. See [API.md](../API.md) for full contract.

| Method | Path | Auth | Roles |
|--------|------|------|-------|
| GET | `/health` | None | — |
| POST | `/auth/login` | None | — |
| POST | `/auth/verify-otp` | None | — |
| GET | `/auth/me` | JWT | Any |
| POST | `/auth/admin-create-account` | JWT | SUPER_ADMIN, ADMIN |
| GET | `/departments` | JWT | Any |
| GET | `/terms`, `/terms/active` | JWT | Any |
| GET | `/rooms`, `/rooms/:id` | JWT | Any |
| POST | `/rooms` | JWT | ADMIN, LAB_MANAGER |
| GET | `/staff`, `/staff/:id/availability` | JWT | Any |
| GET | `/courses`, `/courses/:id`, `/courses/:id/requirements` | JWT | Any |
| POST | `/courses` | JWT | ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER |
| GET | `/sections`, `/sections/:id`, `/sections/:id/instructors` | JWT | Any |
| POST | `/sections` | JWT | ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER |
| GET | `/student-groups` | JWT | Any |
| POST | `/student-groups` | JWT | ADMIN, DEPARTMENT_COORDINATOR, SCHEDULER |
| GET | `/timeslots` | JWT | Any |
| GET | `/schedule-versions`, `/schedule-versions/:id`, `/schedule-versions/:id/validate` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA |
| GET | `/schedule-versions/published` | JWT | Any |
| POST | `/schedule-versions` | JWT | ADMIN, SCHEDULER |
| POST | `/schedule-versions/:id/publish` | JWT | ADMIN, SCHEDULER |
| GET | `/allocations?versionId=` | JWT | Any (STUDENT: PUBLISHED only) |
| POST | `/allocations/check-conflicts`, `/allocations/recommend` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR |
| POST | `/allocations` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR |
| PATCH | `/allocations/:id` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR |
| DELETE | `/allocations/:id` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR |
| GET | `/dashboard/summary` | JWT | ADMIN, SCHEDULER, DEPARTMENT_COORDINATOR, LAB_MANAGER, LECTURER, TA |
| GET | `/calendar/export.ics` | JWT | Any (PUBLISHED only) |

## Testing

```bash
# Unit tests (21 tests, no DB required)
npm test

# Integration tests (require DATABASE_URL)
npm run test:integration
```

## Architecture

```
routes/  →  controllers/  →  services/  →  repositories/  →  db/pool.js (pg)
                                    ↑
                               domain/ (pure: conflictEngine, recommendationEngine, time)
middleware/  (authenticate → authorize → validators → asyncHandler → errorHandler)
```

- **pg** connection pool with `withTransaction()` helper
- **No ORM** - parameterized SQL against authoritative schema
- **Consistent response envelope**: `{ success, data }` / `{ success, message, errors?, conflicts? }`

## Key Features

- **Conflict Engine**: 12 hard conflict types, deterministic, unit-tested (21/21 passing)
- **Recommendation Engine**: Feasible alternatives ranked by capacity fit, equipment match, room type, compactness
- **Schedule Versioning**: Draft → Validate → Publish (archives previous) workflow
- **Audit Logging**: All mutations logged with actor, action, entity, outcome
- **ICS Export**: RFC5545 weekly RRULE calendar from published schedule

## Security

- CORS restricted to `FRONTEND_URL`
- No secrets in code (all via `.env`)
- Super Admin bootstrap idempotent, never overwrites password
- Production safety checks: refuses to start if `JWT_SECRET`/`DATABASE_URL` missing or `DEV_EXPOSE_OTP=true`

## Development Notes

- Run `node --check` on all `.js` files for syntax validation
- Super Admin password set via `SUPER_ADMIN_PASSWORD` in `.env`, never committed
- `DEV_EXPOSE_OTP=true` returns OTP in login response for testing (no email server)
- Production: set `NODE_ENV=production` and `DEV_EXPOSE_OTP=false`