export interface EtlConfig {
  fullCron: string;
  incrementalCron: string;
  maxPages: number;
  limit: number;
  newWindowHours: number;
  requestDelayMs: number;
  stopThreshold: number;
  httpTimeoutMs: number;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  timezone: string;
  databaseUrl: string;
  maganghubBase: string;
  frontendOrigin: string;
  saweriaSecretToken: string;
  etl: EtlConfig;
}
