# HNG i14 Backend

NestJS backend for the Profile Intelligence System. It enriches submitted names with demographic predictions, stores profiles in SQLite, and now includes Stage 3 auth, RBAC, pagination links, CSV export, rate limiting, and request logging.

## What this repo does

- Enriches a name with predicted gender, age, and country data.
- Persists profiles in SQLite through TypeORM.
- Supports GitHub OAuth with PKCE for browser and CLI clients.
- Issues short-lived access tokens and rotating refresh tokens.
- Enforces role-based access control on `/api/*` profile routes.
- Supports structured filters, natural-language search, pagination metadata, and CSV export.
- Uses centralized environment configuration through `@nestjs/config`.

## Tech stack

- NestJS 11
- TypeScript 5.7
- TypeORM 0.3
- SQLite via `better-sqlite3`
- `jsonwebtoken` for access tokens
- `@nestjs/config` for env management
- `@nestjs/throttler` for rate limiting
- `class-validator` and `class-transformer` for DTO validation

## Architecture

```text
Client
  ├─ /auth/*  -> OAuth, token issuance, refresh, logout, me
  └─ /api/*   -> protected profile APIs

NestJS app
  ├─ AppConfigModule -> centralized env loading and validation
  ├─ AuthModule      -> OAuth, JWT, refresh tokens, RBAC support
  ├─ ProfileModule   -> profile CRUD, search, export
  ├─ UsersModule     -> GitHub-backed user records and role assignment
  └─ TypeORM         -> SQLite database at db/database.db
```

## Prerequisites

- Node.js 18+ recommended
- pnpm
- A GitHub OAuth App

## Installation

```bash
pnpm install
```

## Environment variables

Create a `.env` file in the project root.

| Variable               | Required | Description                                                                             |
| ---------------------- | -------- | --------------------------------------------------------------------------------------- |
| `PORT`                 | No       | HTTP port for the server. The app currently falls back to `3000` in `main.ts` if unset. |
| `NODE_ENV`             | No       | Used for cookie security.                                                               |
| `GITHUB_CLIENT_ID`     | Yes      | GitHub OAuth client ID.                                                                 |
| `GITHUB_CLIENT_SECRET` | Yes      | GitHub OAuth client secret.                                                             |
| `JWT_ACCESS_SECRET`    | Yes      | Secret used to sign access tokens.                                                      |
| `JWT_REFRESH_SECRET`   | Yes      | Reserved for refresh-token related signing/validation needs.                            |
| `BACKEND_URL`          | Yes      | Public backend URL used to build OAuth callback URLs.                                   |
| `WEB_PORTAL_URL`       | Yes      | Public web portal URL used by the browser flow.                                         |
| `CLI_CALLBACK_PORT`    | No       | Reserved for CLI callback handling. Defaults to `9876` in config service.               |

### Example

```env
PORT=8000
NODE_ENV=development
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
JWT_ACCESS_SECRET=super_secret_access_token_key
JWT_REFRESH_SECRET=super_secret_refresh_token_key
BACKEND_URL=http://localhost:8000
WEB_PORTAL_URL=http://localhost:3000
CLI_CALLBACK_PORT=9876
```

## Running the app

```bash
pnpm dev
```

Other scripts:

- `pnpm start` - start the app once
- `pnpm start:debug` - start with debugger attached
- `pnpm test` - run unit tests
- `pnpm test:e2e` - run e2e tests
- `pnpm lint` - lint and auto-fix

## Data storage

- Database file: `db/database.db`
- ORM behavior: `synchronize: true`
- Entities are auto-loaded by TypeORM

Because schema synchronization is enabled, tables are created or updated on startup instead of through migrations.

## Authentication overview

### OAuth flow

1. `GET /auth/github?mode=web|cli` starts GitHub OAuth with PKCE.
2. `GET /auth/github/callback` exchanges the GitHub code, creates or updates the local user, and issues tokens.
3. `POST /auth/refresh` rotates refresh tokens.
4. `POST /auth/logout` invalidates refresh tokens server-side.
5. `GET /auth/me` returns the current access-token identity.

