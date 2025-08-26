// src/common/decorators/get-current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../user/entities/user.entity';

/**
 * Custom decorator to extract the user object from the request.
 * Assumes that the JwtAuthGuard has already run and attached the user to the request.
 */
export const GetCurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    // The user object is attached by JwtStrategy after successful validation.
    return request.user;
  }
);
