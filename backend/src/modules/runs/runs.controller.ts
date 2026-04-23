import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { ListRunsQueryDto } from './dto/list-runs-query.dto';
import { RunsService } from './runs.service';

@UseGuards(JwtAuthGuard)
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  @RateLimit({ points: 90, windowMs: 60_000 })
  @UseGuards(RateLimitGuard)
  findAll(@CurrentUser() user: any, @Query() query: ListRunsQueryDto) {
    return this.runsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.runsService.findOne(id, user.tenantId);
  }
}
