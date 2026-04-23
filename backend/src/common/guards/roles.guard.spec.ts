import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRoleEnum } from '../enums/user-role.enum';

describe('RolesGuard', () => {
  const createContext = (role?: UserRoleEnum) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    }) as any;

  it('allows requests when route does not require roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows users with a required role', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([UserRoleEnum.ADMIN, UserRoleEnum.EDITOR]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext(UserRoleEnum.EDITOR))).toBe(true);
  });

  it('rejects users without a required role', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([UserRoleEnum.ADMIN, UserRoleEnum.EDITOR]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext(UserRoleEnum.VIEWER))).toThrow(
      ForbiddenException,
    );
  });
});
