import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAnalysisService } from './ai-analysis.service';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Get('runs/:runId/failure-analysis')
  analyzeRunFailure(@Param('runId') runId: string, @CurrentUser() user: any) {
    return this.aiAnalysisService.analyzeRunFailure(runId, user.tenantId);
  }
}
