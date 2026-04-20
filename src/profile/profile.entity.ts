import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('profiles')
export class ProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  gender: string | null;

  @Column({ type: 'real', nullable: true })
  gender_probability: number | null;

  @Column({ type: 'integer', nullable: true })
  age: number | null;

  @Column({ nullable: true })
  age_group: string | null;

  @Column({ nullable: true, length: 2 })
  country_id: string | null;

  @Column({ nullable: true })
  country_name: string | null;

  @Column({ type: 'real', nullable: true })
  country_probability: number | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
