import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { RunsModule } from './modules/runs/runs.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { HealthModule } from './modules/health/health.module';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    TenantsModule,
    WorkflowsModule,
    RunsModule,
    ExecutionModule,
    HealthModule,
    ApiDocsModule,
    AiModule,
  ],
})
export class AppModule {}
