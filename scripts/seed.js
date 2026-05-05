const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const projectRoot = path.join(__dirname, '..');
const profileSeedFile = path.join(projectRoot, 'seed', 'seed_profiles.json');
const userSeedFile = path.join(projectRoot, 'seed', 'seed_users.json');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadRuntimeEnv() {
  loadEnvFile(path.join(projectRoot, '.env'));
}

function loadSeedFile(filePath, collectionName) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse JSON seed file ${filePath}:`, err.message);
    process.exit(1);
  }

  if (!Array.isArray(parsed[collectionName])) {
    console.error(
      `Seed file ${filePath} does not contain an array named ${collectionName}.`,
    );
    process.exit(1);
  }

  return parsed[collectionName];
}

function loadProfileSeed() {
  return loadSeedFile(profileSeedFile, 'profiles');
}

function loadUserSeed() {
  return loadSeedFile(userSeedFile, 'users');
}

function normalizeNullableString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBoolean(value, defaultValue) {
  if (value === true || value === false) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }

  return defaultValue;
}

function normalizeDate(value) {
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return new Date().toISOString();
}

async function createTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      gender text NULL,
      gender_probability double precision NULL,
      age integer NULL,
      age_group text NULL,
      country_id varchar(2) NULL,
      country_name text NULL,
      country_probability double precision NULL,
      created_at timestamptz NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      github_id text NOT NULL UNIQUE,
      username text NOT NULL,
      email text NULL,
      avatar_url text NULL,
      role text NOT NULL DEFAULT 'analyst',
      is_active boolean NOT NULL DEFAULT true,
      last_login_at timestamptz NULL,
      created_at timestamptz NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL,
      refresh_token_hash text NOT NULL,
      is_invalidated boolean NOT NULL DEFAULT false,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    )
  `);

  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_profiles_country_id ON profiles (country_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_profiles_country_name ON profiles (country_name)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_profiles_gender ON profiles (gender)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_profiles_age ON profiles (age)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_profiles_age_group ON profiles (age_group)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_users_email ON users (email)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_users_role_active ON users (role, is_active)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_refresh_tokens_user_id ON refresh_tokens (user_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS IDX_refresh_tokens_expires_at ON refresh_tokens (expires_at)`,
  );
}

async function loadExistingProfileNames(client) {
  const result = await client.query('SELECT name FROM profiles');
  return new Set(result.rows.map((row) => row.name));
}

async function loadExistingUserGithubIds(client) {
  const result = await client.query('SELECT github_id FROM users');
  return new Set(result.rows.map((row) => row.github_id));
}

async function seedProfiles(client, profiles, existingNames) {
  let skipped = 0;
  let inserted = 0;

  console.log(`Seeding profiles: scanning ${profiles.length} record(s)...`);

  for (let index = 0; index < profiles.length; index += 1) {
    const item = profiles[index];
    const name = normalizeNullableString(item.name);
    if (!name) {
      skipped += 1;
      continue;
    }

    const exists = await client.query(
      'SELECT 1 FROM profiles WHERE name = $1 LIMIT 1',
      [name],
    );
    if (exists.rowCount > 0) {
      skipped += 1;
      continue;
    }

    const id = normalizeNullableString(item.id) || randomUUID();
    const gender = normalizeNullableString(item.gender);
    const genderProbability = normalizeNumber(item.gender_probability);
    const age = normalizeNumber(item.age);
    const ageGroup = normalizeNullableString(item.age_group);
    const countryId = normalizeNullableString(item.country_id);
    const countryName = normalizeNullableString(item.country_name);
    const countryProbability = normalizeNumber(item.country_probability);
    const createdAt = normalizeDate(item.created_at);

    await client.query(
      `
        INSERT INTO profiles
          (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `,
      [
        id,
        name,
        gender,
        genderProbability,
        age,
        ageGroup,
        countryId,
        countryName,
        countryProbability,
        createdAt,
      ],
    );

    existingNames.add(name);

    inserted += 1;

    if (inserted % 250 === 0) {
      console.log(
        `Seeding profiles progress: inserted ${inserted}, skipped ${skipped}`,
      );
    }
  }

  return { inserted, skipped };
}

async function seedUsers(client, users, existingGithubIds) {
  let skipped = 0;
  let inserted = 0;

  console.log(`Seeding users: scanning ${users.length} record(s)...`);

  for (let index = 0; index < users.length; index += 1) {
    const item = users[index];
    const githubId = normalizeNullableString(item.github_id);
    const username = normalizeNullableString(item.username);

    if (!githubId || !username) {
      skipped += 1;
      continue;
    }

    if (existingGithubIds.has(githubId)) {
      skipped += 1;
      continue;
    }

    const id = normalizeNullableString(item.id) || randomUUID();
    const email = normalizeNullableString(item.email);
    const avatarUrl = normalizeNullableString(item.avatar_url);
    const role = item.role === 'admin' ? 'admin' : 'analyst';
    const isActive = normalizeBoolean(item.is_active, true);
    const lastLoginAt = normalizeDate(item.last_login_at);
    const hasLastLogin =
      typeof item.last_login_at === 'string' && item.last_login_at.trim();
    const createdAt = normalizeDate(item.created_at);

    await client.query(
      `
        INSERT INTO users
          (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        id,
        githubId,
        username,
        email,
        avatarUrl,
        role,
        isActive,
        hasLastLogin ? lastLoginAt : null,
        createdAt,
      ],
    );

    existingGithubIds.add(githubId);

    inserted += 1;

    if (inserted % 100 === 0) {
      console.log(
        `Seeding users progress: inserted ${inserted}, skipped ${skipped}`,
      );
    }
  }

  return { inserted, skipped };
}

function buildConnectionConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl:
        process.env.DATABASE_SSL === 'false'
          ? false
          : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    user: process.env.DB_USER || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
    database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  };
}

async function seed() {
  loadRuntimeEnv();

  if (
    !process.env.DATABASE_URL &&
    !process.env.PGHOST &&
    !process.env.DB_HOST
  ) {
    throw new Error(
      'Database env is missing. Set DATABASE_URL or PGHOST/DB_HOST before running scripts/seed.js.',
    );
  }

  const profiles = loadProfileSeed();
  const users = loadUserSeed();

  console.log(`Loaded ${profiles.length} profile(s) from seed file.`);
  console.log(`Loaded ${users.length} user(s) from seed file.`);

  const client = new Client(buildConnectionConfig());

  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log('Connected to PostgreSQL.');

    console.log('Ensuring schema and indexes exist...');
    await client.query('BEGIN');

    await createTables(client);

    const existingNames = await loadExistingProfileNames(client);
    const existingGithubIds = await loadExistingUserGithubIds(client);

    const profileResult = await seedProfiles(client, profiles, existingNames);
    console.log(
      `Inserted profiles: ${profileResult.inserted}, Skipped profiles: ${profileResult.skipped}`,
    );

    const userResult = await seedUsers(client, users, existingGithubIds);
    console.log(
      `Inserted users: ${userResult.inserted}, Skipped users: ${userResult.skipped}`,
    );

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Failed to roll back transaction:', rollbackErr);
    }

    console.error('Error while seeding PostgreSQL database:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seed();
}