### Token behavior

- Access token lifetime: 3 minutes
- Refresh token lifetime: 5 minutes
- Refresh tokens are one-time use and are hashed before storage
- Browser flow sets HttpOnly cookies with `SameSite: Strict`
- CLI flow returns JSON with `access_token` and `refresh_token`

### Roles

- `admin` - full profile management access
- `analyst` - read/search/export access only

The first authenticated user is promoted to `admin`; later users default to `analyst`.

## CLI integration

The backend is compatible with the Insighta CLI flow and exposes the same auth and profile APIs used by the browser client.

### CLI auth flow

1. The CLI starts login with `GET /auth/github?mode=cli`.
2. The backend creates the OAuth state, PKCE verifier, and GitHub authorization URL.
3. The CLI opens the returned authorization URL in the browser.
4. GitHub redirects back to `GET /auth/github/callback`.
5. When the request is in CLI mode, the callback returns JSON with `access_token`, `refresh_token`, and `user` data.
6. The CLI stores credentials locally, in `~/.insighta/credentials.json`.

### CLI commands supported by this backend

- `insighta login` - starts the GitHub OAuth flow and saves tokens.
- `insighta logout` - revokes the refresh token and clears local credentials.
- `insighta whoami` - fetches the current access-token identity from `GET /auth/me`.
- `insighta profiles list` - calls `GET /api/profiles` with filters, pagination, and sorting.
- `insighta profiles search` - calls `GET /api/profiles/search?q=...` for natural-language queries.
- `insighta profiles get <id>` - calls `GET /api/profiles/:id`.
- `insighta profiles create --name <name>` - calls `POST /api/profiles`.
- `insighta profiles export` - calls `GET /api/profiles/export?format=csv`.

### CLI credential model

- Access tokens are short lived and expire after 3 minutes.
- Refresh tokens are used to obtain new access and refresh tokens through `POST /auth/refresh`.
- CLI requests should send the access token in the `Authorization: Bearer <token>` header.
- CLI profile requests must also send `X-API-Version: 1`.

### CLI storage convention

The CLI README from the separate repo stores credentials at `~/.insighta/credentials.json`. A compatible file can include:

```json
{
  "access_token": "jwt_token",
  "refresh_token": "jwt_token",
  "api_url": "http://localhost:8000",
  "user": {
    "id": "uuid",
    "username": "github_username",
    "role": "admin"
  }
}
```

### CLI compatibility notes

- The backend already supports `mode=cli` on `/auth/github` and `/auth/github/callback`.
- The CLI should treat the callback response as JSON and persist the returned tokens.
- Profile list and search responses include pagination links, so CLI clients can page forward and backward without rebuilding query strings.
- Search links preserve the `q` parameter and use `/api/profiles/search` as the base path.

- All `/api/*` profile routes require authentication.
- Inactive users are rejected with `403`.
- Profile routes use role metadata and a centralized `RolesGuard`.
- Profile routes require `X-API-Version: 1`.
- Missing version header returns:

```json
{
  "status": "error",
  "message": "API version header required"
}
```

- Auth routes are rate-limited to 10 requests per minute.
- Other protected routes are rate-limited to 60 requests per minute per authenticated user.

## Request logging

Every request is logged by middleware with:

- method
- path
- statusCode
- durationMs
- user hint
- ip
- timestamp

## API reference

### Health check

```http
GET /
```

Response:

```json
{
  "status": "success",
  "message": "API is live!"
}
```

### Auth routes

#### Start GitHub login

```http
GET /auth/github?mode=web
GET /auth/github?mode=cli
```

Redirects to GitHub OAuth.

#### GitHub callback

```http
GET /auth/github/callback?code=...&state=...&mode=web
GET /auth/github/callback?code=...&state=...&mode=cli
```

- `mode=web` sets HttpOnly cookies and returns tokens in JSON.
- `mode=cli` returns tokens in JSON only.

#### Refresh session

```http
POST /auth/refresh
```

Body:

```json
{
  "refresh_token": "string"
}
```

#### Logout

```http
POST /auth/logout
```

Body:

