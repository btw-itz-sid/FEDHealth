# Public deployment candidate

For the selected free staging/demo setup, follow [FREE_STAGING.md](FREE_STAGING.md). The instructions below describe the separate paid single-server profile. The free-staging image passed Linux build/runtime-package checks on 28 November; see `DEMO_VERIFICATION.md`. The paid Compose profile and public deployment still require their own acceptance run.

This repository has a portable single-server deployment configuration. It has **not** been deployed to a public URL. Docker is unavailable on the current development machine, so image builds, fresh-database migration execution, HTTPS and volume restore still require a staging run.

## Service layout

`Browser → Caddy HTTPS + React → Nest API → private FastAPI ML service`

Neon stores users, assessment history, datasets metadata, experiments, rounds, models metadata and audit logs. Docker volumes store uploaded CSVs, model pipelines, research artifacts and Caddy certificates. A model registry database record alone is insufficient: its matching pipeline and metadata files must survive deployment too.

Only the web service publishes ports 80/443. API and ML ports are internal. All ML operations require the separate `ML_SERVICE_KEY` in production. HTTPS origins must be explicit; JWT secrets cannot use development placeholders. Cookies are HttpOnly, Secure in production and SameSite Strict. Browser mutations carry a verification header and are checked against the configured origins. Password changes invalidate previously issued tokens.

## Prepare staging

1. Provision a Linux host with Docker Compose, a DNS name pointing to it, and a **new staging Neon database**. No hosting purchase has been made by this task.
2. Copy `deploy/production.env.example` to a private file on the server, outside source control. Fill `APP_DOMAIN`, `DATABASE_URL`, and two distinct random secrets for `JWT_SECRET` / `ML_SERVICE_KEY`. Use a bare hostname for `APP_DOMAIN`; no protocol or path. Restrict the file's permissions to its operator.
3. From the repository root, build the images:

   ```sh
   docker compose --env-file /secure/fedhealth.env -f compose.production.yml build
   ```

4. Apply the initial migration **only to an empty database**:

   ```sh
   docker compose --env-file /secure/fedhealth.env -f compose.production.yml run --rm --no-deps api node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
   ```

   The migration refuses to run over existing application tables. It was generated offline from the current seven entity tables. The application never synchronizes a production schema automatically. For the existing development database, take a backup and review a schema diff before establishing a migration baseline; do not blindly fake the initial migration. [TypeORM migration setup](https://typeorm.io/docs/migrations/setup/).

5. Supply `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` in the server shell environment using its secret facility, then create the first administrator:

   ```sh
   docker compose --env-file /secure/fedhealth.env -f compose.production.yml run --rm --no-deps -e ADMIN_EMAIL -e ADMIN_PASSWORD api node dist/database/seed.js
   ```

   The seed refuses an existing email and never creates known demo credentials. Do not migrate local demo accounts into a public database. Clear these bootstrap variables after use.

6. Start the services:

   ```sh
   docker compose --env-file /secure/fedhealth.env -f compose.production.yml up -d
   ```

7. Sign in as administrator. Approve a research account through Administration, upload the validated public PIMA CSV, train a model and confirm its registered artifact is available. Assessments remain unavailable until an active ready model exists. Alternatively, transfer the matching model artifact folders and register them through administrator model sync; do not copy pipelines from an untrusted source (`joblib` deserialization can execute code).

## Runtime behavior and scope

- Public signup creates personal accounts. Only an administrator grants research/admin roles. Approved researchers share datasets, experiments and model controls in one institutional research workspace; this is not a multi-organization tenant system. Assessment history is scoped to its account.
- Exactly **one API replica and one ML worker** are supported. The database-backed queue processes one training run at a time. Queued runs survive API restarts. Interrupted running entries become failed with an explicit retry message; they are not automatically retried because the old ML call may still be computing.
- Only the creator can cancel a queued run. Running jobs complete normally; the app does not pretend a status update stops computation. A separate ML lock rejects overlapping training requests. Training requests time out after one hour; the compute itself is not forcibly terminated by that HTTP timeout.
- The ML deployment defaults to at most 10,000 training rows. Increase this only after measuring memory/CPU use. Each target class needs at least 20 records. Empty targets, infinite numbers, unusable feature columns and duplicate measurement/target rows are rejected. Range and missing-measurement warnings still need researcher review.
- ML inference/model operations and dataset checks have bounded API timeouts. Health endpoints are liveness checks, not proof that a trained model exists or that all database operations will succeed.
- The frontend uses same-origin `/api/v1`. Caddy handles SPA routes; no Vite development server is used in production. `TRUST_PROXY=1` is for this single internal reverse proxy only. Never publish API port 3001 directly while trusting proxy headers.
- This is a public-data research simulation. It has no established clinical validity, real hospital federation, secure aggregation or certified differential privacy. Do not advertise those properties.

## Required staging acceptance before publication

- Build all images from a clean checkout and verify pinned Python packages install on Linux/Python 3.12. Run the initial migration against an empty Neon branch and check the entity schema diff is empty.
- Check HTTPS redirects, Secure/HttpOnly cookies, refresh, logout, invalid login, role rejection, foreign-origin rejection and password session invalidation. Test two personal accounts: neither may read the other's assessments.
- Confirm missing/invalid dataset uploads return useful errors. Train one small run, verify queued/running/completed states, model registration and an assessment from the active version. Test queue recovery across a restart.
- Stop/recreate containers and confirm model files, uploads, history and the active-model choice persist. Back up Neon plus the data/model/artifact volumes; perform a restore rehearsal. Do not use `docker compose down -v` on a database containing wanted history.
- Review dependency audit results, server resource limits, operator access and application logs. Add monitoring/backups and decide retention/account-recovery support before accepting real personal health measurements.

These are release gates, not claims that the staging deployment has already passed them.

## Verified locally on 20 November 2026

- Frontend production build passed with Vite 8.3.8; API build passed with Nest 11.2.11.
- 87 isolated ML tests, 32 API unit tests and 4 isolated HTTP authentication/security tests passed. The ML suite reports one existing Starlette/httpx deprecation warning.
- Full `npm audit` reported zero known vulnerabilities for both frontend and API after package updates, including development dependencies. This is an advisory check, not a penetration test or proof of complete security.
- Read-only comparison against the existing development Neon schema discovered seven entity tables and zero pending entity-schema changes. No production migration was executed.
- Browser checks covered login, refresh persistence, logout, personal-only registration, required dataset selection, the 768-row training input summary, empty assessment validation, an active-model sample assessment and mobile navigation at 390 px without horizontal document overflow.
- The sample estimate used the existing active model version `v1.0_20261120_125147`. No new model was activated by this hardening work.
- Docker image builds, a fresh-schema migration execution, public HTTPS, public URL availability and backup/restore remain unverified staging gates.
