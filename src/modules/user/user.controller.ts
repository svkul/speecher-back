import {
  Controller,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from './decorator/user.decorator';
import { UpdateUserDto } from './dto/user.input';
import { UserResponseDto } from './dto/user.response';
import { UserModel } from '../../generated/prisma/models/User';

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
    return await this.userService.getCurrentUser(user);
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
    return await this.userService.updateCurrentUser(user, updateUserDto);
  }
}
