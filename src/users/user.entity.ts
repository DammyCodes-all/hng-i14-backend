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
@Index('IDX_users_email', ['email'])
@Index('IDX_users_role_active', ['role', 'is_active'])
export class UserEntity {
  @PrimaryColumn({ type: 'varchar' })
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

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
