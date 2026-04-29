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
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  user_id!: string;

  @Column({ type: 'text' })
  refresh_token_hash!: string;

  @Column({ type: 'boolean', default: false })
  is_invalidated!: boolean;

  @Column({ type: 'datetime' })
  expires_at!: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;
}
