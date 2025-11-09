import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { SearchVacanciesDto } from './dto/search-vacancies.dto';
import { VacanciesService } from './vacancies.service';

@Controller()
export class VacanciesController {
  constructor(private readonly vacanciesService: VacanciesService) {}

  @Get('search')
  search(@Query() dto: SearchVacanciesDto) {
    return this.vacanciesService.search(dto);
  }

  @Get('vacancies/:id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.vacanciesService.findById(id);
  }
}
