import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const origins = config.frontendOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: config.frontendOrigin === '*' ? true : origins,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MagangHub API')
    .setDescription('Search, sync, and facet endpoints for MagangHub data')
    .setVersion('1.0.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDocument);

  process.env.TZ = config.timezone;
  await app.listen(config.port);
  const logger = new Logger('Bootstrap');
  logger.log(`Server ready at http://localhost:${config.port}`);
}

bootstrap();
