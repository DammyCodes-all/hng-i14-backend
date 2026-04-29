import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { DEFAULT_USER_ROLE, INITIAL_USER_ROLE } from 'src/auth/auth.config';
import { UserEntity, UserRole } from './user.entity';

export interface GithubUserProfile {
  github_id: string;
  username: string;
  email?: string | null;
  avatar_url?: string | null;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({ where: { id } });
  }

  async findByGithubId(githubId: string): Promise<UserEntity | null> {
    return await this.userRepository.findOne({ where: { github_id: githubId } });
  }

  async createOrUpdateFromGithubProfile(
    profile: GithubUserProfile,
  ): Promise<UserEntity> {
    const existing = await this.findByGithubId(profile.github_id);

    if (existing) {
      existing.username = profile.username;
      existing.email = profile.email ?? null;
      existing.avatar_url = profile.avatar_url ?? null;
      existing.last_login_at = new Date();
      return await this.userRepository.save(existing);
    }

    const totalUsers = await this.userRepository.count();
    const role: UserRole = totalUsers === 0 ? INITIAL_USER_ROLE : DEFAULT_USER_ROLE;

    const entity = this.userRepository.create({
      id: uuidv7(),
      github_id: profile.github_id,
      username: profile.username,
      email: profile.email ?? null,
      avatar_url: profile.avatar_url ?? null,
      role,
      is_active: true,
      last_login_at: new Date(),
    });

    return await this.userRepository.save(entity);
  }

  async setLastLogin(userId: string, at: Date = new Date()): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    user.last_login_at = at;
    return await this.userRepository.save(user);
  }

  async setActiveState(userId: string, isActive: boolean): Promise<UserEntity> {
    const user = await this.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    user.is_active = isActive;
    return await this.userRepository.save(user);
  }

  async countUsers(): Promise<number> {
    return await this.userRepository.count();
  }
}
