# Application readiness update — 20 November 2026

The immediate scope is the working application and the student's explanation. Report/PPT are handled by a teammate.

Completed in this update:
- Rebuilt the architecture diagram around common zero initialization, local SGD, explicit deltas/counts and sample-weighted aggregation.
- Added a separate aggregator contract and full numerical traces for fresh FedAvg rounds; the browser independently reconstructs all nine parameters.
- Added a worked local learning step and a clearly labeled example that works before experiments exist.
- Added a shared train/validation/test protocol, train-only preprocessing, split hashes, legacy labels and incompatible-comparison warnings.
- Fixed default experiment form step-validation errors, including learning-rate and noise-setting fields.
- Verified 66 ML tests, 7 API unit tests and both builds; performed a fresh browser training run and completed the nine-run v2 demo suite. Added missing-artifact checks before model activation.
- Executed 54 isolated multi-seed benchmark runs and recorded measured results under `docs/benchmarks/`.
- Added `docs/VIVA_GUIDE.md` for the application explanation and demo.

Deployment limitations remain explicit: in-memory job dispatch, no restart recovery/cooperative cancellation, no real remote hospital clients, pooled training preprocessing, seeded noise without a certified privacy guarantee, and cloud database connectivity. Production migrations and hosting are not marked complete by this update. These are separate from the verified local examination demo.

The earlier plan below is historical context. Its old two-way evaluation results and completion claims do not describe protocol v2.

---

# FedHealth — Web-Only Project Plan

FedHealth is a single **web application** (React + Vite) backed by a NestJS API, a FastAPI ML service, and a Python federated-learning simulator. There is no mobile app. Every role — patient, researcher, admin — uses the same web app, with pages gated by role.

The goal of the project is a research comparison: **centralized vs. local-only vs. federated (FedAvg, IID and non-IID) vs. federated + differential privacy** for diabetes risk prediction on the PIMA dataset, shown through a working, secure web platform.

---

## Progress (2026-11-11)

The research demo is complete: patient assessment and history, researcher experiments, Compare, model registry, FedAvg (IID and non-IID), differential privacy, and the results in `docs/fedhealth-comparison.csv` and `docs/RESEARCH_NOTES.md`. Admin can change roles and deactivate accounts. Code is on GitHub (`main`).

Added 2026-11-11:
- Class balancing option for every method (recall 0.50 → 0.70 centralized, 0.50 → 0.69 FedAvg IID, ROC-AUC unchanged). Benchmark suite now has 18 runs: 9 unweighted, 9 balanced.
- A learning curve shows more PIMA-style rows would not help much (validation ROC-AUC flat after ~300 rows).
- "How it works" page: a 7-step animated walkthrough of one real FedAvg run (hospitals, local training, weights-only upload, FedAvg, rounds, DP, results).
- `scripts/export_comparison.py` regenerates the comparison CSV from the API.

Still open before the 20 Nov review:
- Deploy the web app, API, and ML service so the examiner can open a public URL. Needs a hosting account (Render/Railway + the existing Neon database).
- Phase 1.2: untracked `Datasets/` folder (notebooks + an unrelated CSV). Leave it out of git.
- Phase 2.6: `frontend/src/lib/api.ts` still uses `any`.
- Phase 5.4: TypeORM migrations (`synchronize: false`) for production.
- Optional: FedProx, Playwright smoke tests.
- Optional: move the Neon database from `us-east-2` to an Asia region. Each query from India costs ~290 ms, so pages take 1–3 s to load.

## Starting State (before Phases 1–3)

| Area | Status |
|------|--------|
| NestJS API (auth, users, datasets, experiments, models, predictions, audit) | Built, needs end-to-end verification |
| Web app — researcher/admin pages | Built (Overview, Datasets, Experiments, Experiment detail, Models, Admin) |
| Web app — patient pages | **Missing.** Patient features only existed in the removed mobile app |
| ML service | Built, but has duplicate `app/routers/` and `app/routes/` folders (only `routes/` is wired in `main.py`) |
| Federated learning | Hand-written FedAvg simulation in NumPy/scikit-learn. Docs claim Flower, but `flwr` is not installed or imported |
| Differential privacy | `differential_privacy.py` + `dp_experiments.py` exist; not exposed through the API/web yet |
| Data | PIMA expected at `data/diabetes.csv`. An extra `Datasets/` folder holds notebooks and a different 500-row synthetic dataset (different columns) that is not gitignored |

---

## Phase 1 — Clean Up and Stabilize (1–2 days)

