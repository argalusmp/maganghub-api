import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { FacetsService } from './facets.service';

@Controller('facets')
export class FacetsController {
  constructor(private readonly facetsService: FacetsService) {}

  @Get('provinces')
  getProvinces() {
    return this.facetsService.getProvinces();
  }

  @Get('kabupaten')
  getKabupaten(@Query('kode_provinsi') kodeProvinsi?: string) {
    if (!kodeProvinsi) {
      throw new BadRequestException('kode_provinsi is required');
    }
    return this.facetsService.getKabupaten(kodeProvinsi);
  }
}
