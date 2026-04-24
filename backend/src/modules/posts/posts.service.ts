import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiAnalysisService } from '../ai/ai-analysis.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiAnalysisService: AiAnalysisService,
  ) {}

  async listPublished() {
    return this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });
  }

  async findPublishedBySlug(slug: string) {
    const post = await this.prisma.post.findFirst({
      where: { slug, status: PostStatus.PUBLISHED },
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!post) {
      throw new NotFoundException('Published post not found');
    }

    return post;
  }

  async listForDashboard(user: any) {
    const isModerator =
      user.role === UserRole.ADMIN || user.role === UserRole.EDITOR;

    return this.prisma.post.findMany({
      where: {
        tenantId: user.tenantId,
        ...(isModerator ? {} : { authorId: user.sub }),
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        author: {
          select: { id: true, name: true, role: true },
        },
        reviewer: {
          select: { id: true, name: true, role: true },
        },
      },
    });
  }

  async create(dto: CreatePostDto, user: any) {
    const status = this.resolveStatus(dto.intent, user.role);
    const slug = await this.ensureUniqueSlug(
      user.tenantId,
      dto.slug || this.slugify(dto.title),
    );
    const contentReview = await this.aiAnalysisService.reviewPostContent({
      title: dto.title,
      excerpt: dto.excerpt,
      content: dto.content,
    });

    return this.prisma.post.create({
      data: {
        tenantId: user.tenantId,
        authorId: user.sub,
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        status,
        contentReview,
        reviewCheckedAt: new Date(contentReview.checkedAt),
        ...(status === PostStatus.PUBLISHED
          ? {
              reviewerId: user.sub,
              reviewedAt: new Date(),
              publishedAt: new Date(),
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async update(id: string, dto: UpdatePostDto, user: any) {
    const post = await this.findAccessiblePost(id, user);
    const status = dto.intent
      ? this.resolveStatus(dto.intent, user.role)
      : post.status;

    const nextSlug =
      dto.slug || (dto.title && dto.title !== post.title ? this.slugify(dto.title) : post.slug);
    const nextTitle = dto.title ?? post.title;
    const nextExcerpt = dto.excerpt ?? post.excerpt ?? undefined;
    const nextContent = dto.content ?? post.content;
    const contentReview = await this.aiAnalysisService.reviewPostContent({
      title: nextTitle,
      excerpt: nextExcerpt,
      content: nextContent,
    });

    return this.prisma.post.update({
      where: { id: post.id },
      data: {
        ...(dto.title === undefined ? {} : { title: dto.title }),
        ...(dto.excerpt === undefined ? {} : { excerpt: dto.excerpt }),
        ...(dto.content === undefined ? {} : { content: dto.content }),
        ...(nextSlug === post.slug
          ? {}
          : { slug: await this.ensureUniqueSlug(user.tenantId, nextSlug, post.id) }),
        status,
        contentReview,
        reviewCheckedAt: new Date(contentReview.checkedAt),
        reviewerId: status === PostStatus.PUBLISHED ? user.sub : status === PostStatus.PENDING_REVIEW ? null : post.reviewerId,
        reviewedAt:
          status === PostStatus.PUBLISHED ? new Date() : status === PostStatus.PENDING_REVIEW ? null : post.reviewedAt,
        publishedAt:
          status === PostStatus.PUBLISHED
            ? new Date()
            : status === PostStatus.DRAFT
              ? null
              : post.publishedAt,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async publish(id: string, user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.EDITOR) {
      throw new ForbiddenException('Only editor or admin can publish posts');
    }

    const post = await this.prisma.post.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        reviewerId: user.sub,
        reviewedAt: new Date(),
        publishedAt: new Date(),
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });
  }

  async unpublish(id: string, user: any) {
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.EDITOR) {
      throw new ForbiddenException('Only editor or admin can unpublish posts');
    }

    const post = await this.prisma.post.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.DRAFT,
        publishedAt: null,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });
  }

  private async findAccessiblePost(id: string, user: any) {
    const isModerator =
      user.role === UserRole.ADMIN || user.role === UserRole.EDITOR;

    const post = await this.prisma.post.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        ...(isModerator ? {} : { authorId: user.sub }),
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    return post;
  }

  private resolveStatus(intent: string | undefined, role: UserRole) {
    if (intent === 'publish') {
      if (role === UserRole.ADMIN || role === UserRole.EDITOR) {
        return PostStatus.PUBLISHED;
      }

      return PostStatus.PENDING_REVIEW;
    }

    if (intent === 'submit') {
      return PostStatus.PENDING_REVIEW;
    }

    return PostStatus.DRAFT;
  }

  private slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private async ensureUniqueSlug(
    tenantId: string,
    baseSlug: string,
    excludeId?: string,
  ) {
    const normalized = this.slugify(baseSlug) || 'post';
    let candidate = normalized;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.post.findFirst({
        where: {
          tenantId,
          slug: candidate,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }

      counter += 1;
      candidate = `${normalized}-${counter}`;
    }
  }
}
