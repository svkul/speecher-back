import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from '@prisma/client';
import { UnauthorizedException } from '../../../utils/errors';

/**
 * Decorator to get current authenticated user from request
 * Works with REST API context
 * Throws UnauthorizedException if user is not present in request
 *
 * @param data - Optional key to extract specific property from user object
 * @returns User object or specific property if key is provided
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User }>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'User not authenticated',
        'User object not found in request',
      );
    }

    return data ? user[data as keyof User] : user;
  },
);
