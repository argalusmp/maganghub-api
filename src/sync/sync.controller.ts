import { Controller, Post } from '@nestjs/common';
import { SyncRunMetrics, SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('provinces')
  syncProvinces() {
    return this.syncService.syncProvinces();
  }

  @Post('incremental')
  runIncremental(): Promise<SyncRunMetrics> {
    return this.syncService.runIncrementalSync();
  }

  @Post('full')
  runFull(): Promise<SyncRunMetrics> {
    return this.syncService.runFullSync();
  }
}
