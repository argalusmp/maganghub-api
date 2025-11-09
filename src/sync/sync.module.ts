import { Module } from '@nestjs/common';
import { HttpClientModule } from '../common/http/http.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [HttpClientModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
