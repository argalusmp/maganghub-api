import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, EtlConfig } from './config.interface';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  get nodeEnv(): string {
    return this.configService.get('nodeEnv', { infer: true });
  }

  get port(): number {
    return this.configService.get('port', { infer: true });
  }

  get timezone(): string {
    return this.configService.get('timezone', { infer: true });
  }

  get databaseUrl(): string {
    return this.configService.get('databaseUrl', { infer: true });
  }

  get maganghubBase(): string {
    return this.configService.get('maganghubBase', { infer: true });
  }

  get frontendOrigin(): string {
    return this.configService.get('frontendOrigin', { infer: true });
  }

  get etl(): EtlConfig {
    return this.configService.get('etl', { infer: true });
  }
}
