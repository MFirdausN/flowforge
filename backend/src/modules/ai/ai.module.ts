import { Module } from '@nestjs/common';
import { AiAnalysisController } from './ai-analysis.controller';
import { AiAnalysisService } from './ai-analysis.service';

@Module({
  controllers: [AiAnalysisController],
  providers: [AiAnalysisService],
})
export class AiModule {}
