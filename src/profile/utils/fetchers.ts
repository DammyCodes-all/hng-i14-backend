import { AgifyResponse, CountryResponse, GenderizeResponse } from 'src/types';

export async function fetchGender(
  name: string,
): Promise<{ gender: string; gender_probability: number } | null> {
  if (!name) return null;
  try {
    const url = `https://api.genderize.io/?name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: GenderizeResponse = await res.json();

    if (!data || !data.gender || data.count === 0) {
      return null;
    }

    return {
      gender: data.gender,
      gender_probability: data.probability ?? 0,
    };
  } catch (err) {
    return null;
  }
}

export async function fetchAge(
  name: string,
): Promise<{ age: number; age_group: string } | null> {
  if (!name) return null;
  try {
    const url = `https://api.agify.io/?name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: AgifyResponse = await res.json();

    if (!data || !data.age || data.age === 0) {
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
  } catch (err) {
    return null;
  }
}

export async function fetchNation(
  name: string,
): Promise<{ country_id?: string; country_probability?: number } | null> {
  if (!name) return null;
  try {
    const url = `https://api.nationalize.io/?name=${encodeURIComponent(name)}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data: CountryResponse = await res.json();

    if (
      !data ||
      !data.country ||
      !Array.isArray(data.country) ||
      data.country.length === 0
    ) {
      return null;
    }

    const country_id: string | undefined = data?.country[0]?.country_id;
    const country_probability: number | undefined =
      data?.country[0]?.probability;

    return {
      country_id,
      country_probability,
    };
  } catch (err) {
    return null;
  }
}
