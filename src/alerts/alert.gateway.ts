import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { SaweriaDonationPayload } from './interfaces/saweria-donation-payload.interface';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AlertGateway {
  private readonly logger = new Logger(AlertGateway.name);

  @WebSocketServer()
  private server?: Server;

  emitDonation(payload: SaweriaDonationPayload): void {
    if (!this.server) {
      this.logger.warn('Attempted to emit donation before the gateway was ready');
      return;
    }

    this.server.emit('newDonation', payload);
    this.logger.debug(`Broadcasted donation from ${payload.donator_name ?? 'unknown'}`);
  }
}

