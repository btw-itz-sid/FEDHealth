import { ConfigService } from '@nestjs/config';

export function validateEnvironment(env: Record<string, unknown>) {
  if (!env.DATABASE_URL || !env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required');
  if (env.NODE_ENV === 'production') {
    const secret = String(env.JWT_SECRET);
    const key = String(env.ML_SERVICE_KEY || '');
    if (secret.length < 32 || /change|example|dev-secret|your-/i.test(secret)) {
      throw new Error('Production requires a unique JWT_SECRET of at least 32 characters');
    }
    if (key.length < 32 || key === secret) throw new Error('Production requires a separate ML_SERVICE_KEY of at least 32 characters');
    const origins = String(env.CORS_ORIGINS || '').split(',').map(value => value.trim());
    if (!origins.length || origins.some(origin => {
      try { const url = new URL(origin); return url.protocol !== 'https:' || url.origin !== origin; } catch { return true; }
    })) throw new Error('Production CORS_ORIGINS must contain explicit HTTPS origins');
    if (!env.ML_SERVICE_URL) throw new Error('ML_SERVICE_URL is required in production');
  }
  return env;
}

export function mlRequestOptions(config: ConfigService, timeoutMs = 30000): RequestInit {
  const key = config.get<string>('ML_SERVICE_KEY');
  return {
    headers: { 'Content-Type': 'application/json', ...(key ? { 'X-ML-Service-Key': key } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
  };
}
