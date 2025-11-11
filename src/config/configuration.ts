import { AppConfig } from './config.interface';

type NumericKeys =
  | 'PORT'
  | 'ETL_MAX_PAGES'
  | 'ETL_LIMIT'
  | 'NEW_WINDOW_HOURS'
  | 'REQUEST_DELAY_MS'
  | 'STOP_THRESHOLD'
  | 'HTTP_TIMEOUT_MS'
  | 'HTTP_MAX_RETRIES'
  | 'HTTP_RETRY_DELAY_MS';

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
      fullCron: env.ETL_FULL_CRON ?? '0 3 * * *',
      incrementalCron: env.ETL_INC_CRON ?? '0 */2 * * *',
      maxPages: toNumber(env.ETL_MAX_PAGES, 3),
      limit: toNumber(env.ETL_LIMIT, 50),
      newWindowHours: toNumber(env.NEW_WINDOW_HOURS, 72),
      requestDelayMs: toNumber(env.REQUEST_DELAY_MS, 800),
      stopThreshold: toNumber(env.STOP_THRESHOLD, 100),
      httpTimeoutMs: toNumber(env.HTTP_TIMEOUT_MS, 60_000),
      maxRetries: toNumber(env.HTTP_MAX_RETRIES, 3),
      retryDelayMs: toNumber(env.HTTP_RETRY_DELAY_MS, 2000),
    },
  };
};
