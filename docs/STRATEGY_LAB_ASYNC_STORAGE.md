# Strategy Lab Async Storage

## Automated (Recommended)

The schema is now versioned as a migration:

- `supabase/migrations/20260228030000_strategy_lab_async_storage.sql`

And applied automatically via CI workflow:

- `.github/workflows/supabase-migrations.yml`

### Required GitHub Secrets

Set these repository secrets once:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`

After that:

- Any push to `main` touching `supabase/migrations/**` auto-runs migrations.
- You can also trigger it manually from GitHub Actions (`workflow_dispatch`).

## Local Commands

For local/controlled rollout:

- `npm run db:dry-run`
- `npm run db:push`

## Manual Fallback (Only if CI unavailable)

If needed, run the SQL from:

- `supabase/migrations/20260228030000_strategy_lab_async_storage.sql`

in the Supabase SQL editor.

## What these tables store

- `strategy_lab_runs`: run params + full cached API response + status.
- `strategy_lab_run_segments`: per segment/strategy summary diagnostics.
- `strategy_lab_run_windows`: rolling weekly windows for consistency scoring.
