import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from './decorator/user.decorator';
import { UpdateUserDto } from './dto/user.input';
import { UserResponseDto } from './dto/user.response';
import { UserModel } from '../../../generated/prisma/models/User';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Get current authenticated user
   * GET /user/me
   */
  @Get('me')
  async getCurrentUser(
    @CurrentUser() user: UserModel | undefined,
  ): Promise<UserResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // If user is already loaded from auth guard, use it
    // Otherwise fetch from database
    const userData = await this.userService.findById(user.id);

    // Type assertion: Prisma returns all fields at runtime, but TypeScript may infer a partial type
    return new UserResponseDto(userData);
  }

  /**
   * Update current user profile
   * PATCH /user/me
   */
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateCurrentUser(
    @CurrentUser() user: UserModel | undefined,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const updatedUser = await this.userService.update(user.id, updateUserDto);
    // Type assertion: Prisma returns all fields at runtime, but TypeScript may infer a partial type
    return new UserResponseDto(updatedUser);
  }
}
