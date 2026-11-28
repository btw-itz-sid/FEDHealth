import { BadRequestException } from '@nestjs/common';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';

export function modelDirectory(modelId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(modelId)) throw new BadRequestException('Invalid model identifier');
  return join(resolve(process.env.MODEL_ARTIFACT_DIR || '../../backend/ml-service/models'), modelId);
}

export async function writeAtomically(path: string, content: Buffer | string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.restoring`;
  await writeFile(temporary, content, { mode: 0o600 });
  await rename(temporary, path);
}

export async function readModelArtifacts(modelId: string) {
  const directory = modelDirectory(modelId);
  const bytes = await readFile(join(directory, 'pipeline.joblib'));
  if (bytes.length > 10 * 1024 * 1024) throw new BadRequestException('Model exceeds the 10 MB staging storage limit');
  const metadata = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'));
  if (metadata.model_id !== modelId || metadata.status !== 'ready') throw new BadRequestException('Model metadata is not ready or does not match');
  return { bytes, metadata };
}
