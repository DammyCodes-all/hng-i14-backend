import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

export type UserRole = 'admin' | 'analyst';

@Entity('users')
@Index('IDX_users_github_id', ['github_id'], { unique: true })
export class UserEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  github_id!: string;

  @Column({ type: 'text' })
  username!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'text', default: 'analyst' })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'datetime', nullable: true })
  last_login_at!: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
