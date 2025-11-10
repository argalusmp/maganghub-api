import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { configuration } from './configuration';
import { AppConfigService } from './app-config.service';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().default('development'),
        PORT: Joi.number().default(3000),
        TZ: Joi.string().default('Asia/Jakarta'),
        DATABASE_URL: Joi.string().uri().allow('').default(''),
        DIRECT_URL: Joi.string().uri().allow('').default(''),
        MAGANGHUB_BASE: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .default('https://maganghub.kemnaker.go.id/be/v1/api'),
        FRONTEND_ORIGIN: Joi.string().default('*'),
        ETL_FULL_CRON: Joi.string().default('0 2 * * *'),
        ETL_INC_CRON: Joi.string().default('0 * * * *'),
        ETL_MAX_PAGES: Joi.number().integer().min(1).default(3),
        ETL_LIMIT: Joi.number().integer().min(1).max(200).default(50),
        NEW_WINDOW_HOURS: Joi.number().integer().min(1).default(72),
        REQUEST_DELAY_MS: Joi.number().integer().min(0).default(800),
        STOP_THRESHOLD: Joi.number().integer().min(1).default(10),
        SAWERIA_SECRET_TOKEN: Joi.string().default(''),
      }),
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
