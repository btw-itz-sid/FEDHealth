import { mkdtemp, readFile, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ModelsService } from '../modules/models/models.service';
import { DatasetsService } from '../modules/datasets/datasets.service';
import { DatasetStatus } from '../modules/datasets/entities/dataset.entity';
import { readModelArtifacts, modelDirectory } from './persistent-files';

describe('Restore persistent research files after a restart', () => {
  let directory: string;
  let previous: NodeJS.ProcessEnv;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'fedhealth-restore-'));
    previous = { ...process.env };
    process.env.MODEL_ARTIFACT_DIR = join(directory, 'models');
    process.env.DATASET_UPLOAD_DIR = join(directory, 'uploads');
  });
  afterEach(async () => { process.env = previous; await rm(directory, { recursive: true, force: true }); });
  function stored(rows: any[]) {
    const query: any = { getMany: jest.fn(async () => rows) };
    query.addSelect = jest.fn(() => query); query.where = jest.fn(() => query);
    return { createQueryBuilder: () => query, update: jest.fn() };
  }
  it('restores model bytes and metadata into an empty filesystem', async () => {
    const bytes = Buffer.from([0, 255, 40]);
    const metadata = { model_id: 'restored_model', status: 'ready' };
    const repository = stored([{ modelId: metadata.model_id, artifactBytes: bytes, artifactMetadata: metadata }]);
    const service = new ModelsService(repository as any, {} as any, new ConfigService({ ARTIFACT_STORAGE: 'database' }), {} as any);
    await service.onModuleInit();
    expect(await readModelArtifacts(metadata.model_id)).toEqual({ bytes, metadata });
  });
  it('restores CSV contents and replaces the old machine-specific filepath', async () => {
    const bytes = Buffer.from('Glucose,Outcome\n100,0\n');
    const repository = stored([{ id: 'dataset-one', csvBytes: bytes, status: DatasetStatus.VALID }]);
    const service = new DatasetsService(repository as any, new ConfigService({ ARTIFACT_STORAGE: 'database' }), {} as any);
    await service.onModuleInit();
    const filepath = join(process.env.DATASET_UPLOAD_DIR!, 'dataset-one.csv');
    expect(await readFile(filepath)).toEqual(bytes);
    expect(repository.update).toHaveBeenCalledWith('dataset-one', { filepath });
  });
  it('rejects path traversal and mismatched model metadata', async () => {
    expect(() => modelDirectory('../outside')).toThrow('Invalid model');
    const path = modelDirectory('test_model'); await mkdir(path, { recursive: true });
    await writeFile(join(path, 'pipeline.joblib'), 'test-only');
    await writeFile(join(path, 'metadata.json'), JSON.stringify({ model_id: 'different', status: 'ready' }));
    await expect(readModelArtifacts('test_model')).rejects.toThrow('does not match');
  });
});
