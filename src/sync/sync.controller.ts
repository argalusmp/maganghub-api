import {
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
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
  @HttpCode(HttpStatus.ACCEPTED)
  triggerFull() {
    return this.syncService.startFullSyncAsync();
  }

  @Post('full/blocking')
  runFullBlocking(): Promise<SyncRunMetrics> {
    return this.syncService.runFullSync();
  }

  @Get('full/status')
  getFullStatus() {
    return this.syncService.getActiveFullSyncStatus();
  }

  @Get('runs')
  listRuns(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.syncService.listRecentRuns(limit);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) {
    return this.syncService.getRunById(id);
  }
}
