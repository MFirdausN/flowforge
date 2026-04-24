import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AiAnalysisService } from './ai-analysis.service';
import { ContentReviewDto } from './dto/content-review.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Get('runs/:runId/failure-analysis')
  analyzeRunFailure(@Param('runId') runId: string, @CurrentUser() user: any) {
    return this.aiAnalysisService.analyzeRunFailure(runId, user.tenantId);
  }

  @Post('posts/content-review')
  reviewPostContent(@Body() dto: ContentReviewDto) {
    return this.aiAnalysisService.reviewPostContent(dto);
  }
}
