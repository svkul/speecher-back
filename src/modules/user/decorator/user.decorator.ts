import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { UserModel } from '../../../generated/prisma/models/User';

/**
 * Decorator to get current authenticated user from request
 * Works with REST API context
 *
 * @param data - Optional key to extract specific property from user object
 * @returns User object or specific property if key is provided
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserModel | undefined, context: ExecutionContext) => {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: UserModel }>();

    const user: UserModel | undefined = request?.user;

    if (!user) {
      return undefined;
    }

    return data ? user[data] : user;
  },
);
