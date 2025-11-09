# MagangHub API Backend

Production-ready NestJS service that ingests public internship data from the MagangHub APIs, persists it in Supabase Postgres via Prisma, and exposes rich search and facet endpoints for the frontend.

## What Was Built

- **Config & bootstrap**: Global `@nestjs/config` setup with Joi validation, timezone enforcement (`Asia/Jakarta`), global validation pipe, and CORS configuration.
- **Prisma/Supabase**: Schema for provinces, internships, sync metadata, and new-internship events plus SQL migration for GIN/BTREE indexes and Indonesian FTS triggers.
- **HTTP + scheduling**: Shared Axios client (30s timeout) and `@nestjs/schedule` cron registration that reads cron expressions from `.env`.
- **Sync module**:
  - Province importer (`POST /sync/provinces`).
  - Incremental sync (`POST /sync/incremental`, hourly cron) with sliding watermark, page window, and early-stop threshold.
  - Full sync (`POST /sync/full`, daily cron) that sweeps inactive rows.
  - Metrics logged to `sync_runs` with insert/update/deactivate counters.
- **Vacancy APIs**: `/search` with FTS, province/kabupaten filters, jenjang/prodi array filters, status, “only new”, and multiple sort orders; `/vacancies/:id` for detail view.
- **Facets**: `/facets/provinces` (dimension table) and `/facets/kabupaten` (derived from internships).
- **Health**: `/health` returns `{ status: 'ok' }`.

## Requirements

- Node.js 20+
- Supabase (or any Postgres 13+) connection strings exported via:
  - `DATABASE_URL` → PgBouncer/pooling connection (runtime & Prisma client)
  - `DIRECT_URL` → direct database port (Prisma migrations)
- `.env` at project root (see values provided by the user)

```env
# Connect via Supabase PgBouncer (runtime + Prisma client)
DATABASE_URL="postgresql://postgres.aptyejjdlltdmabfnuae:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection used by Prisma migrate (non-pooled)
DIRECT_URL="postgresql://postgres.aptyejjdlltdmabfnuae:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
```

## Install Dependencies

```bash
npm install
```

## First-Time Database Setup

```bash
# Generate Prisma client based on prisma/schema.prisma
npm run prisma:generate

# Apply the SQL migration (tables, indexes, FTS trigger)
npm run prisma:migrate
```

Running these for the first time will:
1. Generate `node_modules/@prisma/client` with the schema typings.
2. Connect through `DIRECT_URL` to create the `provinces`, `internships`, `sync_state`, `sync_runs`, and `new_internship_events` tables in Supabase.
3. Install database indexes and the `internships_tsv_refresh` trigger used by search.

## Development Scripts

```bash
# start Nest in watch mode with schedulers active
npm run start:dev

# production build + run
npm run build && npm run start:prod

# run Jest suites (unit + e2e)
npm run test
npm run test:e2e
```

## Typical Workflow

1. **Configure environment** in `.env` (DB URL, cron expressions, limits, etc.).
2. **Install + generate Prisma** (`npm install` + `npm run prisma:generate`).
3. **Apply migrations** to Supabase (`npm run prisma:migrate`).
4. **Start the API** with `npm run start:dev` or `start:prod`.
5. **Seed data**:
   - `POST /sync/provinces` → upserts 40 provinces.
   - `POST /sync/incremental` → fetches up to `ETL_MAX_PAGES` (default 3) from MagangHub, inserts/updates internships, populates `first_seen_at`, logs metrics, and advances the watermark.
   - `POST /sync/full` → crawls all pages, reactivates current rows, and deactivates anything not seen this run.
6. **Query data** using `/search`, `/facets/*`, and `/vacancies/:id`.

## Search Endpoint Reference

```
GET /search
  q                → Full-text search (Indonesian dictionary)
  kode_provinsi    → Exact match
  kabupaten        → Case-insensitive contains
  jenjang          → CSV list matched against array column
  prodi            → CSV list matched against array column
  status           → open | closed | all (default all)
  only_new         → true limits to ROWs within NEW_WINDOW_HOURS (default 72)
  sort             → terbaru | deadline_asc | kuota_desc | peminat_desc
  page, limit      → Pagination (default 1, 20)
```
Response structure:
```json
{
  "meta": { "page": 1, "limit": 20, "total": 123 },
  "data": [ { "id_posisi": "...", "posisi": "...", ... } ]
}
```

## Cron Jobs

- Incremental sync: `ETL_INC_CRON` (default `0 * * * *`, hourly) with sliding window and watermark stop threshold.
- Full sync: `ETL_FULL_CRON` (default `0 2 * * *`, daily 02:00 WIB) with mark-and-sweep.

Both cron jobs respect `TZ=Asia/Jakarta` and log failures to Nest logger plus `sync_runs.note`.

## Testing Notes

Running Jest inside WSL1 isn’t supported. Execute `npm run test` / `npm run test:e2e` on WSL2 or a Linux/Unix environment to exercise the mocked HTTP specs and route wiring.

## Docs & Health

```
GET /docs   → Swagger UI with the API contract
GET /health → { "status": "ok" }
```

Use this for container/platform readiness probes.
