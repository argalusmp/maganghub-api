import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { AlertGateway } from './alert.gateway';
import type { SaweriaDonationPayload } from './interfaces/saweria-donation-payload.interface';

@Controller('webhook')
export class SaweriaWebhookController {
  constructor(
    private readonly alertGateway: AlertGateway,
    private readonly configService: AppConfigService,
  ) {}

  @Post('saweria/:secretToken')
  handleSaweriaWebhook(
    @Param('secretToken') secretToken: string,
    @Body() payload: SaweriaDonationPayload,
  ): { status: string } {
    if (
      !secretToken ||
      secretToken !== (this.configService.saweriaSecretToken ?? '')
    ) {
      throw new UnauthorizedException('Invalid secret token');
    }

    if (!this.isValidPayload(payload)) {
      throw new BadRequestException('Invalid Saweria payload');
    }

    this.alertGateway.emitDonation(payload);
    return { status: 'ok' };
  }

  private isValidPayload(
    payload: SaweriaDonationPayload | undefined,
  ): payload is SaweriaDonationPayload {
    if (!payload || payload.type !== 'donation') {
      return false;
    }

    return (
      typeof payload.donator_name === 'string' &&
      payload.donator_name.trim().length > 0
    );
  }
}
