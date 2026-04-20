import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('profiles')
export class ProfileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  gender: string;

  @Column()
  gender_probability: number;

  @Column()
  age: number;

  @Column()
  age_group: string;

  @Column()
  country_id: string;

  @Column()
  country_name: string;

  @Column()
  country_probability: number;

  @Column()
  created_at: Date;
}
