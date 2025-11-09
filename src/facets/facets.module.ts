import { Module } from '@nestjs/common';
import { FacetsController } from './facets.controller';
import { FacetsService } from './facets.service';

@Module({
  controllers: [FacetsController],
  providers: [FacetsService],
})
export class FacetsModule {}
