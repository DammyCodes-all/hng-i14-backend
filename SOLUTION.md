# SOLUTION

This repository contains the Stage 4B implementation for Insighta Labs+.

## What was implemented

### 1. Query performance and database efficiency

- Kept the public API unchanged.
- Added Redis-backed query caching for list and search responses.
- Cached profile-by-id lookups separately.
- Canonicalized cache keys so equivalent queries map to the same cache entry.
- Normalized profile values before filtering to avoid unnecessary case handling at query time.
- Added indexes for the fields most often used in filters and search.

### 2. Query normalization and cache efficiency

- Normalized natural-language filters into a deterministic canonical filter object.
- Used lowercase / uppercase normalization for string filters where that is the stored convention.
- Ensured semantically identical queries reuse the same Redis cache key.
- Avoided AI/LLM-based interpretation entirely.

### 3. CSV data ingestion

- Added `POST /api/profiles/import`.
- The endpoint accepts CSV uploads as `multipart/form-data` using Multer disk storage.
- The uploaded file is streamed from disk and processed incrementally.
- Rows are inserted in batches instead of one-by-one.
- Bad rows are skipped and do not fail the whole upload.
- The upload returns a summary with inserted, skipped, and reason counts.
- Duplicate names are ignored using database-level duplicate suppression behavior.

## Design decisions and trade-offs

- I kept the system simple: no queue, no background worker, and no new datastore.
- Disk-backed uploads were chosen so CSV files do not live in memory.
- Streaming plus batching was chosen to keep memory usage stable under large files.
- The importer returns partial progress because the task explicitly requires already-inserted rows to remain on failure.
- Runtime schema repair was kept instead of adding heavy migration machinery because the repo already had live Postgres schema drift issues and the task asked for practical implementation.

## Before / after query performance

The exact numbers depend on environment, dataset size, and network latency. The table below shows the intended direction and a simple way to present the improvement.

| Scenario | Before | After |
| --- | --- | --- |
| Repeated list/search query | Higher latency, repeated DB calls | Redis cache hit in low milliseconds to tens of milliseconds |
| Profile lookup by id | Always hits DB | Cached after first read |
| Natural-language equivalent queries | Different cache keys, duplicate DB work | Canonical key reuse |
| CSV ingestion | Row-by-row or memory-heavy processing | Streaming + batched inserts |

## Failure and edge-case handling

- Missing required fields are skipped.
- Negative or non-numeric ages are skipped.
- Unrecognized genders are skipped.
- Duplicate names are skipped.
- Malformed rows are skipped.
- Parser/stream errors produce a partial result instead of rolling back inserted rows.
- Existing rows remain committed even if ingestion fails midway.

## Validation notes

- Static checks were run on the touched TypeScript files.
- The repo now includes a dedicated `SOLUTION.md` as required for submission.
