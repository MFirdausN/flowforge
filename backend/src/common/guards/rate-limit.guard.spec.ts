import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  function createContext() {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          route: { path: '/runs' },
          user: { tenantId: 'tenant-1', sub: 'user-1' },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows requests within the configured window', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue({ points: 2, windowMs: 60_000 }),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('rejects requests after the quota is exhausted', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue({ points: 1, windowMs: 60_000 }),
    } as unknown as Reflector;
    const guard = new RateLimitGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
    expect(() => guard.canActivate(createContext())).toThrow(HttpException);
  });
});
