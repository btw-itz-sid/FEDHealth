# Workspace redesign — 20 November 2026

## Public application follow-up

The earlier presentation/walkthrough and page-explanation drawers below are historical. The live product no longer routes to them. Normal navigation now contains assessments and history; approved researchers also see training and results, with datasets and models under Advanced tools. Dataset selection is mandatory, and its summary explains labeled rows, eight measurements, Outcome and the FedAvg update boundary. Public signup creates personal accounts; administrator approval grants research access. Login now uses HttpOnly cookie sessions. See `DEPLOYMENT.md` for deployment scope and outstanding staging checks.

## Earlier design verification

The existing React application has been redesigned in place. White cards, a warm neutral background, dark navy actions and restrained chart accents replace the previous mixed visual styles. The redesign covers login, registration, role-aware navigation, overview, architecture, datasets, experiments, comparisons, model registry, assessments, history, account settings and administration.

## The demonstration route

Open **Project walkthrough** (`/presentation`) to practice three steps: the learning loop, the evidence and the assessment. Each stop explains what to demonstrate and includes expandable Hinglish practice notes. **Explain this page** opens a contextual drawer on every workspace page.

For the teacher's architecture question, open **Architecture lab**, select an actual completed FedAvg run, and inspect round one. The common model starts with eight zero coefficients and a zero bias. Hospital training uses local features and labels; the aggregation boundary receives sample counts and parameter deltas. The browser independently reconstructs all nine aggregated parameters. Round two starts from round one's result. The app explicitly identifies this as a single-process public-data simulation with pooled training preprocessing.

The experiment detail now separates results/configuration, round evidence and hospital distribution. Experiment and model libraries hide legacy evaluations by default when modern results exist, while preserving a visible legacy toggle. The comparison selector is searchable and bounded in height.

## Authentication decision

Email/password authentication remains connected to the existing JWT API. No Google button is displayed because the project has no configured OAuth client and the user chose working email sign-in. Login and registration have explicit labels, autocomplete, password visibility controls, loading states and server errors. No credentials or client secrets were added to the frontend.

## Data decision

See [the incoming dataset audit](DATASET_AUDIT.md). All four supplied archives were inspected without executing their contents. No new CSV was silently merged, and no active model was retrained on an undocumented schema. In particular, the 172,291-row file has only 5,001 unique rows; the 50,000-row file requires a separate target, feature contract and prediction form.

## Verification

- Production TypeScript/Vite build passed. Route loading reduces the initial JavaScript bundle from approximately 694 KB to 197 KB; charts load when required.
- Desktop views inspected at 1440 × 1000; mobile views inspected at 390 × 844. Overview, datasets, walkthrough, architecture, model registry and experiment evidence had no horizontal document overflow in these checks. Wide evidence tables retain their own horizontal scrolling.
- Empty assessment validation marked and focused the first invalid field. The built-in lower-risk sample produced a live 4.9% estimate through the active FedAvg model, with version `v1.0_20261120_114234`. The new entry appeared in the researcher's history.
- The contextual explanation drawer opened, closed with Escape and returned focus. Mobile navigation opened and closed on route changes; closed navigation is hidden from keyboard focus.
- Preset selection changed the experiment builder to centralized mode and removed hospital controls. Selecting completed matching experiments opened comparison with real final metrics and findings.
- Actual FedAvg round evidence verified all nine parameters with maximum reconstruction error zero. Round two began with round one's Glucose coefficient, 0.346145.
- Model search displayed its empty state correctly. Registration's role selector and password visibility control were checked without creating an account. Login displayed an API error for an invalid demo password.
- Existing patient, researcher and administrator email logins succeeded. Patient navigation excluded research/admin tools, and direct navigation to a research route returned to the personal overview. Account settings rendered with no password change performed. Administrator search narrowed the account list and audit events loaded; no roles or account access were changed.

These are local development checks, not a production deployment or a clinical validation. Database connectivity and retained ML model files are still required. Report and slides remain outside this application's scope.

The later simplicity follow-up reduces the home flow to Train model, Results and Assessment; advanced tools, settings, previous runs and detailed comparisons are collapsed. The walkthrough now has three steps. `MODEL_IMPROVEMENT.md` records the new centralized serving model and the current 73 ML / 10 API regression checks.
