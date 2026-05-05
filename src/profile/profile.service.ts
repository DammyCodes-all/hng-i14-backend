import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Profile } from '../../src/types';
import { UUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './profile.entity';
import { GetAllProfileQueryDto, SearchProfileDto } from './dto/profile.dto';
import { PaginatedResponse } from './dto/pagination.dto';
import { RedisService } from '../redis/redis.service';
import {
  parseAboveValue,
  parseBelowValue,
  parseFromCountry,
} from './utils/nl-parsers';
import { fetchGender, fetchAge, fetchNation } from './utils/fetchers';

const normalizeName = (value: string): string => value.trim();
const normalizeLower = (value: string | null | undefined): string | null =>
  value ? value.trim().toLowerCase() : null;
const normalizeUpper = (value: string | null | undefined): string | null =>
  value ? value.trim().toUpperCase() : null;

const QUERY_CACHE_PREFIX = 'profiles:query:v1';
const QUERY_CACHE_TTL_SECONDS = 180;
const PROFILE_BY_ID_CACHE_PREFIX = 'profiles:by-id:v1';
const PROFILE_BY_ID_CACHE_TTL_SECONDS = 300;

type ProfileQueryFilters = {
  gender?: string;
  country_id?: string;
  country_name?: string;
  age_group?: string;
  min_age?: number;
  max_age?: number;
  min_gender_probability?: number;
  min_country_probability?: number;
  sort_by?: string;
  order?: string;
  page: number;
  limit: number;
};

type CachedProfileQueryResult = {
  total: number;
  data: Profile[];
};

// eslint-disable @typescript-eslint/no-unsafe-assignment
@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepository: Repository<ProfileEntity>,
    private readonly redisService: RedisService,
  ) {}

  private toProfile(entity: ProfileEntity): Profile {
    return {
      id: entity.id,
      name: entity.name,
      gender: entity.gender ?? null,
      gender_probability: entity.gender_probability ?? null,
      age: entity.age ?? null,
      age_group: entity.age_group ?? null,
      country_id: entity.country_id ?? null,
      country_name: entity.country_name ?? null,
      country_probability: entity.country_probability ?? null,
      created_at: entity.created_at.toISOString(),
    };
  }

  private buildCanonicalCacheKey(filters: ProfileQueryFilters): string {
    const canonical = {
      age_group: filters.age_group ?? null,
      country_id: filters.country_id ?? null,
      country_name: filters.country_name ?? null,
      gender: filters.gender ?? null,
      limit: filters.limit,
      max_age: filters.max_age ?? null,
      min_age: filters.min_age ?? null,
      min_country_probability: filters.min_country_probability ?? null,
      min_gender_probability: filters.min_gender_probability ?? null,
      order: filters.order ?? null,
      page: filters.page,
      sort_by: filters.sort_by ?? null,
    };

    return `${QUERY_CACHE_PREFIX}:${Buffer.from(
      JSON.stringify(canonical),
    ).toString('base64url')}`;
  }

  private buildProfileByIdCacheKey(id: string): string {
    return `${PROFILE_BY_ID_CACHE_PREFIX}:${id}`;
  }

  private applyProfileFilters(
    qb: ReturnType<Repository<ProfileEntity>['createQueryBuilder']>,
    filters: ProfileQueryFilters,
  ) {
    if (filters.gender)
      qb.andWhere('p.gender = :gender', { gender: filters.gender });
    if (filters.country_id)
      qb.andWhere('p.country_id = :country_id', {
        country_id: filters.country_id,
      });
    if (filters.country_name)
      qb.andWhere('p.country_name = :country_name', {
        country_name: filters.country_name,
      });
    if (filters.age_group)
      qb.andWhere('p.age_group = :age_group', { age_group: filters.age_group });

    if (filters.min_age != null)
      qb.andWhere('p.age >= :min_age', { min_age: filters.min_age });
    if (filters.max_age != null)
      qb.andWhere('p.age <= :max_age', { max_age: filters.max_age });

    if (filters.min_gender_probability != null)
      qb.andWhere('p.gender_probability >= :mgp', {
        mgp: filters.min_gender_probability,
      });

    if (filters.min_country_probability != null)
      qb.andWhere('p.country_probability >= :mcp', {
        mcp: filters.min_country_probability,
      });
  }

  private async getCachedProfileQueryResult(
    filters: ProfileQueryFilters,
  ): Promise<CachedProfileQueryResult> {
    const cacheKey = this.buildCanonicalCacheKey(filters);
    const cached =
      await this.redisService.get<CachedProfileQueryResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const qb = this.profileRepository.createQueryBuilder('p');
    this.applyProfileFilters(qb, filters);

    if (filters.sort_by) {
      const direction =
        (filters.order ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      qb.orderBy(`p.${filters.sort_by}`, direction);
    }

    qb.skip((filters.page - 1) * filters.limit).take(filters.limit);

    const [entities, total] = await qb.getManyAndCount();
    const data = entities.map((entity) => this.toProfile(entity));
    const result: CachedProfileQueryResult = { total, data };

    await this.redisService.set(cacheKey, result, QUERY_CACHE_TTL_SECONDS);
    return result;
  }

  private async invalidateProfileQueryCache(): Promise<void> {
    await this.redisService.clearPattern(`${QUERY_CACHE_PREFIX}:*`);
  }

  async createProfile(createProfileDto: {
    name: string;
  }): Promise<{ status: string; data?: Profile; message?: string }> {
    const profileName = normalizeName(createProfileDto.name);

    const existingEntity = await this.profileRepository.findOne({
      where: { name: profileName },
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
      fetchGender(profileName),
      fetchAge(profileName),
      fetchNation(profileName),
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
    entity.name = profileName;
    entity.gender = normalizeLower(genderData.gender) ?? null;
    entity.gender_probability = genderData.gender_probability ?? null;
    entity.age = ageData.age ?? null;
    entity.age_group = normalizeLower(ageData.age_group) ?? null;
    entity.country_id = normalizeUpper(nationData.country_id) ?? null;
    entity.country_probability = nationData.country_probability ?? null;
    entity.country_name = null;

    const saved = await this.profileRepository.save(entity);
    await this.invalidateProfileQueryCache();

    const profile: Profile = this.toProfile(saved);

    return {
      status: 'success',
      data: profile,
    };
  }

  async getProfile(id: UUID) {
    const idStr = id as unknown as string;
    const cacheKey = this.buildProfileByIdCacheKey(idStr);

    const cachedProfile = await this.redisService.get<Profile>(cacheKey);
    if (cachedProfile) {
      return {
        status: 'success',
        data: cachedProfile,
      };
    }

    const entity = await this.profileRepository.findOneBy({
      id: idStr,
    });

    if (!entity) throw new Error('Profile not found');

    const profile: Profile = this.toProfile(entity);

    await this.redisService.set(
      cacheKey,
      profile,
      PROFILE_BY_ID_CACHE_TTL_SECONDS,
    );

    return {
      status: 'success',
      data: profile,
    };
  }

  async naturalLanguageSearch(
    queryObj: SearchProfileDto,
    baseUrl: string = 'placeholder',
  ) {
    const { q, page, limit } = queryObj;
    const raw = q || '';
    const query = raw.toLowerCase();

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

    const pageNumber = page ?? 1;
    const pageSize = limit ?? 10;

    const computedMinAge =
      ageLimits && minAge != null
        ? Math.max(ageLimits.min, minAge)
        : (ageLimits?.min ?? minAge ?? undefined);
    const computedMaxAge =
      ageLimits && maxAge != null
        ? Math.min(ageLimits.max, maxAge)
        : (ageLimits?.max ?? maxAge ?? undefined);

    const filters: ProfileQueryFilters = {
      gender: genderMatch ?? undefined,
      age_group: ageGroupMatch ?? undefined,
      country_id: fromCountry?.country_id
        ? fromCountry.country_id.toUpperCase()
        : undefined,
      country_name: fromCountry?.country_name ?? undefined,
      min_age: computedMinAge,
      max_age: computedMaxAge,
      page: pageNumber,
      limit: pageSize,
    };

    const { data: profiles, total } =
      await this.getCachedProfileQueryResult(filters);

    return new PaginatedResponse({
      page: pageNumber,
      limit: pageSize,
      total,
      data: profiles,
      baseUrl,
      queryParams: { q },
    });
  }

  async getAllProfiles(
    query: GetAllProfileQueryDto,
    baseUrl: string = 'placeholder',
  ) {
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

    const filters: ProfileQueryFilters = {
      gender: gender ? gender.toLowerCase() : undefined,
      country_id: country_id ? country_id.toUpperCase() : undefined,
      age_group: age_group ? age_group.toLowerCase() : undefined,
      min_age,
      max_age,
      min_gender_probability,
      min_country_probability,
      sort_by,
      order,
      page: page ?? 1,
      limit: limit ?? 10,
    };

    const { data: profiles, total } =
      await this.getCachedProfileQueryResult(filters);

    return new PaginatedResponse({
      page: page ?? 1,
      limit: limit ?? 10,
      total,
      data: profiles,
      baseUrl,
      queryParams: {
        gender,
        country_id,
        age_group,
        min_age,
        max_age,
        min_gender_probability,
        min_country_probability,
        sort_by,
        order,
      },
    });
  }

  async getAllProfilesForCsv(query: GetAllProfileQueryDto): Promise<Profile[]> {
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
    } = query;

    const qb = this.profileRepository.createQueryBuilder('p');

    if (gender)
      qb.andWhere('p.gender = :gender', { gender: gender.toLowerCase() });
    if (country_id)
      qb.andWhere('p.country_id = :country_id', {
        country_id: country_id.toUpperCase(),
      });
    if (age_group)
      qb.andWhere('p.age_group = :age_group', {
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

    const entities = await qb.getMany();

    return entities.map((e) => ({
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
  }

  generateCsv(profiles: Profile[]): string {
    const headers = [
      'id',
      'name',
      'gender',
      'gender_probability',
      'age',
      'age_group',
      'country_id',
      'country_name',
      'country_probability',
      'created_at',
    ];

    const rows = profiles.map((profile) => [
      profile.id,
      profile.name,
      profile.gender ?? '',
      profile.gender_probability ?? '',
      profile.age ?? '',
      profile.age_group ?? '',
      profile.country_id ?? '',
      profile.country_name ?? '',
      profile.country_probability ?? '',
      profile.created_at,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const cellStr = String(cell);
            if (cellStr.includes(',') || cellStr.includes('"')) {
              return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
          })
          .join(','),
      ),
    ].join('\n');

    return csv;
  }

  async deleteProfile(id: UUID) {
    const idStr = id as unknown as string;
    await this.profileRepository.delete({ id });
    await this.redisService.delete(this.buildProfileByIdCacheKey(idStr));
    await this.invalidateProfileQueryCache();
  }
}
