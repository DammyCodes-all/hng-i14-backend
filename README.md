# HNG i14 Backend — Stage 0: API Integration & Data Processing

A NestJS backend service that exposes a single endpoint to classify names by integrating with the [Genderize API](https://genderize.io/), then returning a normalized, processed response.

## Base URL

When running locally:

- `http://localhost:3000`

## Endpoint

### `GET /api/classify?name={name}`

Calls the Genderize API with the provided `name`, processes the response, and returns a structured payload.

---

## Success Response (`200 OK`)

```hng-i14-backend/README.md#L1-12
{
  "status": "success",
  "data": {
    "name": "john",
    "gender": "male",
    "probability": 0.99,
    "sample_size": 1234,
    "is_confident": true,
    "processed_at": "2026-04-01T12:00:00.000Z"
  }
}
```

### Processing Rules Implemented

- Extract `gender`, `probability`, and `count` from Genderize
- Rename `count` to `sample_size`
- Compute `is_confident`:
  - `true` only when:
    - `probability >= 0.7`
    - `sample_size >= 100`
  - otherwise `false`
- Generate `processed_at` per request using UTC ISO-8601 (`new Date().toISOString()`)

---

## Error Responses

All errors follow this structure:

```hng-i14-backend/README.md#L1-4
{
  "status": "error",
  "message": "<error message>"
}
```

### Expected Status Codes

- `400 Bad Request` — Missing or empty `name` query parameter
- `422 Unprocessable Entity` — `name` is not a string
- `500 Internal Server Error` / `502 Bad Gateway` — Upstream or server failure

### Genderize Edge Case

If Genderize returns:

- `gender: null` **or**
- `count: 0`

return:

```hng-i14-backend/README.md#L1-4
{
  "status": "error",
  "message": "No prediction available for the provided name"
}
```

---

## CORS Requirement

This service is configured to allow all origins:

- `Access-Control-Allow-Origin: *`

This is required so external graders/scripts can reach the endpoint.

---

## Tech Stack

- [NestJS](https://nestjs.com/)
- TypeScript
- Native Fetch API (Node runtime)

---

## Project Structure (High-level)

```hng-i14-backend/README.md#L1-12
src/
  app.module.ts
  main.ts
  types.ts
  classify/
    classify.module.ts
    classify.controller.ts
    classify.service.ts
```

> Note: your exact filenames may vary slightly depending on your local refactor.

---

## Getting Started

### 1) Install dependencies

```hng-i14-backend/README.md#L1-1
pnpm install
```

### 2) Run in development

```hng-i14-backend/README.md#L1-1
pnpm run start:dev
```

### 3) Build

```hng-i14-backend/README.md#L1-1
pnpm run build
```

### 4) Run production build

```hng-i14-backend/README.md#L1-1
pnpm run start:prod
```

---

## Quick Test

```hng-i14-backend/README.md#L1-1
curl "http://localhost:3000/api/classify?name=john"
```

Expected: `status: "success"` response with normalized data fields.

---

## Performance Note

The endpoint processing overhead is lightweight; response-time target is under `500ms` excluding external API latency.

---

## Deployment

Deploy on any supported host (e.g. Railway, Vercel, Heroku, AWS, PXXL App).  
Render is not accepted for this assessment.

Make sure your deployed URL exposes:

- `GET /api/classify?name={name}`

---

## Submission Checklist

- [x] Single GET endpoint implemented
- [x] Genderize API integration
- [x] Data extraction and normalization
- [x] `is_confident` logic
- [x] Dynamic `processed_at`
- [x] Standardized error format
- [x] Edge-case handling for unavailable prediction
- [x] CORS `*`
- [x] README included

---

## License

This project is provided for HNG Stage 0 assessment purposes.