```json
{
  "refresh_token": "string"
}
```

#### Current user

```http
GET /auth/me
```

### Profile routes

All profile endpoints require:

- authentication
- `X-API-Version: 1`
- role-based authorization

#### Create profile

```http
POST /api/profiles
```

Body:

```json
{
  "name": "Emeka"
}
```

Roles:

- `admin` only

#### List profiles

```http
GET /api/profiles
```

Supported query parameters:

- `gender`
- `country_id`
- `age_group`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`
- `sort_by`
- `order`
- `page`
- `limit`

Response shape:

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 42,
  "total_pages": 5,
  "links": {
    "self": "...",
    "next": "...",
    "prev": "..."
  },
  "data": []
}
```

#### Natural-language search

```http
GET /api/profiles/search?q=young+males+from+Nigeria+above+20
```

Returns the same pagination envelope as list queries.

#### Get one profile

```http
GET /api/profiles/:id
```

#### Delete profile

```http
DELETE /api/profiles/:id
```

Roles:

- `admin` only

#### CSV export

```http
GET /api/profiles/export?format=csv
```

Returns `text/csv` with a downloadable filename.

Column order:

```text
id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at
```

## Profile object

```json
{
  "id": "uuid",
  "name": "Emeka",
  "gender": "male",
  "gender_probability": 0.94,
  "age": 32,
  "age_group": "adult",
  "country_id": "NG",
  "country_name": null,
  "country_probability": 0.71,
  "created_at": "2026-04-29T12:00:00.000Z"
}
```

## Database models

### Users

- `id` UUID v7 primary key
- `github_id` unique
- `username`
- `email`
- `avatar_url`
- `role` (`admin` or `analyst`)
- `is_active`
- `last_login_at`
- `created_at`

### Refresh tokens

- stores hashed refresh tokens
- linked to a user
- tracks expiry and invalidation state

## Current limitations

- SQLite is used for local persistence.
- TypeORM synchronization is enabled, so this is not a migration-driven setup.
- The app defaults to `3000` at runtime when `PORT` is unset, even though the config service exposes `8000` as its fallback getter value.

## Project structure

```text
src/
  app.module.ts
  main.ts
  app.controller.ts
  app.service.ts
  config/
  auth/
  profile/
  users/
  filters/
  common/middleware/
db/
scripts/
seed/
test/
```

## Seeding

Seed data is stored in `seed/seed_profiles.json` and can be loaded with:

```bash
node scripts/seed.js
```

The seed script skips duplicates by name.

## Notes for contributors

- Keep profile response shapes stable when changing filters or search logic.
- Keep auth errors standardized as `{ "status": "error", "message": "..." }`.

**Priority rule:** `"male and female"` is tested _first_. If that phrase is present, no gender filter is applied even if `"male"` and `"female"` would individually also match.

**Important:** Because the check is a plain `includes()`, the word `"female"` is matched _before_ `"male"` in the conditional chain, so `"female"` in a query will never accidentally resolve to `"male"`.

---

#### 2. Age Group

Detected via case-insensitive substring scan. Only one age group can match per query — the first matching keyword wins.

| Keyword in query | Maps to SQL filter             |
| ---------------- | ------------------------------ |
| `"child"`        | `WHERE age_group = 'child'`    |
| `"teenager"`     | `WHERE age_group = 'teenager'` |
| `"adult"`        | `WHERE age_group = 'adult'`    |
| `"senior"`       | `WHERE age_group = 'senior'`   |

---

#### 3. Age Range Shorthand

Detected via case-insensitive substring scan. Maps to a numeric `BETWEEN` clause.

| Keyword in query | Maps to SQL filter             |
| ---------------- | ------------------------------ |
| `"young"`        | `WHERE age BETWEEN 16 AND 24`  |
| `"old"`          | `WHERE age BETWEEN 60 AND 120` |

These are **additive** with any age-group filter. For example, a query of `"young adults"` would produce both `age_group = 'adult'` (from "adult") and `age BETWEEN 16 AND 24` (from "young").

---

#### 4. Minimum Age (Above / Over)

