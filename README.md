# GoldSilverShop

A full-stack gold and silver jewellery, coin and bar storefront: React + TypeScript + Vite on the frontend, Node.js + Express + TypeScript + Prisma on the backend, PostgreSQL for storage, deployed as a **single Render web service**.

> **Payments are simulated.** This build includes a clearly labelled demo checkout ("Demo checkout — no real payment is collected"). No real payment provider is integrated yet — see [Payments status](#payments-status) before accepting real customer money.

## Table of contents

1. [What's included](#whats-included)
2. [Local installation and startup](#local-installation-and-startup)
3. [Environment variables](#environment-variables)
4. [Database setup and migrations](#database-setup-and-migrations)
5. [Sample data and initial administrator setup](#sample-data-and-initial-administrator-setup)
6. [Running tests](#running-tests)
7. [Pushing the project to GitHub](#pushing-the-project-to-github)
8. [Deploying through Render Blueprints](#deploying-through-render-blueprints)
9. [Logs and diagnosing deployment failures](#logs-and-diagnosing-deployment-failures)
10. [Payments status](#payments-status)

## What's included

- **Storefront**: home page, catalogue with search/filter/sort (metal, category, purity, price, availability), product details with a transparent price breakdown, cart, checkout, order confirmation, order history, and a customer account (register/login).
- **Admin dashboard** (role-protected): manage stock levels, add new manually-entered metal rates, update order status, view audit trail.
- **Pricing engine**: `metal value = net weight (g) × rate per gram of pure metal × purity fraction`, plus making charges (flat or % of metal value), optional stone charges, tax and shipping — all recalculated server-side on every request. Purity is applied exactly once.
- **Order integrity**: server-side stock validation with atomic decrements (no overselling), idempotency keys (no duplicate orders from double-clicks/retries), price-change detection between quote and checkout, full price/rate snapshot stored per order line so historical orders never change.
- **Security**: bcrypt password hashing, httpOnly JWT session cookie, double-submit CSRF protection, login/register rate limiting, server-side input validation (Zod), no secrets committed to Git.

## Local installation and startup

Prerequisites: Node.js 20+, npm, and a PostgreSQL database (local install, Docker, or a free cloud instance such as Render/Neon/Supabase).

```bash
git clone <your-repo-url>
cd GoldSilverShop   # or your chosen folder name

# 1. Configure environment variables
cp backend/.env.example backend/.env
# edit backend/.env and set DATABASE_URL and JWT_SECRET (see below)

# 2. Install dependencies
npm run install:all

# 3. Apply database migrations
npm run migrate:deploy

# 4. Seed sample products, metal rates and store settings (safe to re-run)
npm run seed

# 5. Start the backend (port 4000) and frontend (port 5173) in two terminals
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173 for the storefront (the Vite dev server proxies `/api` to the backend on port 4000).

For a production-style run from a single server (what Render runs):

```bash
npm run build   # builds frontend into backend/public, then compiles the backend
npm start        # runs prisma migrate deploy, then starts the Express server on $PORT
```

Then open http://localhost:4000 (or the port shown).

## Environment variables

Backend (`backend/.env`, copy from `backend/.env.example`):

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `JWT_SECRET` | Yes | Long random string signing session cookies. Generate with `openssl rand -hex 32`. |
| `PORT` | No | Defaults to 4000 locally; Render sets this automatically in production. |
| `NODE_ENV` | No | `development` or `production`. |
| `CORS_ORIGIN` | No | Only needed if the frontend runs on a different origin than the API (local dev with separate ports doesn't need this — Vite proxies requests). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Set temporarily, run `npm run seed` once to create the first admin, then remove them. Never commit real values. |

Frontend (`frontend/.env`, copy from `frontend/.env.example`): not required for normal use; present only as a placeholder for future local dev customisation.

**Never commit `.env` files.** Only `.env.example` files (placeholders only) are tracked in Git.

## Database setup and migrations

- Schema is defined in [backend/prisma/schema.prisma](backend/prisma/schema.prisma).
- The initial migration lives in [backend/prisma/migrations/20260916000000_init](backend/prisma/migrations/20260916000000_init) and is applied with `npx prisma migrate deploy` (wrapped by `npm run migrate:deploy`, and run automatically every time the production server starts via `npm start`).
- To create a **new** migration after changing the schema during development: `cd backend && npx prisma migrate dev --name <description>` (requires a reachable database).
- `prisma migrate deploy` only applies pending migrations — it is safe to run repeatedly and never drops data.

## Sample data and initial administrator setup

- `npm run seed` (from the repo root, or `cd backend && npm run seed`) inserts demo store settings, starter gold/silver rates, and 8 sample products (rings, necklace, earrings, bangle, gold/silver coins, gold/silver bars) with multiple purity/weight variants. It uses `upsert`, so it's **safe to run repeatedly** — it will not duplicate products or overwrite customer orders.
- **Administrator account**: for security, no default admin password is ever published. To create the first admin:
  1. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` as environment variables (locally in `backend/.env`, or as Render environment variables for the deployed service).
  2. Run `npm run seed` once.
  3. Remove/unset `ADMIN_PASSWORD` afterwards (leaving it set has no further effect once the admin exists, since seeding checks for an existing account with that email — but it's good hygiene to remove it).
- Sample product images are bundled, hand-drawn SVG placeholders under `frontend/public/products/` — no external image hosting or stock photography is used.

## Running tests

```bash
cd backend
npm test
```

This runs Vitest unit tests for the pricing engine ([backend/test/pricing.test.ts](backend/test/pricing.test.ts)), covering:

- Purity is applied exactly once to the metal value.
- Flat vs. percentage-of-metal making charges, and stone charges.
- Currency rounding to 2 decimal places.
- Tax calculation and free-shipping threshold behaviour.

Manual QA performed during this build (see the final report at the end of this document/PR) covered registration/login, catalogue filters, cart and checkout, stock and duplicate-order handling, order cancellation with stock restoration, and access control between customers and admins.

## Pushing the project to GitHub

```bash
git init                      # if not already a repo
git add -A
git commit -m "GoldSilverShop: full-stack storefront"
git branch -M main
git remote add origin https://github.com/<you>/<your-repo>.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, build output (`dist`, `backend/public`), and all `.env` files.

## Deploying through Render Blueprints

This repo includes a [render.yaml](render.yaml) Blueprint that provisions:

- **One web service** (`goldsilvershop`) that builds and serves both the API (`/api/*`) and the built React app from the same origin.
- **One Render Postgres database** (`goldsilvershop-db`).

### Steps

1. Push this repository to GitHub (see above).
2. In the [Render Dashboard](https://dashboard.render.com), click **New → Blueprint** and select your repository. Render detects `render.yaml` automatically.
3. Render prompts you to confirm the plan for each resource and to provide values for any `sync: false` variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD` — optional at this stage; you can add them later from the service's Environment tab).
4. Click **Apply**. Render provisions the database, then builds and deploys the web service. The build runs `npm run build` (installs and builds the frontend into `backend/public`, then compiles the backend); the start command runs `npm start`, which applies pending Prisma migrations and starts the Express server bound to `0.0.0.0:$PORT`.
5. Once deployed, visit the service's `*.onrender.com` URL. `/api/health` should return `{"status":"ok"}`.
6. To seed sample data and create the first admin in production: open the service's **Shell** tab in the Render Dashboard and run:
   ```bash
   cd backend && npm run seed
   ```
   (Set `ADMIN_EMAIL`/`ADMIN_PASSWORD` as environment variables on the service first if you want the first admin created in this pass.)

### Plan and cost notes (verified against Render's current pricing, September 2026)

- `render.yaml` defaults to the **Free** plan for both the web service and the database so you can try the whole app at no cost:
  - **Free web services** spin down after 15 minutes of inactivity (a subsequent request takes ~1 minute to wake it up) and have an ephemeral filesystem (fine here — this app stores everything in Postgres, not local files).
  - **Free Postgres databases expire 30 days after creation** and are limited to 1 GB storage with no backups. After 30 days you must upgrade to a paid plan (from **$6/month** for Basic-256mb) or the database enters a 14-day grace period before deletion.
- For a persistently-running store, upgrade the web service to the **Starter** plan (**$7/month**) and the database to at least **Basic-256mb** (**$6/month**). Change the `plan` fields in `render.yaml` and re-sync the Blueprint, or change them directly in the Render Dashboard.
- Always check Render's current [pricing page](https://render.com/pricing) before committing to a paid plan, as pricing and plan names can change.

### SPA routing

The Express server serves `backend/public/index.html` for any non-`/api` GET request, so refreshing a nested route like `/catalogue` or `/orders/GSS-...` works correctly instead of 404ing.

### Health check

`GET /api/health` returns `{ "status": "ok", "time": "<ISO timestamp>" }` and is configured as the Render health check path.

## Logs and diagnosing deployment failures

- **Build failures**: check the **Logs** tab during the build phase in the Render Dashboard. Common causes: missing lockfile (both `backend/package-lock.json` and `frontend/package-lock.json` are committed), or a Node version mismatch (this project targets Node 20+; Render's default Node version is recent enough, but you can pin one with a `.node-version` file if needed).
- **Deploy/start failures**: check the **Logs** tab after deploy starts. Common causes:
  - `DATABASE_URL` not set or database not yet provisioned — confirm the database resource exists and is linked in the service's Environment tab.
  - Pending migrations failing to apply — the start command runs `prisma migrate deploy`; its output appears in the logs and shows exactly which migration failed and why.
  - Missing `JWT_SECRET` — the server exits immediately with a clear error message if required environment variables are missing.
- **Runtime errors**: use `/api/health` to confirm the process is up, then check the Logs tab for request-level errors (the app logs via `morgan` and a centralised error handler that never leaks stack traces to clients).

## Payments status

**Payments are simulated, not real.** Every order is created with a `Payment` record marked `isSimulated: true` and provider `SIMULATED`; the checkout UI displays "Demo checkout — no real payment is collected" throughout. No card numbers are collected or stored anywhere.

Before accepting real customer payments you will need to:

1. Confirm the store's operating country, currency, and applicable tax/shipping rules (currently demo defaults: INR, 3% tax, flat shipping fee, configurable free-shipping threshold — all editable by an admin, but not validated against any real jurisdiction's tax law).
2. Choose and configure a hosted payment provider (e.g. Stripe, Razorpay) — the `Payment` model and `order.service.ts` are structured so a real provider can be plugged in without changing the schema (add a webhook handler that flips `paymentStatus` to `PAID`/`FAILED` based on the provider's callback, and swap the simulated "instant success" step for a redirect/checkout-session flow).
3. Complete that provider's verification/compliance requirements (KYC, business verification, etc.) before going live.
4. Re-test the full checkout flow end-to-end with the real provider in test mode before accepting production traffic.
