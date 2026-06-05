import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService, DashboardSummary } from './dashboard.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../common/types/authenticated-request.interface.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get dashboard summary statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard summary data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSummary(@CurrentUser() currentUser: AuthUser): Promise<DashboardSummary> {
    return this.dashboardService.getSummary(currentUser);
  }
}