Parsed by `parseAboveValue()` in `utils/nl-parsers.ts` using a regex.

**Regex:**

```
/(?:above|over|more than|older than| >)\s*(\d+)\b/i
```

| Phrase example    | Maps to SQL filter |
| ----------------- | ------------------ |
| `"above 30"`      | `WHERE age >= 30`  |
| `"over 25"`       | `WHERE age >= 25`  |
| `"more than 18"`  | `WHERE age >= 18`  |
| `"older than 40"` | `WHERE age >= 40`  |
| `"> 50"`          | `WHERE age >= 50`  |

---

#### 5. Maximum Age (Below / Under)

Parsed by `parseBelowValue()` in `utils/nl-parsers.ts` using a regex.

**Regex:**

```
/(?:below|under|less than|younger than|<)\s*(\d+)\b/i
```

| Phrase example      | Maps to SQL filter |
| ------------------- | ------------------ |
| `"below 60"`        | `WHERE age <= 60`  |
| `"under 35"`        | `WHERE age <= 35`  |
| `"less than 50"`    | `WHERE age <= 50`  |
| `"younger than 25"` | `WHERE age <= 25`  |
| `"< 30"`            | `WHERE age <= 30`  |

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

| Phrase example              | Interpretation         | Maps to SQL filter                           |
| --------------------------- | ---------------------- | -------------------------------------------- |
| `"from NG"`                 | 2-letter code          | `WHERE country_id = 'NG'`                    |
| `"from USA"`                | 3-letter code          | `WHERE country_id = 'USA'`                   |
| `"from U.S."`               | compact → `US`         | `WHERE country_id = 'US'`                    |
| `"from Nigeria"`            | full name (7 chars)    | `WHERE country_name LIKE '%nigeria%'`        |
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
7. **Calls `parseAboveValue(raw)`** — runs the above-regex against the _original-case_ raw string. If a number is found, appends `andWhere('age >= :min_age')`.
8. **Calls `parseBelowValue(raw)`** — runs the below-regex. If a number is found, appends `andWhere('age <= :max_age')`.
9. **Calls `parseFromCountry(raw)`** — runs the from-regex. Appends either an exact `country_id` match or a `LIKE` match on `country_name`.
10. **Applies pagination** — `skip((page - 1) * limit).take(limit)`.
11. **Executes** `getManyAndCount()` and returns `{ status, total, page, limit, data }`.

All filters are combined with `AND`. There is no `OR` logic in the search endpoint.

---

### Example Queries

| Natural Language Query                     | Filters Applied                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `"show me all females"`                    | `gender = 'female'`                                                                                 |
| `"adult males"`                            | `age_group = 'adult'` AND `gender = 'male'`                                                         |
| `"teenagers from NG"`                      | `age_group = 'teenager'` AND `country_id = 'NG'`                                                    |
| `"young females from Nigeria above 20"`    | `age BETWEEN 16 AND 24` AND `gender = 'female'` AND `country_name LIKE '%nigeria%'` AND `age >= 20` |
| `"seniors older than 65"`                  | `age_group = 'senior'` AND `age >= 65`                                                              |
| `"people below 30 from the United States"` | `age <= 30` AND `country_name LIKE '%united states%'`                                               |
| `"males and females"`                      | _(no gender filter applied)_                                                                        |
| `"old people under 80"`                    | `age BETWEEN 60 AND 120` AND `age <= 80`                                                            |

---

## Age Group Classification

Age groups are assigned at profile creation time by `fetchAge()` in `utils/fetchers.ts` based on the age returned by Agify.io:

| Age Range | Age Group    |
| --------- | ------------ |
| 0 – 11    | `"child"`    |
| 12 – 18   | `"teenager"` |
| 19 – 58   | `"adult"`    |
| 59+       | `"senior"`   |

---

## External API Integrations

| API            | Endpoint                                  | Docs                   |
| -------------- | ----------------------------------------- | ---------------------- |
| Genderize.io   | `https://api.genderize.io/?name=<name>`   | https://genderize.io   |
| Agify.io       | `https://api.agify.io/?name=<name>`       | https://agify.io       |
| Nationalize.io | `https://api.nationalize.io/?name=<name>` | https://nationalize.io |

