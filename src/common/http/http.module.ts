import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        baseURL: config.maganghubBase,
        timeout: config.etl.httpTimeoutMs,
      }),
    }),
  ],
  exports: [HttpModule],
})
export class HttpClientModule {}
