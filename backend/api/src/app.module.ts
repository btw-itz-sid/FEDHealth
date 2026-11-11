import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { ExperimentsModule } from './modules/experiments/experiments.module';
import { ModelsModule } from './modules/models/models.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Environment config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // Database — Neon PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        ssl: { rejectUnauthorized: false },
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development',
        logging: config.get('NODE_ENV') === 'development' ? ['error', 'warn'] : ['error'],
        // Each new TLS connection to Neon costs several round trips, so keep idle
        // connections open instead of the node-postgres default of 10 s.
        extra: {
          max: 10,
          idleTimeoutMillis: 10 * 60 * 1000,
          keepAlive: true,
          connectionTimeoutMillis: 15000,
        },
      }),
    }),

    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Feature modules
    AuthModule,
    UsersModule,
    PredictionsModule,
    DatasetsModule,
    ExperimentsModule,
    ModelsModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