All three calls are fired concurrently on profile creation. If any API returns a non-OK HTTP status or an empty/null payload, the service throws a `502 Bad Gateway` with a message identifying the failing upstream.

The `fetchCountryName` helper in `src/types.ts` optionally resolves a country code to a human-readable name via the **VerifyMe** API (`https://vapi.verifyme.ng/v1/countries/:id`), but this is not wired into the current creation flow — `country_name` is stored as `null` for newly created profiles.

---

## Limitations and Edge Cases

### Natural Language Parser

| Limitation                                                           | Detail                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No NLP / semantic understanding**                                  | The parser is purely lexical. It cannot understand paraphrasing, synonyms, or sentence structure beyond the specific patterns it was written for.                                                                    |
| **Single keyword wins for age group**                                | The ternary chain picks the _first_ matching age-group keyword. A query like `"child and teenager"` will only match `"child"` because it is checked first.                                                           |
| **`"young"` and `"old"` are not mutually exclusive with age groups** | `"old adults"` produces both `age_group = 'adult'` AND `age BETWEEN 60 AND 120`, which can return an empty result set since the adult age group only covers 19–58.                                                   |
| **"male" is a substring of "female"**                                | This is mitigated by always checking `"female"/"females"` before `"male"/"males"` in the conditional chain, but a query like `"non-male"` would still match `male` because `includes()` doesn't understand negation. |
| **No negation support**                                              | Phrases like `"not male"`, `"excluding seniors"`, or `"not from Nigeria"` are not parsed. The parser has no concept of logical NOT.                                                                                  |
| **No OR logic**                                                      | All extracted filters are AND-combined. A query like `"males or females from US"` cannot express disjunction.                                                                                                        |
| **`"from"` keyword is required for country**                         | Phrases like `"people in Nigeria"` or `"Nigerian people"` do not trigger the country filter — only `"from <country>"` is detected.                                                                                   |
| **Country name matching is broad**                                   | `"from an"` would capture `"an"` as a country name and produce `WHERE country_name LIKE '%an%'`, matching any country whose name contains "an" (e.g. France, Japan, Ghana).                                          |
| **"from" can collide with other text**                               | If the query contains `"from"` in a non-country context (e.g. `"profiles from last week"`), the parser will still attempt to extract a country name from whatever follows `"from"`.                                  |
| **Only the first numeric match is used**                             | `parseAboveValue` and `parseBelowValue` each return the first regex match. A query with two numbers like `"above 20 above 30"` uses `20`, not `30`.                                                                  |
| **"young" age bracket (16–24) excludes under-16s**                   | A 10-year-old child would not match a `"young"` query, even though colloquially "young" often includes children.                                                                                                     |
| **No date/time parsing**                                             | Queries involving time (e.g. `"profiles created this week"`, `"recent entries"`) are silently ignored.                                                                                                               |
| **Pagination not reflected in total**                                | `total` reflects the count of all matching rows, not the number of rows on the current page, which is standard REST pagination behaviour but worth noting.                                                           |

### General API Limitations

| Limitation                                         | Detail                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name deduplication is exact-match only**         | `"Alice"` and `"alice"` are treated as different profiles because the uniqueness check is case-sensitive (`WHERE name = ?`).                                               |
| **No update endpoint**                             | Once a profile is created, its inferred data cannot be refreshed even if the upstream APIs return different predictions over time.                                         |
| **SQLite in-process DB**                           | The database is a single file (`db/database.db`). It is not suitable for multi-process or horizontally scaled deployments without replacement by a proper RDBMS.           |
| **No authentication or rate limiting**             | All endpoints are public. There is no API key, JWT guard, or request rate limiter.                                                                                         |
| **Upstream API rate limits**                       | Genderize, Agify, and Nationalize impose daily request limits on their free tiers. High creation throughput will exhaust these limits.                                     |
| **`sort_by` is limited to three fields**           | Only `created_at`, `age`, and `gender_probability` are accepted as sort fields by the DTO validator.                                                                       |
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
