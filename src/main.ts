import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Essential for the Next.js frontend to call this API
  await app.listen(3000);
}

// Vercel requires the app to be exported as a function
export default async (req, res) => {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.init();
  const instance = app.getHttpAdapter().getInstance();
  instance(req, res);
};

if (process.env.NODE_ENV !== 'production') {
  bootstrap();
}
