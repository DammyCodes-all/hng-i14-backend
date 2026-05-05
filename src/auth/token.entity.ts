import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('refresh_tokens')
@Index('IDX_refresh_tokens_user_id', ['user_id'])
@Index('IDX_refresh_tokens_expires_at', ['expires_at'])
export class RefreshTokenEntity {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ type: 'text' })
  user_id!: string;

  @Column({ type: 'text' })
  refresh_token_hash!: string;

  @Column({ type: 'boolean', default: false })
  is_invalidated!: boolean;

  @Column({ type: 'timestamptz' })
  expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at!: Date;
}
