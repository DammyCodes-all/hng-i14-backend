import {
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('profiles')
@Index('IDX_profiles_country_id', ['country_id'])
@Index('IDX_profiles_country_name', ['country_name'])
@Index('IDX_profiles_gender', ['gender'])
@Index('IDX_profiles_age', ['age'])
@Index('IDX_profiles_age_group', ['age_group'])
export class ProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  gender!: string | null;

  @Column({ type: 'double precision', nullable: true })
  gender_probability!: number | null;

  @Column({ type: 'integer', nullable: true })
  age!: number | null;

  @Column({ type: 'text', nullable: true })
  age_group!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  country_id!: string | null;

  @Column({ type: 'text', nullable: true })
  country_name!: string | null;

  @Column({ type: 'double precision', nullable: true })
  country_probability!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
