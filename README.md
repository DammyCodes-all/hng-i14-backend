# HNG i14 Backend — Stage 1: Data Persistence & API Design

This repository implements Stage 1 of the Backend Wizards assessment: accept a name, call three external APIs (Genderize, Agify, Nationalize), classify the results, persist a profile, and expose REST endpoints to manage the profiles.

This README summarizes:
- What the current implementation provides
- Which Stage 1 requirements are implemented vs. partially implemented or missing
- How to run and test locally
- A prioritized TODO checklist to reach grading compliance

If you want me to make the code changes listed in the TODOs, tell me which ones to apply first and I will prepare the edits.

---

## Quick status (high-level)
- Server framework: NestJS (TypeScript)
- CORS: Enabled (`Access-Control-Allow-Origin: *`)
- External APIs integrated: Genderize, Agify, Nationalize — the service calls all three.
- Data store: in-memory `ProfileStoreService` (array) — NOT persisted to disk or DB.
- Endpoints implemented: Create, Get single, Get all (with filters), Delete.
- UUID generation: uses `crypto.randomUUID()` (Node runtime default).
- Timestamps: `new Date().toISOString()` in UTC.

Important: The repository already contains endpoint implementations, but there are a few functional and compatibility issues that must be fixed for the Stage 1 grading to pass automatically (see Known Issues & TODOs).

---

## How to run (local)
1. Install dependencies
```
/dev/null/example.md#L1-1
pnpm install
```

2. Start development server
```
/dev/null/example.md#L1-1
pnpm run start:dev
```

3. Default local base URL
```
/dev/null/example.md#L1-1
http://localhost:3000
```

(If your project uses `npm`/`yarn` replace `pnpm` commands accordingly.)

---

## Implemented Endpoints (what's available now)

1) Create Profile
- POST /api/profiles
- Body:
```/dev/null/example.json#L1-3
{ "name": "ella" }
```
- Current behavior:
  - Checks request type and empty name at controller level.
  - If a profile with the same name already exists in the in-memory store, returns a success response with the existing profile and a `message: "Profile already exists"`.
  - Otherwise it calls the three external APIs in parallel, derives classification values, produces a `Profile` object and saves it to the in-memory store.
- Returns: an object with `{ status: 'success', data: <profile>, ... }` (see Implementation notes for deviations from spec).

2) Get Single Profile
- GET /api/profiles/{id}
- Current behavior:
  - Returns `{ status: 'success', data: <profile> }` if found.
  - Throws an error (controller converts to 404) if not found.

3) Get All Profiles
- GET /api/profiles
- Optional query params: `gender`, `country_id`, `age_group`
- Filtering: controller normalizes incoming filter values (gender and age_group to lowercase, country_id to uppercase) and filters the in-memory store.

4) Delete Profile
- DELETE /api/profiles/{id}
- Returns 204 No Content when deletion succeeds.

---

## Expected API responses (Stage 1 required format)
The grading script expects exact response structures. Example expected responses:

- Successful create (201 Created)
```/dev/null/example.json#L1-20
{
  "status": "success",
  "data": {
    "id": "<uuid-v7>",
    "name": "ella",
    "gender": "female",
    "gender_probability": 0.99,
    "sample_size": 1234,
    "age": 46,
    "age_group": "adult",
    "country_id": "DRC",
    "country_probability": 0.85,
    "created_at": "2026-04-01T12:00:00Z"
  }
}
```

- Duplicate (same name)
```/dev/null/example.json#L1-20
{
  "status": "success",
  "message": "Profile already exists",
  "data": { ...existing profile... }
}
```

- Error format
```/dev/null/example.json#L1-4
{ "status": "error", "message": "<error message>" }
```

- 502 for invalid external API responses
```/dev/null/example.json#L1-4
{
  "status": "error",
  "message": "${externalApi} returned an invalid response"
}
```


---

## Example expected sequence (happy path)
1. POST /api/profiles { "name": "ella" } → service concurrently calls:
   - https://api.genderize.io?name=ella
   - https://api.agify.io?name=ella
   - https://api.nationalize.io?name=ella
2. Validate responses per edge-case rules
3. Build profile object (uuid v7, created_at in utc iso)
4. Save to persistent store
5. Return 201 with the profile JSON (exact fields order not required, but keys must be present)

---
