# Final local demo verification - 28 November 2026

Scope: final guide demonstration on Monday, 30 November. These checks establish local application behavior; public hosting is still unverified. Earlier November checks are historical and do not describe the current active model.

## Fresh automated checks

- 46 API unit/schema/persistence checks passed, including fresh PostgreSQL migrations, recovery-key consumption and file restoration.
- 7 isolated HTTP checks passed: cookie login, role rejection, foreign-origin/request verification, password-session invalidation, recovery replay rejection and frontend/API routing.
- 87 ML tests passed, including numerical FedAvg, dataset validation, split isolation, training and prediction. One existing Starlette/httpx deprecation warning remains.
- Total: **140 automated checks passed**. Both frontend and API production builds passed.

## Actual application rehearsal

The following was exercised through the local application's browser-facing `/api/v1` proxy, using the existing researcher test account and public PIMA data. This was an API rehearsal, not a new browser recording.

- Frontend, API, Neon and ML readiness succeeded.
- Cookie login/profile and validated 768-record dataset retrieval succeeded.
- Experiment: `0c76be8e-b3cd-4116-9a4e-f616d77c185f` (`Final guide rehearsal - four hospitals - 28 Nov 2026`).
- Method: FedAvg logistic regression, four IID simulated hospitals, 20 rounds, 5 local epochs, learning rate 0.1, batch size 32, seed 42, balanced classes, no added noise or automatic tuning.
- Split: 491 train / 123 validation / 154 final test records. Hospital training counts: 123 / 123 / 123 / 122.
- Reconstructed every parameter in every recorded round from client deltas and sample counts. Maximum floating-point error: `2.220446049250313e-16`.
- Registered and activated model `fedavg_20261128_075012_7b3c24`, version `v1.0_20261128_075012`.
- Final test accuracy: 73.3766%; recall: 70.3704%; ROC-AUC: 0.813519. This is one reproducible demonstration run, not independent evidence of clinical validity or generalization.
- Submitted the two built-in synthetic examples. Returned probabilities were 0.045023 and 0.942440. Both predictions used this exact FedAvg model ID, version and method.
- Signed out and signed in again; retrieved each assessment and verified its stored model and probability matched.
- Full local evidence is saved at `artifacts/final-rehearsal-2026-11-28.json` (gitignored; no live-user credentials included).

## Startup fixes verified

- ML startup now waits for an HTTP health response for up to 120 seconds instead of assuming a listening port within 30 seconds is sufficient.
- An unrelated application occupied port 3001. It was left running. The demo launcher selected port 3002 and configured Vite's proxy to match.
- `scripts/start-demo.cmd` is the normal local entry point. It reuses an existing FedHealth API, otherwise selects a free port in 3001-3010, and checks API/database/ML readiness before reporting success.
- Only this checkout's verified Vite process may be restarted when its proxy is stale. Vite uses a strict frontend port instead of silently moving away from 5173.
- Re-running the launcher succeeded with unchanged listener process IDs; no duplicate services or changes to the unrelated server occurred.
- The local application still needs internet for Neon. Starting the app ahead of the presentation is recommended; a cold start can take time on this machine.

## Guide walkthrough

1. Double-click `scripts/start-demo.cmd`; wait for `READY`, then open `http://127.0.0.1:5173/` and sign in to the research account.
2. Show the labeled dataset and its validation. Open the verified experiment above through Previous training runs, or use `/experiments/0c76be8e-b3cd-4116-9a4e-f616d77c185f`.
3. Show Hospital distribution, then Round evidence. Inspect round 1's shared starting parameter, four local deltas, sample-weighted change and updated global parameter. Round 2 begins with the previous global result.
4. Explain that models learn from supplied records; models do not collect the data. The averaging function receives parameter changes and counts, not patient rows.
5. Show the model version, make an assessment with a synthetic sample and retrieve it from history. Keep the FedAvg model active for this walkthrough; the separate Random Forest baseline is centralized.
6. If running a new experiment live, choose Federated hospital model, select the CSV, set Hospitals to 4 under Advanced settings, then start training. Saved evidence is explicitly labeled as saved when used as a fallback.

## Offline file backup

A local backup is generated at `tmp/demo-backup-2026-11-28.zip` and an extracted folder with the same name. Open `OPEN-SAVED-EVIDENCE.html` for all 20 recorded rounds without a server or external assets. Its heading explicitly says saved evidence, not live training.

The archive includes recorded aggregate evidence, the matching public CSV, model pipeline/metadata, a README and SHA-256 checksums. The CSV's training fingerprint was matched against the pipeline metadata; archive integrity and every checksum were verified. It excludes `.env`, credentials, account records and a database dump. This is a file/evidence backup; a complete database restore has not been rehearsed.

To export another verified run with the ML virtual environment:

```powershell
.\backend\ml-service\.venv\Scripts\python.exe .\scripts\export_demo_backup.py --evidence artifacts/final-rehearsal-2026-11-28.json --output tmp/a-new-backup-name
```

Existing backup paths are never overwritten. Keep a copy of the ZIP outside this machine before presenting.

## Remaining boundaries

- Clients are logical partitions of one public dataset in one Python process; preprocessing uses pooled training records. This is not four independently connected hospitals, secure aggregation or certified differential privacy.
- Predictions are research estimates with no established clinical validity.
- Queued jobs survive API restarts; interrupted running jobs fail explicitly. Only queued creator-owned jobs can be cancelled; changing status does not terminate running Python computation.
- The local profile uses filesystem artifacts. The free staging profile uses database-backed files and has isolated restoration tests, but real Render restart behavior remains a deployment acceptance check.
- Render account/sign-in is still unavailable. Public URL, HTTPS deployment, actual Linux Docker execution, hosted resource limits and a complete database restore remain unverified. Follow `FREE_STAGING.md` after account setup.
