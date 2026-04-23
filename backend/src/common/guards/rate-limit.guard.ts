import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from '../decorators/rate-limit.decorator';

type Bucket = {
  count: number;
  resetAt: number;
};

type RequestWithUser = {
  ip?: string;
  route?: { path?: string };
  originalUrl?: string;
  user?: {
    sub?: string;
    tenantId?: string;
  };
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const now = Date.now();
    const key = this.resolveKey(request);
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      return true;
    }

    if (bucket.count >= options.points) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. Retry after ${retryAfterSeconds}s.`,
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private resolveKey(request: RequestWithUser) {
    const actor =
      request.user?.tenantId && request.user?.sub
        ? `${request.user.tenantId}:${request.user.sub}`
        : (request.ip ?? 'anonymous');
    const route = request.route?.path ?? request.originalUrl ?? 'unknown';

    return `${actor}:${route}`;
  }
}
