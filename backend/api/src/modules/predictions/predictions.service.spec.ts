import { PredictionsService } from './predictions.service';
import { ConfigService } from '@nestjs/config';

describe('Assessment model selection', () => {
  let service: PredictionsService;
  const models = { getActive: jest.fn() };
  beforeEach(() => { service = new PredictionsService({} as any, new ConfigService(), {} as any, models as any); });
  afterEach(() => jest.restoreAllMocks());
  it('fails closed instead of silently loading the latest filesystem model', async () => {
    models.getActive.mockResolvedValue(null);
    const fetch = jest.spyOn(global, 'fetch');
    await expect(service.create({} as any, 'user')).rejects.toThrow('no active model');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('prevents bypassing the active model with an arbitrary model identifier', async () => {
    models.getActive.mockResolvedValue({ modelId: 'approved', status: 'ready' });
    const fetch = jest.spyOn(global, 'fetch');
    await expect(service.create({ modelId: '../unregistered' } as any, 'user')).rejects.toThrow('current active model');
    expect(fetch).not.toHaveBeenCalled();
  });
});
