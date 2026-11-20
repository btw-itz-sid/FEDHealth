# Local demo verification — 20 November 2026

Scope: application readiness and explanation for the 29 November ETE. Report/PPT are managed by the student's teammate.

## Automated checks

- Frontend: TypeScript and Vite production build passed.
- API: NestJS production build passed; 7 unit tests passed across authentication and model-activation checks.
- ML: 66 tests passed, including FastAPI training/prediction routes, numerical aggregation, split equality, test isolation and next-round continuity. The installed Starlette/httpx combination emits a deprecation warning; requests pass.
- 54 isolated multi-seed CLI research runs completed. Aggregate outputs and split manifests are under `docs/benchmarks/`.
- `git diff --check` passed. No environment files, patient CSVs or model binaries were added to source control.

## Browser checks against the configured local stack

1. Researcher login succeeded using the existing seeded demo account.
2. Found and fixed an existing HTML step-validation error that prevented the default learning rate 0.1 from submitting. Float privacy fields were corrected too.
3. Created `ETE architecture proof - FedAvg IID v2` through the UI. The experiment completed and registered its model.
4. Verified its split was 491 training / 123 validation / 154 test records and its final test accuracy was 72.73%.
5. Verified round 1 began at zero, and reconstructed all nine new global parameters from counts and transmitted deltas in the browser with maximum error 0.00e+0.
6. Selected round 2 and bias; confirmed the starting parameter came from the previous global result and the weighted calculation remained exact.
7. Ran the nine-experiment balanced web benchmark suite. All nine completed under protocol v2 (20-round schedule).
8. Compared matching v2 centralized, FedAvg IID, FedAvg non-IID and local-only non-IID runs. Curves and final metrics displayed correctly. Legacy results are retained and labeled separately.
9. Found a stale active model record whose pipeline file was absent. Activated the verified proof model `fedavg_20261120_114234_7fd1a1`.
10. Added an API activation guard: selecting the missing legacy artifact now returns a clear error and preserves the working active model. Verified this through the browser and unit tests.
11. Submitted the built-in lower-risk illustrative sample. Prediction succeeded with estimated probability 4.9%, method FedAvg and version `v1.0_20261120_114234`. This was a synthetic demo input, not a clinical assessment. Confirmed the saved assessment appeared in the logged-in researcher's history with the same probability and method.

## Remaining practical boundaries

Follow-up verification: [MODEL_IMPROVEMENT.md](MODEL_IMPROVEMENT.md) records the new centralized Random Forest serving model, live web training and simpler navigation/results. The ML suite now passes 73 tests and the API suite passes 10 tests; API and frontend builds passed. The older proof activation/prediction checks above describe the earlier FedAvg serving state.

- Local demo uses Neon and needs database connectivity.
- Hospital clients share one Python process; pooled training preprocessing and seeded noise are explicit research assumptions.
- Background jobs are not durable across API restarts; cancellation does not terminate Python computation.
- Public hosting, production migrations, real remote clients and formal privacy certification are not verified by these checks.
- Keep model artifacts when moving/deploying the project. Database metadata alone cannot serve predictions.

Start with `docs/VIVA_GUIDE.md` and a completed FedAvg experiment's round evidence for the explanation. Presentation routes are removed from the live application. See `docs/UI_UX_REVAMP.md` for the redesigned flows and `docs/DATASET_AUDIT.md` for the four incoming archives.