1. Delete the unused `services/ml-service/app/routers/` folder (or merge anything unique into `app/routes/`).
2. Decide on the `Datasets/` folder: move notebooks to `notebooks/` for EDA reference, and either delete `diabetes_dataset.csv` or move it under `data/` so it is gitignored. The platform should stay PIMA-only.
3. Make docs truthful: either adopt Flower (Phase 4) or change "Flower" to "custom FedAvg simulation" in `docs/architecture.md` and `AGENTS.md`.
4. Run everything locally end to end: seed DB → log in as each demo user → upload PIMA → run one experiment → make one prediction. Write down every break and fix it before adding features.
5. Make sure the existing test suites pass (`npm test` in `services/api`, `pytest` in `services/ml-service`).

**Done when:** a fresh clone can be set up from the README and the full flow works for all three roles.

---

## Phase 2 — Patient Web Experience (2–3 days)

Port what the mobile app did into the web app, using the existing API (`POST /predictions`, `GET /predictions`, `GET /predictions/:id`).

1. **`/assess` — Risk Assessment page** (patient role)
   - Form for the 8 PIMA fields, using `PIMA_FEATURE_FIELDS` from `packages/shared-types` for labels and min/max.
   - Client-side validation for UX; server-side validation stays the source of truth.
   - Result card: risk level (Low / Moderate / High), probability, model version used, and the research disclaimer.
2. **`/history` — Prediction History page** (patient role)
   - Paginated table of the patient's own predictions, with a detail view.
   - Simple trend chart of probability over time.
3. **`/profile` — Profile page** (all roles): name, email, role, change password.
4. Replace the patient placeholder on `OverviewPage` with a real summary (latest risk, number of assessments, link to new assessment).
5. Add the new pages to `DashboardLayout` navigation, gated by role.
6. Use the shared types package in `frontend/src/lib/api.ts` instead of `any`.

**Done when:** a patient can sign up, assess risk, and see their own history — and cannot see anyone else's.

---

## Phase 3 — Researcher Experience (3–4 days)

1. **Experiment builder:** choose method (centralized / local-only / FedAvg), partition (IID / non-IID), number of clients, rounds, local epochs, seed, and DP settings (ε, δ, clipping norm).
2. **Live progress:** poll `GET /experiments/:id/rounds` while running; show per-round accuracy / F1 / ROC-AUC charts.
3. **Comparison page (`/compare`):** pick 2+ experiments and show side-by-side metrics, confusion matrices, and round curves. This page is the core research deliverable.
4. **Privacy–utility chart:** accuracy vs. ε across DP experiments.
5. **Model registry:** promote a trained model to "active" so patient predictions use it; show which model version served each prediction.
6. **Export:** download experiment results as CSV/JSON for the report.

**Done when:** a researcher can reproduce the full comparison table in `docs/RESEARCH_NOTES.md` from the web UI alone.

---

## Phase 4 — Federated Learning and Privacy Depth (3–5 days)

1. Pick one: **(a)** keep the custom FedAvg simulation and document it clearly, or **(b)** port it to Flower's simulation engine (`flwr`). Option (a) is lower risk for the deadline; option (b) is stronger for the report.
2. Wire DP training through the ML service so it is runnable from the web app, not only via CLI scripts.
3. Add a privacy-budget tracker that reports cumulative (ε, δ) per experiment.
4. Optional, if time allows: FedProx as a second algorithm for the non-IID case.
5. Fix seeds everywhere and keep a held-out test set that no client ever trains on.

---

## Phase 5 — Admin, Security, Quality (2–3 days)

1. Admin page: user management (role changes, deactivate), audit log filters (user, action, date), system health (API + ML service + DB).
2. Security review: rate limits on auth, JWT expiry + refresh strategy, CORS only for the web origin, file-upload limits on dataset upload, ownership checks on every patient-scoped route.
3. Tests:
   - API: unit tests per service + e2e for auth, predictions ownership, experiment lifecycle.
   - ML: training/prediction/FL tests with fixed seeds.
   - Web: a few Playwright smoke tests (login per role, make a prediction, run an experiment).
4. Switch TypeORM to migrations (`synchronize: false`).

---

## Phase 6 — Deploy and Present (2 days)

1. Deploy: web on Vercel/Netlify, API + ML service on Render/Railway (or one Docker Compose on a VM), Neon for Postgres.
2. Seed demo accounts and one pre-run set of experiments so the demo works instantly.
3. Final docs: README, architecture diagram, API reference, research results with charts, and limitations (small dataset, simulated clients, not clinically valid).

---

## Out of Scope

- Mobile app (removed — the web app is responsive and covers patients)
- Real multi-hospital deployment; clients are simulated
- Any clinical use; all predictions are research estimates

## Suggested Order If Time Is Short

Phase 1 → Phase 2 → Phase 3 (comparison page first) → Phase 6. Phases 4 and 5 can be trimmed to their first items.
