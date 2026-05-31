# Fatoven Backend

Modular health-tracking API (weight, macros, steps, weekly measurements and subjective scores). Built with **Docker**, **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**.

Services use the `fatoven` prefix: `fatoven-api`, `fatoven-postgres`.

## Modules (current)

| Module    | Path prefix           | Description                                      |
|-----------|------------------------|--------------------------------------------------|
| **auth**  | `/api/v1/auth`         | Register, login, JWT, current user                 |
| **tracking** | `/api/v1/tracking`  | Daily logs, weekly summaries, weekly assessments |

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

API: http://localhost:3000  
Health: http://localhost:3000/health

### Local development

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
npm install
npm run db:migrate:dev
npm run dev
```

## API examples

### Register

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123","displayName":"Mitch"}'
```

### Login

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}' | jq -r .token)
```

### Upsert daily log

```bash
curl -s -X PUT http://localhost:3000/api/v1/tracking/daily \
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
curl -s "http://localhost:3000/api/v1/tracking/weekly/summaries?from=2025-01-01&to=2025-03-01" \
  -H "Authorization: Bearer $TOKEN"
```

### Weekly assessment

```bash
curl -s -X PUT http://localhost:3000/api/v1/tracking/weekly/assessments \
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
| `PORT`           | HTTP port (default `3000`)           |
| `DATABASE_URL`   | PostgreSQL connection string         |
| `JWT_SECRET`     | Secret for signing tokens (min 8 chars) |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`)      |
