import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelsService } from './models.service';
import { ModelStatus } from './entities/ml-model.entity';

describe('Model activation artifact checks', () => {
  const model = { id: 'model-record', modelId: 'fedavg_demo', status: ModelStatus.READY };
  let service: ModelsService;
  let transaction: jest.Mock;
  let update: jest.Mock;
  let log: jest.Mock;

  beforeEach(() => {
    update = jest.fn().mockResolvedValue({ affected: 1 });
    transaction = jest.fn(async (work) => work({ update }));
    log = jest.fn();
    service = new ModelsService(
      { findOne: jest.fn().mockResolvedValue(model) } as any,
      { transaction } as any, new ConfigService(), { log } as any,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('preserves the active model when the requested artifact is absent', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ models: [] }),
    } as Response);
    await expect(service.activate(model.id, 'researcher')).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('preserves the active model when the ML service is unreachable', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));
    await expect(service.activate(model.id, 'researcher')).rejects.toThrow(ServiceUnavailableException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a failed or malformed model listing without changing activation', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
      fetch.mockResolvedValue(response as Response);
      await expect(service.activate(model.id, 'researcher')).rejects.toThrow(ServiceUnavailableException);
    }
    expect(transaction).not.toHaveBeenCalled();
  });

  it('activates an available model atomically and records the audit event', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ models: [{ model_id: model.modelId }] }),
    } as Response);
    const result = await service.activate(model.id, 'researcher');
    expect(result.isActive).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ resourceId: model.id, userId: 'researcher' }));
  });
});
