import { AppConfig } from './config.interface';

type NumericKeys =
  | 'PORT'
  | 'ETL_MAX_PAGES'
  | 'ETL_LIMIT'
  | 'NEW_WINDOW_HOURS'
  | 'REQUEST_DELAY_MS'
  | 'STOP_THRESHOLD';

type Env = NodeJS.ProcessEnv & Partial<Record<NumericKeys, string>>;

const toNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const configuration = (): AppConfig => {
  const env = process.env as Env;

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: toNumber(env.PORT, 3000),
    timezone: env.TZ ?? 'Asia/Jakarta',
    databaseUrl: env.DATABASE_URL ?? '',
    maganghubBase: env.MAGANGHUB_BASE ?? 'https://maganghub.kemnaker.go.id/be/v1/api',
    frontendOrigin: env.FRONTEND_ORIGIN ?? '*',
    saweriaSecretToken: env.SAWERIA_SECRET_TOKEN ?? '',
    etl: {
      fullCron: env.ETL_FULL_CRON ?? '0 2 * * *',
      incrementalCron: env.ETL_INC_CRON ?? '0 * * * *',
      maxPages: toNumber(env.ETL_MAX_PAGES, 3),
      limit: toNumber(env.ETL_LIMIT, 50),
      newWindowHours: toNumber(env.NEW_WINDOW_HOURS, 72),
      requestDelayMs: toNumber(env.REQUEST_DELAY_MS, 800),
      stopThreshold: toNumber(env.STOP_THRESHOLD, 10),
    },
  };
};
