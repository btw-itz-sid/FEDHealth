export interface ComparisonExperiment {
  datasetId: string;
  randomSeed: number;
  testSize: number;
  balanceClasses: boolean;
  finalMetrics?: {
    evaluation_protocol?: string;
    evaluation_manifest?: { splits?: { train?: { indices_sha256?: string } } };
  };
}

/** Do not silently compare different data or evaluation protocols. */
export function evaluationKey(exp: ComparisonExperiment): string {
  return JSON.stringify([
    exp.datasetId, exp.randomSeed, exp.testSize, !!exp.balanceClasses,
    exp.finalMetrics?.evaluation_protocol ?? 'legacy_train_test_v1',
    exp.finalMetrics?.evaluation_manifest?.splits?.train?.indices_sha256 ?? null,
  ]);
}
