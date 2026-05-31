# Fatoven Backend

Modular health-tracking API (weight, macros, steps, weekly measurements and subjective scores). Built with **Docker**, **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**.

Services use the `fatoven` prefix: `fatoven-api`, `fatoven-postgres`.

## Ports (avoid conflicts with other stacks)

| Service           | Host port | Container port | Notes                          |
|-------------------|-----------|----------------|--------------------------------|
| `fatoven-api`     | **3001**  | 3000           | `mdw-api` uses host **3000**   |
| `fatoven-postgres`| **5433**  | 5432           | `mdw-db` uses host **5432**    |

Inside Docker, services still talk on `fatoven-postgres:5432` and the API listens on `3000` internally.

## Modules (current)

| Module    | Path prefix           | Description                                      |
|-----------|------------------------|--------------------------------------------------|
| **auth**  | `/api/v1/auth`         | Register, login, JWT, username, current user       |
| **tracking** | `/api/v1/tracking`  | Daily logs, weekly summaries, weekly assessments (own data) |
| **stats** | `/api/v1/stats`       | Read-only tracking for any user by `@username` (JWT required) |

Planned later: body composition (US Navy), Garmin sync, food catalog, AI agent, exercises, videos.

## Data model (from your spreadsheet)

**Daily log** (one row per day): weight, steps, calories, fat/carbs/protein grams, Garmin calories.

**Weekly summary** (computed): average weight, steps, calories, Garmin calories per ISO week.

**Weekly assessment**: pulse, belly/neck/chest cm, scores 1–10 for satiety, calorie tracking, sleep, wellbeing, stress.

## Quick start

### Docker (full stack)

```bash
cp .env.example .env
# Set JWT_SECRET in .env for production

docker compose up --build
```

API: http://localhost:3001  
Health: http://localhost:3001/health

### Local development

```bash
cp .env.example .env   # DATABASE_URL uses host port 5433, API port 3001
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:migrate:dev
npm run dev
```

If `db:migrate:dev` fails with **P1001** on port 5432, your `.env` is stale — use `localhost:5433` (see `.env.example`).

**Node.js:** use **v20+** locally (`nvm install 20`). If you are still on Node 18, run migrations in Docker instead:

```bash
npm run db:migrate:dev:docker
```

**esbuild platform error** (`linux-arm64` vs `darwin-arm64`): `node_modules` was installed inside Docker. On your Mac, reinstall:

```bash
rm -rf node_modules && npm install
```

Do not mount or copy `node_modules` from Docker into the host project.

## Shareable stats (`/api/v1/stats/:username`)

Authenticated users can view **another user’s read-only** tracking data (e.g. frontend route `/{username}/stats`).

- All stats routes require `Authorization: Bearer <token>`
- **GET only** — no writes under `/stats/*`
- Target user must have a `username` set; otherwise **404**
- Profile responses omit `email`

| Method | Path | Response |
|--------|------|----------|
| GET | `/:username` | `{ profile }` |
| GET | `/:username/daily?from=&to=` | `{ logs }` |
| GET | `/:username/weekly/summaries?from=&to=` | `{ summaries }` |
| GET | `/:username/weekly/assessments` | `{ assessments }` |
| GET | `/:username/weekly/assessments/:weekStartDate` | `{ assessment }` |

**Username rules:** 3–30 chars, `^[a-z0-9_]+$`, lowercase on save. Reserved: `login`, `register`, `profile`, `daily`, `history`, `dashboard`, `progress`, `weekly`, `food`, `garmin`, `coach`, `stats`, `api`, `health`.

```bash
# Set your username (authenticated)
curl -s -X PATCH http://localhost:3001/api/v1/auth/username \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"mitch"}'

# View another user's stats (any logged-in user)
curl -s http://localhost:3001/api/v1/stats/mitch \
  -H "Authorization: Bearer $TOKEN"
```

## API examples

### Register

```bash
curl -s -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123","displayName":"Mitch","username":"mitch"}'
```

### Login

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' | jq -r .token)
```

### Upsert daily log

```bash
curl -s -X PUT http://localhost:3001/api/v1/tracking/daily \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "logDate": "2025-01-19",
    "weightKg": 123.1,
    "steps": 10123,
    "caloriesKcal": 2100,
    "fatGrams": 70,
    "carbsGrams": 180,
    "proteinGrams": 150,
    "garminCaloriesKcal": 2400
  }'
```

### Weekly summaries (averages)

```bash
curl -s "http://localhost:3001/api/v1/tracking/weekly/summaries?from=2025-01-01&to=2025-03-01" \
  -H "Authorization: Bearer $TOKEN"
```

### Weekly assessment

```bash
curl -s -X PUT http://localhost:3001/api/v1/tracking/weekly/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "weekStartDate": "2025-01-13",
    "restingPulseBpm": 62,
    "bellyCm": 127,
    "neckCm": 45,
    "chestCm": 120,
    "satietyScore": 7,
    "sleepScore": 6,
    "stressScore": 4
  }'
```

## Adding a new module

1. Create `src/modules/<name>/` with `*.service.ts`, `*.routes.ts`, and types.
2. Register the router in `src/modules/index.ts`.
3. Add Prisma models and a migration when persistence is needed.

## Environment

| Variable         | Description                          |
|------------------|--------------------------------------|
| `PORT`           | HTTP port (default `3001` on host dev) |
| `DATABASE_URL`   | PostgreSQL connection string         |
| `JWT_SECRET`     | Secret for signing tokens (min 8 chars) |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`)      |
