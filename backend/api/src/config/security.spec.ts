import { ConfigService } from '@nestjs/config';
import { mlRequestOptions, validateEnvironment } from './security';

describe('Production configuration', () => {
  const environment = { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/research', JWT_SECRET: 'a'.repeat(40), ML_SERVICE_KEY: 'b'.repeat(40), ML_SERVICE_URL: 'http://ml:8000', CORS_ORIGINS: 'https://research.example.org' };
  it('requires secrets, private service authentication and explicit HTTPS origins', () => {
    expect(validateEnvironment(environment)).toBe(environment);
    for (const override of [{ JWT_SECRET: '' }, { ML_SERVICE_KEY: '' }, { ML_SERVICE_KEY: environment.JWT_SECRET }, { CORS_ORIGINS: '*' }, { CORS_ORIGINS: 'http://research.example.org' }, { ML_SERVICE_URL: '' }]) {
      expect(() => validateEnvironment({ ...environment, ...override })).toThrow();
    }
  });
  it('authenticates internal calls and always bounds their duration', () => {
    const options = mlRequestOptions(new ConfigService({ ML_SERVICE_KEY: 'test-only-key' }), 1000);
    expect(options.headers).toMatchObject({ 'X-ML-Service-Key': 'test-only-key' });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});
