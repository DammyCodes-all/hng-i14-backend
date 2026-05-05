# Solutions

This file summarizes the practical solutions implemented so far.

## CSV ingestion

- Added `POST /api/profiles/import`.
- Uses Multer disk storage for uploads.
- Reads the CSV as a stream from a temp file.
- Processes rows in batches.
- Skips bad rows and continues the import.
- Ignores duplicate names at the database layer.

## Runtime schema repair

- Added a bootstrap-time schema repair service.
- It scans the `public` schema for `created_at` and `updated_at` columns.
- It backfills null values and sets defaults to `CURRENT_TIMESTAMP`.
- It also applies `NOT NULL` so the issue does not keep repeating.

## Query performance

- Added Redis query caching with canonical keys.
- Cached profile-by-id reads separately.
- Normalized profile values before filtering.
- Added indexes for frequently filtered profile columns.

## Seeding

- Rewrote the seed script for PostgreSQL.
- Batched inserts so seeding is fast.
- Removed the old slow row-by-row behavior.
