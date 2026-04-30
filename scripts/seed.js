const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');
const seedFile = path.join(projectRoot, 'seed', 'seed_profiles.json');
const userSeedFile = path.join(projectRoot, 'seed', 'seed_users.json');
const dbFile = path.join(projectRoot, 'db', 'database.db');

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
  return loadSeedFile(seedFile, 'profiles');
}

function loadUserSeed() {
  return loadSeedFile(userSeedFile, 'users');
}

function ensureDbDir(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createTableIfNotExists(db) {
  const createSql = `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NULL,
      gender_probability REAL NULL,
      age INTEGER NULL,
      age_group TEXT NULL,
      country_id TEXT NULL,
      country_name TEXT NULL,
      country_probability REAL NULL,
      created_at TEXT NOT NULL
    )
  `;
  db.prepare(createSql).run();
}

function createUsersTableIfNotExists(db) {
  const createSql = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      github_id TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL,
      email TEXT NULL,
      avatar_url TEXT NULL,
      role TEXT NOT NULL DEFAULT 'analyst',
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT NULL,
      created_at TEXT NOT NULL
    )
  `;
  db.prepare(createSql).run();
}

function seed() {
  const profiles = loadProfileSeed();
  const users = loadUserSeed();
  console.log(`Loaded ${profiles.length} profile(s) from seed file.`);
  console.log(`Loaded ${users.length} user(s) from seed file.`);

  ensureDbDir(dbFile);

  const db = new Database(dbFile);
  try {
    // Ensure table exists
    createTableIfNotExists(db);
    createUsersTableIfNotExists(db);

    // Prepare statements
    const findByName = db.prepare(
      'SELECT 1 FROM profiles WHERE name = ? LIMIT 1',
    );
    const findUserByGithubId = db.prepare(
      'SELECT 1 FROM users WHERE github_id = ? LIMIT 1',
    );
    const insertStmt = db.prepare(
      `INSERT INTO profiles
        (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertUserStmt = db.prepare(
      `INSERT INTO users
        (id, github_id, username, email, avatar_url, role, is_active, last_login_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    // Transaction for bulk insert
    const insertMany = db.transaction((items) => {
      let skipped = 0;
      let inserted = 0;
      for (const item of items) {
        // Normalize item shape: allow both with/without nulls
        const name = typeof item.name === 'string' ? item.name.trim() : null;
        if (!name) {
          skipped++;
          continue;
        }

        // Skip if a profile with same name exists (to avoid duplicates)
        const exists = findByName.get(name);
        if (exists) {
          skipped++;
          continue;
        }

        const id = item.id || randomUUID();
        const gender = item.gender ?? null;
        // Ensure numeric probabilities are numbers or null
        const gender_probability =
          item.gender_probability != null &&
          !Number.isNaN(Number(item.gender_probability))
            ? Number(item.gender_probability)
            : null;
        const age =
          item.age != null && !Number.isNaN(Number(item.age))
            ? Number(item.age)
            : null;
        const age_group = item.age_group ?? null;
        const country_id = item.country_id ?? null;
        const country_name = item.country_name ?? null;
        const country_probability =
          item.country_probability != null &&
          !Number.isNaN(Number(item.country_probability))
            ? Number(item.country_probability)
            : null;
        const created_at =
          item.created_at && typeof item.created_at === 'string'
            ? item.created_at
            : new Date().toISOString();

        insertStmt.run(
          id,
          name,
          gender,
          gender_probability,
          age,
          age_group,
          country_id,
          country_name,
          country_probability,
          created_at,
        );
        inserted++;
      }
      return { inserted, skipped };
    });

    const { inserted, skipped } = insertMany(profiles);
    console.log(`Inserted: ${inserted}, Skipped: ${skipped}`);

    const insertUsers = db.transaction((items) => {
      let skipped = 0;
      let inserted = 0;

      for (const item of items) {
        const githubId =
          typeof item.github_id === 'string' ? item.github_id.trim() : null;
        const username =
          typeof item.username === 'string' ? item.username.trim() : null;

        if (!githubId || !username) {
          skipped++;
          continue;
        }

        const exists = findUserByGithubId.get(githubId);
        if (exists) {
          skipped++;
          continue;
        }

        const id = item.id || randomUUID();
        const email = item.email ?? null;
        const avatar_url = item.avatar_url ?? null;
        const role = item.role === 'admin' ? 'admin' : 'analyst';
        const is_active = item.is_active === false ? 0 : 1;
        const last_login_at =
          item.last_login_at && typeof item.last_login_at === 'string'
            ? item.last_login_at
            : null;
        const created_at =
          item.created_at && typeof item.created_at === 'string'
            ? item.created_at
            : new Date().toISOString();

        insertUserStmt.run(
          id,
          githubId,
          username,
          email,
          avatar_url,
          role,
          is_active,
          last_login_at,
          created_at,
        );
        inserted++;
      }

      return { inserted, skipped };
    });

    const userResult = insertUsers(users);
    console.log(
      `Inserted users: ${userResult.inserted}, Skipped users: ${userResult.skipped}`,
    );
  } catch (err) {
    console.error('Error while seeding database:', err);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seed();
}
