import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserModel } from '../../../generated/prisma/models/User';
import { UpdateUserDto } from './dto/user.input';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID
   * @param id - User ID (UUID)
   * @returns User or throws NotFoundException
   */
  async findById(id: string): Promise<UserModel> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
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
