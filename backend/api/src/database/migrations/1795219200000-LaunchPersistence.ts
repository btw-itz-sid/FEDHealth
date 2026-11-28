import { MigrationInterface, QueryRunner } from 'typeorm';

export class LaunchPersistence1795219200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "recoveryCodeHash" character varying');
    await queryRunner.query('ALTER TABLE "datasets" ADD COLUMN IF NOT EXISTS "csvBytes" bytea');
    await queryRunner.query('ALTER TABLE "ml_models" ADD COLUMN IF NOT EXISTS "artifactBytes" bytea');
    await queryRunner.query('ALTER TABLE "ml_models" ADD COLUMN IF NOT EXISTS "artifactMetadata" jsonb');
  }
  async down(): Promise<void> {
    throw new Error('This rollback would delete saved recovery information and artifacts. Restore a verified backup instead.');
  }
}
