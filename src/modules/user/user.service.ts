import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserModel } from '../../../generated/prisma/models/User';
import { UpdateUserDto } from './dto/user.input';
import { UserResponseDto } from './dto/user.response';
import {
  ResourceNotFoundException,
  UnauthorizedException,
} from '../../utils/errors';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current authenticated user
   * @param user - Current user from request (can be undefined)
   * @returns UserResponseDto or throws UnauthorizedException
   */
  async getCurrentUser(user: UserModel | undefined): Promise<UserResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // If user is already loaded from auth guard, use it
    // Otherwise fetch from database
    const userData = await this.findById(user.id);

    return new UserResponseDto(userData);
  }

  /**
   * Update current user profile
   * @param user - Current user from request (can be undefined)
   * @param updateData - Data to update (firstName, lastName, avatar)
   * @returns UserResponseDto or throws UnauthorizedException
   */
  async updateCurrentUser(
    user: UserModel | undefined,
    updateData: UpdateUserDto,
  ): Promise<UserResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const updatedUser = await this.update(user.id, updateData);
    return new UserResponseDto(updatedUser);
  }

  /**
   * Find user by ID
   * @param id - User ID (UUID)
   * @returns User or throws ResourceNotFoundException
   */
  async findById(id: string): Promise<UserModel> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new ResourceNotFoundException('User', id);
    }

    return user;
  }

  /**
   * Update user profile
   * @param id - User ID (UUID)
   * @param updateData - Data to update (firstName, lastName, avatar)
   * @returns Updated user
   */
  async update(id: string, updateData: UpdateUserDto): Promise<UserModel> {
    // Check if user exists
    await this.findById(id);

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        ...(updateData.firstName !== undefined && {
          firstName: updateData.firstName,
        }),
        ...(updateData.lastName !== undefined && {
          lastName: updateData.lastName,
        }),
        ...(updateData.avatar !== undefined && { avatar: updateData.avatar }),
      },
    });

    return updatedUser;
  }
}
