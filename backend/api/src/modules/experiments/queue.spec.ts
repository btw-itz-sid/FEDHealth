import { ConfigService } from '@nestjs/config';
import { ExperimentsService } from './experiments.service';
import { ExperimentStatus } from './entities/experiment.entity';

describe('Persistent training queue', () => {
  let service: ExperimentsService;
  const repository = { findOne: jest.fn(), update: jest.fn() };
  const audit = { log: jest.fn() };
  beforeEach(() => {
    jest.useFakeTimers(); jest.clearAllMocks();
    service = new ExperimentsService(repository as any, {} as any, {} as any, new ConfigService(), audit as any, {} as any);
  });
  afterEach(() => { service.onModuleDestroy(); jest.useRealTimers(); });
  it('marks interrupted running jobs failed on startup', async () => {
    await service.onModuleInit();
    expect(repository.update).toHaveBeenCalledWith({ status: ExperimentStatus.RUNNING }, expect.objectContaining({ status: ExperimentStatus.FAILED }));
  });
  it('does not claim that cancelling a running job stops ML computation', async () => {
    repository.findOne.mockResolvedValue({ createdBy: 'owner', status: ExperimentStatus.RUNNING });
    await expect(service.cancel('id', 'owner')).rejects.toThrow('Only queued');
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('rejects cancelling another researcher run', async () => {
    repository.findOne.mockResolvedValue({ createdBy: 'owner', status: ExperimentStatus.QUEUED });
    await expect(service.cancel('id', 'other')).rejects.toThrow('Only the creator');
  });
  it('handles a queued job starting at the same time as cancellation', async () => {
    repository.findOne.mockResolvedValue({ createdBy: 'owner', status: ExperimentStatus.QUEUED });
    repository.update.mockResolvedValue({ affected: 0 });
    await expect(service.cancel('id', 'owner')).rejects.toThrow('already started');
    expect(audit.log).not.toHaveBeenCalled();
  });
});
