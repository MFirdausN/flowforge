import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  liveness() {
    return this.healthService.getLiveness();
  }

  @UseGuards(JwtAuthGuard)
  @Get('overview')
  overview(@CurrentUser() user: any) {
    return this.healthService.getTenantOverview(user.tenantId);
  }
}
