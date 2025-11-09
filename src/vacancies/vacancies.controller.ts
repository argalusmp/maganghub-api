import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchVacanciesDto } from './dto/search-vacancies.dto';
import { VacanciesService } from './vacancies.service';

@ApiTags('Vacancies')
@Controller()
export class VacanciesController {
  constructor(private readonly vacanciesService: VacanciesService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search internships',
    description: 'Full-text search with province/location, jenjang/prodi, status, and sort filters.',
  })
  search(@Query() dto: SearchVacanciesDto) {
    return this.vacanciesService.search(dto);
  }

  @Get('vacancies/:id')
  @ApiOperation({ summary: 'Get vacancy detail' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vacanciesService.findById(id);
  }
}
