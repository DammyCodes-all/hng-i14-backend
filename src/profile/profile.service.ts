import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProfileStoreService } from './profile-store.service';
import {
  AgifyResponse,
  CountryResponse,
  GenderizeResponse,
  Profile,
} from 'src/types';
import { randomUUID, UUID } from 'crypto';

@Injectable()
export class ProfileService {
  constructor(private readonly profileStore: ProfileStoreService) {}

  async createProfile(createProfileDto: {
    name: string;
  }): Promise<{ status: string; data?: Profile; message?: string }> {
    const existingProfile = this.profileStore.findByName(createProfileDto.name);
    if (existingProfile) {
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

    const profile: Profile = {
      id: randomUUID(),
      name: createProfileDto?.name,
      gender: genderData?.gender,
      gender_probability: genderData?.gender_probability,
      sample_size: genderData?.sample_size,
      age: ageData?.age,
      age_group: ageData?.age_group,
      country_id: nationData?.country_id,
      country_probability: nationData?.country_probability,
      created_at: new Date().toISOString(),
    };

    this.profileStore.save(profile);

    return {
      status: 'success',
      data: profile,
    };
  }

  getProfile(id: UUID) {
    const profile = this.profileStore.findById(id);

    if (!profile) throw new Error('Profile not found');

    return {
      status: 'success',
      data: profile,
    };
  }

  getAllProfiles(gender?: string, country_id?: string, age_group?: string) {
    const profiles = this.profileStore.findAll().filter((p) => {
      return (
        (gender === undefined || p.gender === gender) &&
        (country_id === undefined || p.country_id === country_id) &&
        (age_group === undefined || p.age_group === age_group)
      );
    });

    return {
      status: 'success',
      count: profiles.length,
      data: profiles,
    };
  }

  deleteProfile(id: UUID) {
    this.profileStore.deleteById(id);
  }

  private async fetchGender(name: string) {
    const res = await fetch(`https://api.genderize.io/?name=${name}`);
    const data: GenderizeResponse = await res.json();

    if (!data.gender) {
      return null;
    }

    return {
      gender: data.gender,
      gender_probability: data.probability,
      sample_size: data.count,
    };
  }

  private async fetchAge(name: string) {
    const res = await fetch(`https://api.agify.io/?name=${name}`);
    const data: AgifyResponse = await res.json();

    if (!data.age) {
      return null;
    }

    let ageGroup: string;
    if (data.age < 12) {
      ageGroup = 'child';
    } else if (data.age < 19) {
      ageGroup = 'teenager';
    } else if (data.age < 59) {
      ageGroup = 'adult';
    } else {
      ageGroup = 'senior';
    }

    return {
      age: data.age,
      age_group: ageGroup,
    };
  }

  private async fetchNation(name: string) {
    const res = await fetch(`https://api.nationalize.io/?name=${name}`);
    const data: CountryResponse = await res.json();

    if (!data.country) {
      return null;
    }

    const country_id: string | undefined = data?.country[0]?.country_id;
    const country_probability: number | undefined =
      data?.country[0]?.probability;

    return {
      country_id,
      country_probability,
    };
  }
}
