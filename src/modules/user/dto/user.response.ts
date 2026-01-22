import { User } from '@prisma/client';

/**
 * Response DTO for user data
 * Excludes sensitive fields and formats dates
 */
export class UserResponseDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  language: string | null;
  trialUsed: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(user: User | Partial<User>) {
    this.id = user.id!;
    this.email = user.email ?? '';
    this.firstName = user.firstName ?? null;
    this.lastName = user.lastName ?? null;
    this.avatar = user.avatar ?? null;
    this.language = user.language ?? null;
    this.trialUsed = user.trialUsed ?? false;
    this.createdAt = user.createdAt!;
    this.updatedAt = user.updatedAt!;
  }
}
