import { PGlite } from '@electric-sql/pglite';
const { uuid_ossp } = require('@electric-sql/pglite/contrib/uuid_ossp');
import { QueryRunner, DataSource } from 'typeorm';
import { InitialSchema1795132800000 } from './migrations/1795132800000-InitialSchema';
import { LaunchPersistence1795219200000 } from './migrations/1795219200000-LaunchPersistence';
import { User } from '../modules/users/entities/user.entity';
import { Prediction } from '../modules/predictions/entities/prediction.entity';

describe('Fresh staging PostgreSQL schema', () => {
  let database: PGlite;
  let runner: QueryRunner;
  beforeAll(async () => {
    database = new PGlite({ extensions: { uuid_ossp } });
    await database.waitReady;
    runner = {
      query: async (sql: string, args?: unknown[]) => (await database.query(sql, args)).rows,
      hasTable: async (name: string) => (await database.query<{ present: boolean }>('SELECT to_regclass($1) IS NOT NULL AS present', [name])).rows[0].present,
    } as QueryRunner;
    await new InitialSchema1795132800000().up(runner);
    await new LaunchPersistence1795219200000().up(runner);
  }, 60000);
  afterAll(async () => { await database?.close(); });

  it('round-trips binary model files and metadata', async () => {
    const bytes = Buffer.from([0, 1, 255, 10, 0]);
    await database.query(`INSERT INTO ml_models ("modelId", "modelVersion", "modelType", "trainingMethod", "featureColumns", "artifactBytes", "artifactMetadata") VALUES ('model_one', 'v1', 'test', 'centralized', '[]', $1, $2)`, [bytes, JSON.stringify({ model_id: 'model_one', status: 'ready' })]);
    const model = (await database.query<{ artifactBytes: Uint8Array; artifactMetadata: any }>('SELECT "artifactBytes", "artifactMetadata" FROM ml_models')).rows[0];
    expect(Buffer.from(model.artifactBytes)).toEqual(bytes);
    expect(model.artifactMetadata.model_id).toBe('model_one');
  });

  it('rejects initial migration over an existing workspace', async () => {
    await expect(new InitialSchema1795132800000().up(runner)).rejects.toThrow('empty database');
  });

  it('builds valid PostgreSQL entity metadata for the hidden recovery hash', async () => {
    const source = new DataSource({ type: 'postgres', entities: [User, Prediction] });
    await (source as any).buildMetadatas();
    const column = source.getMetadata(User).findColumnWithPropertyName('recoveryCodeHash');
    expect(column?.type).toBe('varchar');
    expect(column?.isSelect).toBe(false);
  });
});
