import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
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
import { GetAllProfileQueryDto, SearchProfileDto } from './dto/profile.dto';
import {
  parseAboveValue,
  parseBelowValue,
  parseFromCountry,
} from './utils/nl-parsers';
import { fetchGender, fetchAge, fetchNation } from './utils/fetchers';

// eslint-disable @typescript-eslint/no-unsafe-assignment
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
      fetchGender(createProfileDto.name),
      fetchAge(createProfileDto.name),
      fetchNation(createProfileDto.name),
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

  async naturalLanguageSearch(queryObj: SearchProfileDto) {
    const { q, page, limit } = queryObj;
    const raw = q || '';
    const query = raw.toLowerCase();
    const qb = this.profileRepository.createQueryBuilder('p');

    const genderMatch = query.includes('male and female')
      ? null
      : query.includes('female') || query.includes('females')
        ? 'female'
        : query.includes('male') || query.includes('males')
          ? 'male'
          : null;

    const ageGroupMatch = query.includes('child')
      ? 'child'
      : query.includes('teenager')
        ? 'teenager'
        : query.includes('adult')
          ? 'adult'
          : query.includes('senior')
            ? 'senior'
            : null;

    const ageLimits = query.includes('young')
      ? { min: 16, max: 24 }
      : query.includes('old')
        ? { min: 60, max: 120 }
        : null;

    if (ageGroupMatch)
      qb.andWhere('LOWER(p.age_group) = :age_group', {
        age_group: ageGroupMatch,
      });

    if (genderMatch)
      qb.andWhere('LOWER(p.gender) = :gender', {
        gender: genderMatch,
      });

    if (ageLimits)
      qb.andWhere('p.age BETWEEN :min AND :max', {
        min: ageLimits.min,
        max: ageLimits.max,
      });

    const minAge = parseAboveValue(raw);
    const maxAge = parseBelowValue(raw);
    const fromCountry = parseFromCountry(raw);

    const hasFilter =
      genderMatch !== null ||
      ageGroupMatch !== null ||
      ageLimits !== null ||
      minAge !== null ||
      maxAge !== null ||
      fromCountry !== null;

    if (!hasFilter) {
      throw new HttpException(
        { status: 'error', message: 'Unable to interpret query' },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (minAge != null) {
      qb.andWhere('p.age >= :min_age', { min_age: minAge });
    }

    if (maxAge != null) {
      qb.andWhere('p.age <= :max_age', { max_age: maxAge });
    }

    if (fromCountry) {
      if (fromCountry.country_id) {
        const cidParam = fromCountry.country_id.toUpperCase();
        qb.andWhere('UPPER(p.country_id) = :country_id', {
          country_id: cidParam,
        });
      } else if (fromCountry.country_name) {
        const nameParam = `%${fromCountry.country_name.toLowerCase()}%`;
        qb.andWhere('LOWER(p.country_name) LIKE :country_name', {
          country_name: nameParam,
        });
      }
    }

    if (page && limit) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const [entities, total] = await qb.getManyAndCount();
    const profiles = entities.map((e) => ({
      id: e.id,
      name: e.name,
      gender: e.gender ?? null,
      gender_probability: e.gender_probability ?? null,
      age: e.age ?? null,
      age_group: e.age_group ?? null,
      country_id: e.country_id ?? null,
      country_name: e.country_name ?? null,
      country_probability: e.country_probability ?? null,
      created_at: e.created_at.toISOString(),
    }));

    return {
      status: 'success',
      total,
      page,
      limit,
      data: profiles,
    };
  }

  async getAllProfiles(query: GetAllProfileQueryDto) {
    const {
      gender,
      country_id,
      age_group,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by,
      order,
      page,
      limit,
    } = query;

    const qb = this.profileRepository.createQueryBuilder('p');

    if (gender)
      qb.andWhere('LOWER(p.gender) = :gender', {
        gender: gender.toLowerCase(),
      });
    if (country_id)
      qb.andWhere('UPPER(p.country_id) = :country_id', {
        country_id: country_id.toUpperCase(),
      });
    if (age_group)
      qb.andWhere('LOWER(p.age_group) = :age_group', {
        age_group: age_group.toLowerCase(),
      });

    if (min_age != null) qb.andWhere('p.age >= :min_age', { min_age });
    if (max_age != null) qb.andWhere('p.age <= :max_age', { max_age });

    if (min_gender_probability != null)
      qb.andWhere('p.gender_probability >= :mgp', {
        mgp: min_gender_probability,
      });

    if (min_country_probability != null)
      qb.andWhere('p.country_probability >= :mcp', {
        mcp: min_country_probability,
      });

    if (sort_by) {
      const direction =
        (order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      qb.orderBy(`p.${sort_by}`, direction);
    }

    if (page != null && limit != null) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const [entities, total] = await qb.getManyAndCount();

    const profiles: Profile[] = entities.map((e) => ({
      id: e.id,
      name: e.name,
      gender: e.gender ?? null,
      gender_probability: e.gender_probability ?? null,
      age: e.age ?? null,
      age_group: e.age_group ?? null,
      country_id: e.country_id ?? null,
      country_name: e.country_name ?? null,
      country_probability: e.country_probability ?? null,
      created_at: e.created_at.toISOString(),
    }));

    return {
      status: 'success',
      total,
      page,
      limit,
      data: profiles,
    };
  }

  async deleteProfile(id: UUID) {
    await this.profileRepository.delete({ id });
  }
}
