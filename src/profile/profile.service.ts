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
        id: existingEntity.id,
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
      id: saved.id,
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
    const idStr = id as unknown as string;
    const entity = await this.profileRepository.findOneBy({
      id: idStr,
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
    min_age?: number,
    max_age?: number,
    min_gender_probability?: number,
    min_country_probability?: number,
  ) {
    const qb = this.profileRepository.createQueryBuilder('p');

    if (typeof gender === 'string' && gender.length > 0) {
      qb.andWhere('p.gender = :gender', { gender });
    }

    if (typeof country_id === 'string' && country_id.length > 0) {
      qb.andWhere('p.country_id = :country_id', { country_id });
    }

    if (typeof age_group === 'string' && age_group.length > 0) {
      qb.andWhere('p.age_group = :age_group', { age_group });
    }

    if (typeof min_age === 'number') {
      qb.andWhere('p.age >= :min_age', { min_age });
    }

    if (typeof max_age === 'number') {
      qb.andWhere('p.age <= :max_age', { max_age });
    }

    if (typeof min_gender_probability === 'number') {
      qb.andWhere('p.gender_probability >= :mgp', {
        mgp: min_gender_probability,
      });
    }

    if (typeof min_country_probability === 'number') {
      qb.andWhere('p.country_probability >= :mcp', {
        mcp: min_country_probability,
      });
    }

    const entities = await qb.getMany();

    const profiles: Profile[] = entities.map((e) => ({
      id: e.id,
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
    await this.profileRepository.delete({ id });
  }

  private async fetchGender(
    name: string,
  ): Promise<{ gender: string; gender_probability: number } | null> {
    const res = await fetch(
      `https://api.genderize.io/?name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) {
      return null;
    }

    const raw: unknown = await res.json();
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;

    const gender =
      typeof obj.gender === 'string' && obj.gender.length > 0
        ? obj.gender
        : null;

    const probRaw = obj.probability;
    const probability =
      typeof probRaw === 'number'
        ? probRaw
        : typeof probRaw === 'string'
          ? Number(probRaw)
          : 0;

    if (!gender) return null;

    return {
      gender,
      gender_probability: Number.isFinite(probability) ? probability : 0,
    };
  }

  private async fetchAge(
    name: string,
  ): Promise<{ age: number; age_group: string } | null> {
    const res = await fetch(
      `https://api.agify.io/?name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;

    const raw: unknown = await res.json();
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;

    const ageRaw = obj.age;
    const ageNum = typeof ageRaw === 'number' ? ageRaw : Number(ageRaw ?? NaN);

    if (!Number.isFinite(ageNum) || ageNum === 0) {
      return null;
    }

    let ageGroup: string;
    if (ageNum < 12) {
      ageGroup = 'child';
    } else if (ageNum < 19) {
      ageGroup = 'teenager';
    } else if (ageNum < 59) {
      ageGroup = 'adult';
    } else {
      ageGroup = 'senior';
    }

    return {
      age: Math.floor(ageNum),
      age_group: ageGroup,
    };
  }

  private async fetchNation(
    name: string,
  ): Promise<{ country_id?: string; country_probability?: number } | null> {
    const res = await fetch(
      `https://api.nationalize.io/?name=${encodeURIComponent(name)}`,
    );
    if (!res.ok) return null;

    const raw: unknown = await res.json();
    if (!raw || typeof raw !== 'object') return null;
    const obj = raw as Record<string, unknown>;

    const countryArr = Array.isArray(obj.country) ? obj.country : undefined;
    if (!Array.isArray(countryArr) || countryArr.length === 0) return null;

    const top = countryArr[0] as Record<string, unknown>;
    const country_id =
      typeof top?.country_id === 'string' && top.country_id.length > 0
        ? (top.country_id as string)
        : undefined;

    const probRaw = top?.probability;
    const country_probability =
      typeof probRaw === 'number'
        ? probRaw
        : typeof probRaw === 'string'
          ? Number(probRaw)
          : undefined;

    if (
      !country_id &&
      (country_probability === undefined || Number.isNaN(country_probability))
    ) {
      return null;
    }

    return {
      country_id,
      country_probability:
        country_probability !== undefined &&
        Number.isFinite(country_probability)
          ? country_probability
          : undefined,
    };
  }
}
