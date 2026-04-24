import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post as HttpPost,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRoleEnum } from '../../common/enums/user-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('published')
  findPublished() {
    return this.postsService.listPublished();
  }

  @Get('published/:slug')
  findPublishedBySlug(@Param('slug') slug: string) {
    return this.postsService.findPublishedBySlug(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  findForDashboard(@CurrentUser() user: any) {
    return this.postsService.listForDashboard(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR, UserRoleEnum.USER)
  @HttpPost()
  create(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
    return this.postsService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR, UserRoleEnum.USER)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: any,
  ) {
    return this.postsService.update(id, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  @HttpPost(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.postsService.publish(id, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.ADMIN, UserRoleEnum.EDITOR)
  @HttpPost(':id/unpublish')
  unpublish(@Param('id') id: string, @CurrentUser() user: any) {
    return this.postsService.unpublish(id, user);
  }
}
