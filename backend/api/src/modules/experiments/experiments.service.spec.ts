import { ExperimentsService } from './experiments.service';
import { PartitionType, TrainingMethod } from './entities/experiment.entity';
import { DatasetStatus } from '../datasets/entities/dataset.entity';

describe('Experiment optimization routing', () => {
  const datasetRepository = { findOne: jest.fn() };
  const config = { get: (_key: string, fallback: string) => fallback };
  const service = new ExperimentsService({} as any, {} as any,
    datasetRepository as any, config as any, {} as any, {} as any);

  it('passes automatic selection to the centralized prediction route', () => {
    const request = (service as any).buildTrainingRequest({
      trainingMethod: TrainingMethod.CENTRALIZED, configSnapshot: { optimizeModel: true },
    }, 'diabetes.csv');
    expect(request.endpoint).toBe('/api/v1/ml/train/centralized');
    expect(request.body.optimize).toBe(true);
  });

  it('keeps existing federated benchmarks on the fixed protocol by default', () => {
    const request = (service as any).buildTrainingRequest({
      trainingMethod: TrainingMethod.FEDAVG, configSnapshot: null,
    }, 'diabetes.csv');
    expect(request.endpoint).toBe('/api/v1/ml/train/federated');
    expect(request.body.optimize).toBe(false);
  });

  it('rejects tuning local-only experiments before a job is queued', async () => {
    datasetRepository.findOne.mockResolvedValue({ status: DatasetStatus.VALID });
    await expect(service.create({ datasetId: 'dataset', name: 'invalid',
      trainingMethod: TrainingMethod.LOCAL_ONLY, partitionType: PartitionType.IID,
      optimizeModel: true }, 'user')).rejects.toThrow('Automatic tuning requires');
  });
});
