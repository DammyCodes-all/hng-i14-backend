import { HttpException, Injectable } from '@nestjs/common';
import {
  AgifyResponse,
  CountryResponse,
  GenderizeResponse,
  Profile,
} from 'src/types';
import { UUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './profile.entity';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
  ) {}

  async createProfile(createProfileDto: {
    name: string;
  }): Promise<{ status: string; data?: Profile; message?: string }> {
    const existingEntity = await this.profileRepository.findOne({
      where: { name: createProfileDto.name },
    });

    if (existingEntity) {
      const existingProfile: Profile = {
        id: existingEntity.id.toString(),
        name: existingEntity.name,
        gender: existingEntity.gender ?? null,
        gender_probability: existingEntity.gender_probability ?? null,
        age: existingEntity.age ?? null,
        age_group: existingEntity.age_group ?? null,
        country_id: existingEntity.country_id ?? null,
        country_probability: existingEntity.country_probability ?? null,
        created_at: existingEntity.created_at.toISOString(),
      };

      return {
        status: 'success',
        data: existingProfile,
        message: 'Profile already exists',
      };
    }

    const [genderData, ageData, nationData] = await Promise.all([
      this.fetchGender(createProfileDto.name),
      this.fetchAge(createProfileDto.name),
      this.fetchNation(createProfileDto.name),
    ]);

    if (!genderData) {
      throw new HttpException(
        {
          status: '502',
          message: 'Genderize API returned an invalid response',
        },
        502,
      );
    }

    if (!nationData) {
      throw new HttpException(
        {
          status: '502',
          message: 'Nationalize API returned an invalid response',
        },
        502,
      );
    }

    if (!ageData) {
      throw new HttpException(
        {
          status: '502',
          message: 'Agify API returned an invalid response',
        },
        502,
      );
    }

    const entity = new ProfileEntity();
    entity.name = createProfileDto.name;
    entity.gender = genderData.gender ?? null;
    entity.gender_probability = genderData.gender_probability ?? null;
    entity.age = ageData.age ?? null;
    entity.age_group = ageData.age_group ?? null;
    entity.country_id = nationData.country_id ?? null;
    entity.country_probability = nationData.country_probability ?? null;
    entity.country_name = null;

    const saved = await this.profileRepository.save(entity);

    const profile: Profile = {
      id: saved.id.toString(),
      name: saved.name,
      gender: saved.gender ?? null,
      gender_probability: saved.gender_probability ?? null,
      age: saved.age ?? null,
      age_group: saved.age_group ?? null,
      country_id: saved.country_id ?? null,
      country_probability: saved.country_probability ?? null,
      created_at: saved.created_at.toISOString(),
    };

    return {
      status: 'success',
      data: profile,
    };
  }

  async getProfile(id: UUID) {
    const entity = await this.profileRepository.findOneBy({
      id: id as unknown as string,
    });

    if (!entity) throw new Error('Profile not found');

    const profile: Profile = {
      id: entity.id,
      name: entity.name,
      gender: entity.gender ?? null,
      gender_probability: entity.gender_probability ?? null,
      age: entity.age ?? null,
      age_group: entity.age_group ?? null,
      country_id: entity.country_id ?? null,
      country_probability: entity.country_probability ?? null,
      created_at: entity.created_at.toISOString(),
    };

    return {
      status: 'success',
      data: profile,
    };
  }

  async getAllProfiles(
    gender?: string,
    country_id?: string,
    age_group?: string,
  ) {
    const where: any = {};
    if (typeof gender === 'string') where.gender = gender;
    if (typeof country_id === 'string') where.country_id = country_id;
    if (typeof age_group === 'string') where.age_group = age_group;

    const entities =
      Object.keys(where).length > 0
        ? await this.profileRepository.find({ where })
        : await this.profileRepository.find();

    const profiles: Profile[] = entities.map((e) => ({
      id: e.id.toString(),
      name: e.name,
      gender: e.gender ?? null,
      gender_probability: e.gender_probability ?? null,
      age: e.age ?? null,
      age_group: e.age_group ?? null,
      country_id: e.country_id ?? null,
      country_probability: e.country_probability ?? null,
      created_at: e.created_at.toISOString(),
    }));

    return {
      status: 'success',
      count: profiles.length,
      data: profiles,
    };
  }

  async deleteProfile(id: UUID) {
    await this.profileRepository.delete({ id: id as unknown as string });
  }

  private async fetchGender(
    name: string,
  ): Promise<{ gender: string; gender_probability: number } | null> {
    const res = await fetch(`https://api.genderize.io/?name=${name}`);
    const data: GenderizeResponse = await res.json();

    // Normalize values to concrete primitives and validate them.
    const gender = data.gender ?? null;
    const probability = Number(data.probability ?? 0);

    // Only require that a gender value is present; do not depend on sample count.
    if (!gender) {
      return null;
    }

    return {
      gender,
      gender_probability: probability,
    };
  }

  private async fetchAge(
    name: string,
  ): Promise<{ age: number; age_group: string } | null> {
    const res = await fetch(`https://api.agify.io/?name=${name}`);
    const data: AgifyResponse = await res.json();

    const ageVal = data.age ?? null;
    if (!ageVal || ageVal === 0) {
      return null;
    }

    let ageGroup: string;
    if (ageVal < 12) {
      ageGroup = 'child';
    } else if (ageVal < 19) {
      ageGroup = 'teenager';
    } else if (ageVal < 59) {
      ageGroup = 'adult';
    } else {
      ageGroup = 'senior';
    }

    return {
      age: Number(ageVal),
      age_group: ageGroup,
    };
  }

  private async fetchNation(
    name: string,
  ): Promise<{ country_id?: string; country_probability?: number } | null> {
    const res = await fetch(`https://api.nationalize.io/?name=${name}`);
    const data: CountryResponse = await res.json();

    if (!data.country || data.country.length === 0) {
      return null;
    }

    const top = data.country[0] ?? {};
    const country_id: string | undefined = top.country_id ?? undefined;
    const country_probability: number | undefined =
      top.probability !== undefined && top.probability !== null
        ? Number(top.probability)
        : undefined;

    // If there's no meaningful country id or probability, treat as absent.
    if (!country_id && country_probability === undefined) {
      return null;
    }

    return {
      country_id,
      country_probability,
    };
  }
}
