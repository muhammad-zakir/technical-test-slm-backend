import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

// Singleton cache — reused across warm Vercel invocations to avoid
// re-bootstrapping NestJS on every request after the initial cold start.
let cachedApplication: INestApplication | null = null;

function configureApplication(application: INestApplication): void {
  application.enableCors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  application.setGlobalPrefix('api');
  application.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}

async function createApplication(): Promise<INestApplication> {
  if (cachedApplication) {
    return cachedApplication;
  }

  const application = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  configureApplication(application);

  await application.init();
  cachedApplication = application;
  return application;
}

// Vercel serverless handler
export default async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const application = await createApplication();
  const httpAdapter = application.getHttpAdapter().getInstance();
  httpAdapter(request, response);
};

function setupSwagger(application: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('SLM Backend API')
    .setDescription('REST API for the SLM technical test backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(application, config);
  SwaggerModule.setup('api/docs', application, document);
}

// Local development bootstrap
async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  configureApplication(application);
  setupSwagger(application);

  await application.listen(process.env.PORT || 3000);
}

if (process.env.NODE_ENV !== 'production') {
  bootstrap();
}
