import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: '.env' });
config({ path: '../../.env' });
process.env.TZ = 'UTC';

export function databaseConnection(url: string) {
  const parsed = new URL(url);
  // pg connection-string SSL flags override the explicit TLS object. Keep one
  // verified TLS policy for Neon instead of silently accepting any certificate.
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) parsed.searchParams.delete(parameter);
  return { url: parsed.toString(), ssl: { rejectUnauthorized: true } };
}

export default new DataSource({
  type: 'postgres',
  ...databaseConnection(process.env.DATABASE_URL || 'postgresql://localhost/fedhealth'),
  entities: [join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  migrationsRun: false,
});
