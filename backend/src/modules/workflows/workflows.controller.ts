import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRoleEnum } from '../../common/enums/user-role.enum';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { ListWorkflowsQueryDto } from './dto/list-workflows-query.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @RateLimit({ points: 60, windowMs: 60_000 })
  @UseGuards(RateLimitGuard)
  findAll(@CurrentUser() user: any, @Query() query: ListWorkflowsQueryDto) {
    return this.workflowsService.findAll(user.tenantId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.findOne(id, user.tenantId);
  }

  @Get(':id/versions')
  findVersions(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.findVersions(id, user.tenantId);
  }

  @Post()
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: any) {
    return this.workflowsService.create(dto, user);
  }

  @Put(':id')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.update(id, dto, user);
  }

  @Post(':id/rollback/:versionNo')
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  rollback(
    @Param('id') id: string,
    @Param('versionNo', ParseIntPipe) versionNo: number,
    @CurrentUser() user: any,
  ) {
    return this.workflowsService.rollback(id, versionNo, user);
  }

  @Delete(':id')
  @Roles(UserRoleEnum.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workflowsService.remove(id, user);
  }
}
