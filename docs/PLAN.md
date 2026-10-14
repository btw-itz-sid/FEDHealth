# FedHealth — Web-Only Project Plan

FedHealth is a single **web application** (React + Vite) backed by a NestJS API, a FastAPI ML service, and a Python federated-learning simulator. There is no mobile app. Every role — patient, researcher, admin — uses the same web app, with pages gated by role.

The goal of the project is a research comparison: **centralized vs. local-only vs. federated (FedAvg, IID and non-IID) vs. federated + differential privacy** for diabetes risk prediction on the PIMA dataset, shown through a working, secure web platform.

---

## Progress (2026-10-14)

Phases 1–3 are implemented and verified end to end on Neon (all 9 benchmark experiments complete; patient and researcher pages checked in the browser). Phase 4 items 2–3 (DP from the web app, cumulative ε tracking) were done along the way, using the custom FedAvg simulation (option a).

Still open from Phases 1–3:
- Phase 1.2: the untracked `Datasets/` folder (notebooks + an unrelated 500-row synthetic CSV) is untouched.
- Phase 2.6: `frontend/src/lib/api.ts` still uses `any` instead of `packages/shared-types`.

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
