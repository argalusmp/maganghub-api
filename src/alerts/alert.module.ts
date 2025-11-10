import { Module } from '@nestjs/common';
import { AlertGateway } from './alert.gateway';
import { SaweriaWebhookController } from './saweria-webhook.controller';

@Module({
  controllers: [SaweriaWebhookController],
  providers: [AlertGateway],
  exports: [AlertGateway],
})
export class AlertModule {}

