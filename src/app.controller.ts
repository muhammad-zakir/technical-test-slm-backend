import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { Public } from './auth/public.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  async getHealth(): Promise<{ status: string; database: string; timestamp?: string; error?: string }> {
    return this.appService.checkDatabaseHealth();
  }
}
