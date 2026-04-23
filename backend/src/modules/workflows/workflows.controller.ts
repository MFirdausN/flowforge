import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Put,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowsService } from './workflows.service';

@UseGuards(JwtAuthGuard)
@Controller('workflows')
export class WorkflowsController {
    constructor(private readonly workflowsService: WorkflowsService) { }

    @Get()
    findAll(@CurrentUser() user: any) {
        return this.workflowsService.findAll(user.tenantId);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @CurrentUser() user: any) {
        return this.workflowsService.findOne(id, user.tenantId);
    }

    @Post()
    create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: any) {
        return this.workflowsService.create(dto, user);
    }

    @Put(':id')
    update(
        @Param('id') id: string,
        @Body() dto: UpdateWorkflowDto,
        @CurrentUser() user: any,
    ) {
        return this.workflowsService.update(id, dto, user);
    }
}