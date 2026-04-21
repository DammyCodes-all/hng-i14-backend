const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');
const seedFile = path.join(projectRoot, 'seed', 'seed_profiles.json');
const dbFile = path.join(projectRoot, 'db', 'database.db');

function loadSeed() {
  if (!fs.existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(seedFile, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse JSON seed file:', err.message);
    process.exit(1);
  }

  // Support multiple shapes: { profiles: [...] } or an array directly
  let profiles = [];

  if (Array.isArray(parsed.profiles)) {
    profiles = parsed.profiles;
  } else {
    console.error('Seed file JSON does not contain an array of profiles.');
    process.exit(1);
  }

  return profiles;
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

function seed() {
  const profiles = loadSeed();
  console.log(`Loaded ${profiles.length} profile(s) from seed file.`);

  ensureDbDir(dbFile);

  const db = new Database(dbFile);
  try {
    // Ensure table exists
    createTableIfNotExists(db);

    // Prepare statements
    const findByName = db.prepare(
      'SELECT 1 FROM profiles WHERE name = ? LIMIT 1',
    );
    const insertStmt = db.prepare(
      `INSERT INTO profiles
        (id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  } catch (err) {
    console.error('Error while seeding database:', err);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  seed();
}
