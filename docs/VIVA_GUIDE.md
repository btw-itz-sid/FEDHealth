# FedHealth — application demo and viva guide

Use this alongside the working app. Report and PPT preparation are handled separately.

**Current serving model:** the accuracy-focused follow-up added a separately labeled centralized Random Forest prediction baseline. It is active for assessments at 75.97% test accuracy on seed 42. The original FedAvg proof is still 72.73%, with its original nine-parameter trace. Do not describe the Random Forest as FedAvg. See `MODEL_IMPROVEMENT.md` for methods, different development-training budgets and exploratory-evaluation limits.

## Your opening explanation (about 45 seconds)

“FedHealth ek research application hai jo diabetes prediction ke liye federated learning demonstrate karti hai. Hospitals ke datasets ko ek shared database mein daalne ki jagah, har hospital common starting model ki copy apne local records par train karta hai. Model patient data store nahi karta; uske coefficients local data se update hote hain. Central FedAvg function ko sirf coefficient changes aur sample counts milte hain. Woh sample-weighted average se global model update karta hai, jo next round mein sab clients ko wapas milta hai. Mere project mein hospitals public PIMA dataset ke simulated partitions hain.”

## The teacher's exact doubt: random models se data kaise aa raha hai?

**Say:** “Starting model data se nahi aata. Hum logistic regression ka structure define karke uske 8 weights aur bias ko zero initialize karte hain. Is stage par probability 0.5 hai; model ne kuch seekha nahi hai. Har hospital ko same model copy milti hai. Hospital ka trainer apne X features aur known y labels se prediction error calculate karta hai. Gradient descent se weights change hote hain. FedAvg ko patient X/y nahi milte; learned changes milte hain.”

If asked why not random: this implementation uses zero initialization, which works for a linear logistic regression model. Do not generalize zero initialization to neural networks with hidden-unit symmetry. The random seed controls splits, partitions, batch ordering and optional noise; it is not a source of patient records.

## Show this sequence in the application (5–7 minutes)

1. **Datasets → Train model.** Show the labeled CSV and its input summary. Explain that each hospital partition contains features plus known Outcome labels, and that the aggregator receives parameter deltas and counts.
2. **Starting model (explain using the architecture notes).** Use the one-feature SGD calculation. Explain x = 2, y = 1, initial p = 0.5: local update gives w = 0.1 and b = 0.05. State these are illustrative numbers.
3. **Results → completed FedAvg run → round evidence.** Select `ETE architecture proof - FedAvg IID v2` or a newer completed plain FedAvg run. Show round 1 with all-zero starting parameters, Glucose updates and the sample-weighted sum. Show the “All 9 parameters verified” result.
4. **Switch to round 2.** The starting value now equals round 1's global result. This is a repeated shared-model update, not unrelated hospital models trained once and averaged arbitrarily. Inspect bias as well as a feature.
5. **Inspect the payload.** Expand one hospital's JSON. Point to nine deltas and a count. There are no patient rows. Export the trace if the examiner wants numerical evidence.
6. **Experiment detail → Results & configuration / Round evidence.** Show 491 train / 123 validation / 154 test records and the split hashes. Curves use validation; the final test card is evaluated after training. Explain recall and false negatives as well as accuracy.
7. **Compare.** Choose matching new-protocol centralized, FedAvg and local-only runs. Compare IID/non-IID and explain any noise experiments. Mixed legacy/new runs show a warning; do not present those as a controlled comparison.
8. **New assessment.** Check the active method and version. It currently serves the centralized Random Forest baseline; the federated experiment is the separately labeled collaboration demonstration. Use an app sample and show the estimate and matching history entry. Predictions are research estimates.

## A verified application run

Created on 20 November 2026 through the browser: `ETE architecture proof - FedAvg IID v2`, balanced, seed 42, 5 clients, 10 rounds, 5 local epochs, learning rate 0.1, no noise.

- Split: 491 / 123 / 154.
- Round 1 Glucose starts at 0. The sample-weighted deltas produce **0.346145** (display rounded to six decimals).
- The browser reconstructed all nine parameters with maximum error **0.00e+0**.
- Final test accuracy: **72.73%**; recall **0.7222**; F1 **0.6500**; ROC-AUC **0.8126**.

Use the exact selected run's live values during the viva. Different seeds, settings and legacy protocols produce different results. The CLI benchmark results in `RESEARCH_NOTES.md` summarize multiple seeds rather than this single run.

## Questions and short answers

**Does the model take data from another model?** No. A local trainer takes feature rows and labels from its own partition. A model supplies starting coefficients. The aggregator takes numeric updates from trainers.

**Where do the first weights come from?** The coordinator creates zero coefficients and bias. This requires the feature schema, not training examples.

**Why do all hospitals start from the same model?** Their updates must refer to the same parameter vector, feature order and preprocessing. Otherwise averaging has no consistent meaning.

**What is the FedAvg formula?** `theta_new = theta_old + sum(n_k/N * delta_k)`. The bias is included. This is equivalent to averaging local parameter vectors when all clients share the same starting vector.

**Why weight by sample count?** It makes each client's contribution proportional to its number of training examples. Equal hospital weighting is a different aggregation rule.

**Is the count itself data?** It is dataset metadata. The claim is that patient rows are excluded from the aggregation contract, not that every possible fact about the dataset is hidden.

**Do hospital models have to be neural networks?** No. FedAvg averages compatible parameter vectors. Here the model is an eight-feature logistic classifier trained locally by SGD.

**Why non-IID?** Hospitals can have different class distributions. This simulator uses Dirichlet label skew, not separate real hospitals. Local-only measures what happens without shared updates.

**Are weights perfectly private?** No. They can leak information. The seeded clipping/noise option demonstrates a noise–utility tradeoff; it is not certified patient-level differential privacy. Secure aggregation is not implemented.

**What does 72 bytes mean?** Nine float64 parameters × eight bytes. It excludes JSON, counts, diagnostics, traces and real transport overhead. Communication is simulated, not measured network traffic.

**What is actually distributed?** Local data partitions and update contracts are logically separate. All simulated clients execute in one Python service. Real multi-machine hospitals and decentralized preprocessing are future work.

**Where does shared scaling come from?** It is fitted on the pooled training split in this public-data simulator. State this assumption instead of claiming preprocessing is fully federated.

**Why three splits?** Training learns coefficients; validation monitors rounds; final test estimates generalization after the training schedule. All comparison methods share the same split for a seed.

**Why does accuracy change between runs?** Splits, client skew and batch order depend on the seed. Repeated seeds expose variability. Do not promise a particular score on every split.

**Can patients use this for diagnosis?** No. It is a research demonstration with a small, population-specific public dataset and no clinical validation.

**What if the API restarts mid-training?** The current job dispatch is in memory and has no durable restart recovery. A production design would add persistent jobs and cooperative cancellation. This is an explicit deployment limitation.

## Before 29 November

- Run both start scripts and check the dataset upload, login, experiment and prediction paths.
- Keep at least one completed plain FedAvg v2 run ready for the numerical explanation.
- Keep matching completed v2 comparison runs; avoid waiting for training during the viva.
- Verify the selected active model exists on disk; model records and model files are separate.
- Export the proof run JSON and round trace as local backup evidence.
- Rehearse the first two answers above until you can explain them without reading.
- Rehearse once with the network available and once with an exported-results backup. The app database is Neon and needs connectivity; this is not a fully offline application.
