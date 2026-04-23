import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  liveness() {
    return this.healthService.getLiveness();
  }

  @Get('overview')
  @RateLimit({ points: 120, windowMs: 60_000 })
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  overview(@CurrentUser() user: any) {
    return this.healthService.getTenantOverview(user.tenantId);
  }
}
