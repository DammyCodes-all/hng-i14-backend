# HNG i14 Backend — Profile Intelligence API

A NestJS REST API that enriches a person's **name** with statistically predicted demographic data (gender, age, nationality) by calling three public inference APIs, stores the result in a local SQLite database, and exposes both structured query filters and a **natural-language search** endpoint so callers can ask things like _"show me young males from Nigeria above 20"_.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Running the Server](#running-the-server)
   - [Seeding the Database](#seeding-the-database)
5. [Environment Variables](#environment-variables)
6. [API Reference](#api-reference)
   - [Health Check](#health-check)
   - [Create Profile](#create-profile)
   - [Get All Profiles (Structured Filters)](#get-all-profiles-structured-filters)
   - [Natural Language Search](#natural-language-search)
   - [Get Single Profile](#get-single-profile)
   - [Delete Profile](#delete-profile)
7. [Profile Object Schema](#profile-object-schema)
8. [Natural Language Parser — Deep Dive](#natural-language-parser--deep-dive)
   - [Overview](#overview)
   - [Supported Keywords and Filter Mapping](#supported-keywords-and-filter-mapping)
   - [How the Logic Works (Step by Step)](#how-the-logic-works-step-by-step)
   - [Example Queries](#example-queries)
9. [Age Group Classification](#age-group-classification)
10. [External API Integrations](#external-api-integrations)
11. [Limitations and Edge Cases](#limitations-and-edge-cases)
12. [Project Structure](#project-structure)

---

## Project Overview

When a client **POSTs a name**, the API concurrently calls:

| External API | What it returns |
|---|---|
| [Genderize.io](https://genderize.io) | Predicted gender + probability |
| [Agify.io](https://agify.io) | Predicted age + count |
| [Nationalize.io](https://nationalize.io) | Most probable country (ISO alpha-2) + probability |

The enriched profile is persisted in SQLite. Duplicate names are detected at creation time and the existing record is returned instead of re-fetching.

Clients can later query profiles using either **explicit query-string filters** (`GET /api/profiles`) or a single **freeform natural-language string** (`GET /api/profiles/search?q=...`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [NestJS](https://nestjs.com/) v11 |
| Language | TypeScript 5.7 (ES2023 target) |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| ORM | [TypeORM](https://typeorm.io/) v0.3 |
| Validation | class-validator + class-transformer |
| Runtime | Node.js |
| Package Manager | pnpm |

---

## Architecture

```
Client
  │
  ▼
NestJS App (main.ts — port 8000)
  │
  ├── AppModule
  │     ├── TypeOrmModule  ──►  SQLite  (db/database.db)
  │     └── ProfileModule
  │           ├── ProfileController   (route handlers, input validation)
  │           ├── ProfileService      (business logic, query building)
  │           ├── dto/profile.dto.ts  (class-validator DTOs)
  │           ├── utils/fetchers.ts   (Genderize / Agify / Nationalize callers)
  │           └── utils/nl-parsers.ts (regex-based NL token extractors)
  │
  └── External APIs
        ├── api.genderize.io
        ├── api.agify.io
        ├── api.nationalize.io
        └── vapi.verifyme.ng  (country-code → name resolver, optional)
```

All three inference API calls for a new profile are made **concurrently** via `Promise.all`, keeping creation latency as low as possible.

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm (`npm i -g pnpm`)

### Installation

```bash
git clone <repo-url>
cd hng-i14-backend
pnpm install
```

### Running the Server

```bash
# development (watch mode)
pnpm dev

# production build then run
pnpm build
pnpm start:prod

# debug mode
pnpm start:debug
```

The API listens on **`http://localhost:8000`** by default (override with `PORT` env var).

### Seeding the Database

A seed script is included to pre-populate the database from a JSON file.

1. Ensure `seed/seed_profiles.json` exists with the following shape:

```json
{
  "profiles": [
    {
      "name": "Alice",
      "gender": "female",
      "gender_probability": 0.98,
      "age": 30,
      "age_group": "adult",
      "country_id": "US",
      "country_name": "United States",
      "country_probability": 0.12
    }
  ]
}
```

2. Run the seed script:

```bash
node scripts/seed.js
```

The script skips any profile whose `name` already exists in the database, so it is safe to run multiple times.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | HTTP port the server binds to |

No API keys are required — all three inference APIs (Genderize, Agify, Nationalize) are free-tier public endpoints that do not need authentication.

---

## API Reference

All endpoints are prefixed with `/api/profiles` except the health-check root.

---

### Health Check

```
GET /
```

**Response `200`**

```json
{
  "status": "success",
  "message": "API is live!"
}
```

---

### Create Profile

```
POST /api/profiles
Content-Type: application/json
```

**Request Body**

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | ✅ | The person's name to enrich |

```json
{ "name": "Emeka" }
```

**Behaviour**
1. Checks the DB for an existing profile with the same `name`. If found, returns it immediately with `"message": "Profile already exists"`.
2. Otherwise, concurrently calls Genderize, Agify and Nationalize.
3. Saves and returns the enriched profile.

**Response `200` — created or existing**

```json
{
  "status": "success",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Emeka",
    "gender": "male",
    "gender_probability": 0.94,
    "age": 32,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": null,
    "country_probability": 0.71,
    "created_at": "2025-01-15T10:22:00.000Z"
  }
}
```

**Error Responses**

| Status | Condition |
|---|---|
| `400` | `name` field is missing or empty |
| `422` | `name` is not a string |
| `502` | Any upstream inference API returned an invalid/empty response |

---

### Get All Profiles (Structured Filters)

```
GET /api/profiles
```

All query parameters are optional.

| Parameter | Type | Constraints | Description |
|---|---|---|---|
| `gender` | `string` | `male` \| `female` | Exact gender match (case-insensitive) |
| `country_id` | `string` | ISO alpha-2 e.g. `NG` | Exact country code match (case-insensitive) |
| `age_group` | `string` | `child` \| `teenager` \| `adult` \| `senior` | Exact age-group match |
| `min_age` | `integer` | >= 0 | Minimum age (inclusive) |
| `max_age` | `integer` | >= 0 | Maximum age (inclusive) |
| `min_gender_probability` | `number` | 0–1 | Minimum gender prediction confidence |
| `min_country_probability` | `number` | 0–1 | Minimum nationality prediction confidence |
| `sort_by` | `string` | `created_at` \| `age` \| `gender_probability` | Sort field |
| `order` | `string` | `asc` \| `desc` | Sort direction (default: `asc`) |
| `page` | `integer` | >= 1 | Page number (default: `1`) |
| `limit` | `integer` | 1–50 | Results per page (default: `10`) |

**Example**

```
GET /api/profiles?gender=female&age_group=adult&min_age=25&sort_by=age&order=asc&page=1&limit=5
```

**Response `200`**

```json
{
  "status": "success",
  "total": 42,
  "page": 1,
  "limit": 5,
  "data": [ ...profiles ]
}
```

---

### Natural Language Search

```
GET /api/profiles/search?q=<natural language query>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `q` | `string` | ✅ | Freeform English search query |
| `page` | `integer` | ❌ | Page number (default: `1`) |
| `limit` | `integer` | ❌ | Results per page, max 50 (default: `10`) |

**Example**

```
GET /api/profiles/search?q=young+males+from+Nigeria+above+20&page=1&limit=10
```

**Response `200`**

```json
{
  "status": "success",
  "total": 7,
  "page": 1,
  "limit": 10,
  "data": [ ...profiles ]
}
```

> See the **[Natural Language Parser — Deep Dive](#natural-language-parser--deep-dive)** section for a full explanation of what queries are supported.

---

### Get Single Profile

```
GET /api/profiles/:id
```

`:id` must be a valid UUID v4.

**Response `200`**

```json
{
  "status": "success",
  "data": { ...profile }
}
```

**Response `404`**

```json
{
  "status": "error",
  "message": "Not Found: Profile not found"
}
```

---

### Delete Profile

```
DELETE /api/profiles/:id
```

**Response `204 No Content`** — on success, body is empty.

---

## Profile Object Schema

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Unique identifier |
| `name` | `string` | Original name submitted |
| `gender` | `string \| null` | `"male"` or `"female"` |
| `gender_probability` | `number \| null` | Confidence score 0–1 |
| `age` | `integer \| null` | Predicted age in years |
| `age_group` | `string \| null` | `"child"`, `"teenager"`, `"adult"`, or `"senior"` |
| `country_id` | `string \| null` | ISO alpha-2 country code |
| `country_name` | `string \| null` | Human-readable country name (may be null) |
| `country_probability` | `number \| null` | Confidence score 0–1 |
| `created_at` | `string` (ISO 8601) | Record creation timestamp |

---

## Natural Language Parser — Deep Dive

### Overview

The `GET /api/profiles/search` endpoint accepts a single freeform `q` string and translates it into a set of AND-combined SQL `WHERE` clauses using a **keyword-spotting** approach. The parser does **not** use an NLP library or machine learning model — instead it relies on:

- **String inclusion checks** (`query.includes(keyword)`) for categorical concepts like gender and age group.
- **Regular expressions** for numeric range extraction and country parsing.

The input string is lowercased before all keyword checks, but the original case is preserved for regex operations to support mixed-case country codes.

---

### Supported Keywords and Filter Mapping

#### 1. Gender

Detected via case-insensitive substring scan on the lowercased query.

| Keyword(s) in query | Maps to SQL filter |
|---|---|
| `"female"` or `"females"` | `WHERE gender = 'female'` |
| `"male"` or `"males"` | `WHERE gender = 'male'` |
| `"male and female"` | No gender filter (both genders) |

**Priority rule:** `"male and female"` is tested _first_. If that phrase is present, no gender filter is applied even if `"male"` and `"female"` would individually also match.

**Important:** Because the check is a plain `includes()`, the word `"female"` is matched _before_ `"male"` in the conditional chain, so `"female"` in a query will never accidentally resolve to `"male"`.

---

#### 2. Age Group

Detected via case-insensitive substring scan. Only one age group can match per query — the first matching keyword wins.

| Keyword in query | Maps to SQL filter |
|---|---|
| `"child"` | `WHERE age_group = 'child'` |
| `"teenager"` | `WHERE age_group = 'teenager'` |
| `"adult"` | `WHERE age_group = 'adult'` |
| `"senior"` | `WHERE age_group = 'senior'` |

---

#### 3. Age Range Shorthand

Detected via case-insensitive substring scan. Maps to a numeric `BETWEEN` clause.

| Keyword in query | Maps to SQL filter |
|---|---|
| `"young"` | `WHERE age BETWEEN 16 AND 24` |
| `"old"` | `WHERE age BETWEEN 60 AND 120` |

These are **additive** with any age-group filter. For example, a query of `"young adults"` would produce both `age_group = 'adult'` (from "adult") and `age BETWEEN 16 AND 24` (from "young").

---

#### 4. Minimum Age (Above / Over)

Parsed by `parseAboveValue()` in `utils/nl-parsers.ts` using a regex.

**Regex:**
```
/(?:above|over|more than|older than| >)\s*(\d+)\b/i
```

| Phrase example | Maps to SQL filter |
|---|---|
| `"above 30"` | `WHERE age >= 30` |
| `"over 25"` | `WHERE age >= 25` |
| `"more than 18"` | `WHERE age >= 18` |
| `"older than 40"` | `WHERE age >= 40` |
| `"> 50"` | `WHERE age >= 50` |

---

#### 5. Maximum Age (Below / Under)

Parsed by `parseBelowValue()` in `utils/nl-parsers.ts` using a regex.

**Regex:**
```
/(?:below|under|less than|younger than|<)\s*(\d+)\b/i
```

| Phrase example | Maps to SQL filter |
|---|---|
| `"below 60"` | `WHERE age <= 60` |
| `"under 35"` | `WHERE age <= 35` |
| `"less than 50"` | `WHERE age <= 50` |
| `"younger than 25"` | `WHERE age <= 25` |
| `"< 30"` | `WHERE age <= 30` |

---

#### 6. Country (From)

Parsed by `parseFromCountry()` in `utils/nl-parsers.ts`.

**Regex:**
```
/\bfrom\s+([A-Za-z][A-Za-z\s\.\-']{0,60})/i
```

The logic after matching:

1. The captured token is trimmed.
2. A leading `"the "` is stripped (handles `"from the United Kingdom"`).
3. The candidate is **compacted** by removing dots and spaces (e.g. `"U.S."` → `"US"`).
4. If the compact form is **2–3 alphabetic characters**, it is treated as an **ISO country code** and matched with `WHERE UPPER(country_id) = '<CODE>'`.
5. Otherwise the original candidate is used for a **fuzzy LIKE match**: `WHERE LOWER(country_name) LIKE '%<name>%'`.

| Phrase example | Interpretation | Maps to SQL filter |
|---|---|---|
| `"from NG"` | 2-letter code | `WHERE country_id = 'NG'` |
| `"from USA"` | 3-letter code | `WHERE country_id = 'USA'` |
| `"from U.S."` | compact → `US` | `WHERE country_id = 'US'` |
| `"from Nigeria"` | full name (7 chars) | `WHERE country_name LIKE '%nigeria%'` |
| `"from the United Kingdom"` | leading `the` stripped | `WHERE country_name LIKE '%united kingdom%'` |

---

### How the Logic Works (Step by Step)

When a request hits `GET /api/profiles/search?q=show+me+young+females+from+Nigeria+above+20`, the service:

1. **Receives** the raw query string `q` from the validated `SearchProfileDto`.
2. **Lowercases** the raw string into a working `query` variable.
3. **Initialises** a TypeORM `QueryBuilder` on the `profiles` table.
4. **Detects gender** — scans for `"male and female"`, `"female"/"females"`, `"male"/"males"` in that exact priority order. Appends `andWhere('gender = :gender')` if a match is found.
5. **Detects age group** — scans for `"child"`, `"teenager"`, `"adult"`, `"senior"` with a chained ternary. Appends `andWhere('age_group = :age_group')` if matched.
6. **Detects age shorthand** — checks for `"young"` or `"old"` and appends `andWhere('age BETWEEN :min AND :max')` if matched.
7. **Calls `parseAboveValue(raw)`** — runs the above-regex against the *original-case* raw string. If a number is found, appends `andWhere('age >= :min_age')`.
8. **Calls `parseBelowValue(raw)`** — runs the below-regex. If a number is found, appends `andWhere('age <= :max_age')`.
9. **Calls `parseFromCountry(raw)`** — runs the from-regex. Appends either an exact `country_id` match or a `LIKE` match on `country_name`.
10. **Applies pagination** — `skip((page - 1) * limit).take(limit)`.
11. **Executes** `getManyAndCount()` and returns `{ status, total, page, limit, data }`.

All filters are combined with `AND`. There is no `OR` logic in the search endpoint.

---

### Example Queries

| Natural Language Query | Filters Applied |
|---|---|
| `"show me all females"` | `gender = 'female'` |
| `"adult males"` | `age_group = 'adult'` AND `gender = 'male'` |
| `"teenagers from NG"` | `age_group = 'teenager'` AND `country_id = 'NG'` |
| `"young females from Nigeria above 20"` | `age BETWEEN 16 AND 24` AND `gender = 'female'` AND `country_name LIKE '%nigeria%'` AND `age >= 20` |
| `"seniors older than 65"` | `age_group = 'senior'` AND `age >= 65` |
| `"people below 30 from the United States"` | `age <= 30` AND `country_name LIKE '%united states%'` |
| `"males and females"` | *(no gender filter applied)* |
| `"old people under 80"` | `age BETWEEN 60 AND 120` AND `age <= 80` |

---

## Age Group Classification

Age groups are assigned at profile creation time by `fetchAge()` in `utils/fetchers.ts` based on the age returned by Agify.io:

| Age Range | Age Group |
|---|---|
| 0 – 11 | `"child"` |
| 12 – 18 | `"teenager"` |
| 19 – 58 | `"adult"` |
| 59+ | `"senior"` |

---

## External API Integrations

| API | Endpoint | Docs |
|---|---|---|
| Genderize.io | `https://api.genderize.io/?name=<name>` | https://genderize.io |
| Agify.io | `https://api.agify.io/?name=<name>` | https://agify.io |
| Nationalize.io | `https://api.nationalize.io/?name=<name>` | https://nationalize.io |

All three calls are fired concurrently on profile creation. If any API returns a non-OK HTTP status or an empty/null payload, the service throws a `502 Bad Gateway` with a message identifying the failing upstream.

The `fetchCountryName` helper in `src/types.ts` optionally resolves a country code to a human-readable name via the **VerifyMe** API (`https://vapi.verifyme.ng/v1/countries/:id`), but this is not wired into the current creation flow — `country_name` is stored as `null` for newly created profiles.

---

## Limitations and Edge Cases

### Natural Language Parser

| Limitation | Detail |
|---|---|
| **No NLP / semantic understanding** | The parser is purely lexical. It cannot understand paraphrasing, synonyms, or sentence structure beyond the specific patterns it was written for. |
| **Single keyword wins for age group** | The ternary chain picks the *first* matching age-group keyword. A query like `"child and teenager"` will only match `"child"` because it is checked first. |
| **`"young"` and `"old"` are not mutually exclusive with age groups** | `"old adults"` produces both `age_group = 'adult'` AND `age BETWEEN 60 AND 120`, which can return an empty result set since the adult age group only covers 19–58. |
| **"male" is a substring of "female"** | This is mitigated by always checking `"female"/"females"` before `"male"/"males"` in the conditional chain, but a query like `"non-male"` would still match `male` because `includes()` doesn't understand negation. |
| **No negation support** | Phrases like `"not male"`, `"excluding seniors"`, or `"not from Nigeria"` are not parsed. The parser has no concept of logical NOT. |
| **No OR logic** | All extracted filters are AND-combined. A query like `"males or females from US"` cannot express disjunction. |
| **`"from"` keyword is required for country** | Phrases like `"people in Nigeria"` or `"Nigerian people"` do not trigger the country filter — only `"from <country>"` is detected. |
| **Country name matching is broad** | `"from an"` would capture `"an"` as a country name and produce `WHERE country_name LIKE '%an%'`, matching any country whose name contains "an" (e.g. France, Japan, Ghana). |
| **"from" can collide with other text** | If the query contains `"from"` in a non-country context (e.g. `"profiles from last week"`), the parser will still attempt to extract a country name from whatever follows `"from"`. |
| **Only the first numeric match is used** | `parseAboveValue` and `parseBelowValue` each return the first regex match. A query with two numbers like `"above 20 above 30"` uses `20`, not `30`. |
| **"young" age bracket (16–24) excludes under-16s** | A 10-year-old child would not match a `"young"` query, even though colloquially "young" often includes children. |
| **No date/time parsing** | Queries involving time (e.g. `"profiles created this week"`, `"recent entries"`) are silently ignored. |
| **Pagination not reflected in total** | `total` reflects the count of all matching rows, not the number of rows on the current page, which is standard REST pagination behaviour but worth noting. |

### General API Limitations

| Limitation | Detail |
|---|---|
| **Name deduplication is exact-match only** | `"Alice"` and `"alice"` are treated as different profiles because the uniqueness check is case-sensitive (`WHERE name = ?`). |
| **No update endpoint** | Once a profile is created, its inferred data cannot be refreshed even if the upstream APIs return different predictions over time. |
| **SQLite in-process DB** | The database is a single file (`db/database.db`). It is not suitable for multi-process or horizontally scaled deployments without replacement by a proper RDBMS. |
| **No authentication or rate limiting** | All endpoints are public. There is no API key, JWT guard, or request rate limiter. |
| **Upstream API rate limits** | Genderize, Agify, and Nationalize impose daily request limits on their free tiers. High creation throughput will exhaust these limits. |
| **`sort_by` is limited to three fields** | Only `created_at`, `age`, and `gender_probability` are accepted as sort fields by the DTO validator. |
| **`country_name` is always null for new profiles** | The `fetchCountryName` helper from `src/types.ts` is defined but not called during profile creation, so `country_name` is persisted as `null` for all API-created records. |

---

## Project Structure

```
hng-i14-backend/
├── db/
│   └── database.db              # SQLite database file (auto-created)
├── dist/                        # Compiled JS output (after pnpm build)
├── scripts/
│   └── seed.js                  # Database seed script
├── seed/
│   └── seed_profiles.json       # Seed data file
├── src/
│   ├── app.controller.ts        # Root health-check route
│   ├── app.module.ts            # Root module (TypeORM config)
│   ├── app.service.ts           # Root service (health message)
│   ├── main.ts                  # Bootstrap, CORS, ValidationPipe, port
│   ├── types.ts                 # Shared interfaces + fetchCountryName helper
│   └── profile/
│       ├── profile.controller.ts   # Route definitions + input guards
│       ├── profile.entity.ts       # TypeORM entity (profiles table)
│       ├── profile.module.ts       # Profile feature module
│       ├── profile.service.ts      # Business logic + query builders
│       ├── dto/
│       │   └── profile.dto.ts      # GetAllProfileQueryDto, SearchProfileDto
│       └── utils/
│           ├── fetchers.ts         # fetchGender, fetchAge, fetchNation
│           └── nl-parsers.ts       # parseAboveValue, parseBelowValue, parseFromCountry
├── test/                        # e2e test config
├── nest-cli.json
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── tsconfig.build.json
```

---

## License

UNLICENSED — private project.
