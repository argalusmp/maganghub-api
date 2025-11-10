import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AlertModule } from './alerts/alert.module';
import { AppConfigModule } from './config/app-config.module';
import { FacetsModule } from './facets/facets.module';
import { PrismaModule } from './prisma/prisma.module';
import { SyncModule } from './sync/sync.module';
import { VacanciesModule } from './vacancies/vacancies.module';

@Module({
  imports: [
    AppConfigModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    SyncModule,
    VacanciesModule,
    FacetsModule,
    AlertModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
