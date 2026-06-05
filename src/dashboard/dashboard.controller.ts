import { Controller, Get } from '@nestjs/common';
import { DashboardService, DashboardSummary } from './dashboard.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@CurrentUser() currentUser: AuthUser): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(currentUser);
  }
}
