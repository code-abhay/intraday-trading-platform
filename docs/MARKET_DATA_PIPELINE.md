# Market Data Ingestion Pipeline

This app now includes a read-only Angel One ingestion pipeline for:

- periodic data ingestion (`/api/market-data/ingest`)
- daily universe refresh (`/api/market-data/ingest/daily`)
- normalized latest snapshot retrieval (`/api/market-data/latest`)

No order placement APIs are used in this pipeline.

---

## 1) Environment Variables

Add these to `.env.local`:

```bash
# Angel One
ANGEL_API_KEY=...
ANGEL_CLIENT_ID=...
ANGEL_PIN=...
ANGEL_JWT_TOKEN=... # optional fallback for server-side cron ingestion

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Ingestion security
INGEST_CRON_SECRET=... # shared secret for API auth
CRON_SECRET=... # optional, for Vercel-native cron bearer auth
```

If `INGEST_CRON_SECRET` is set, ingestion endpoints require either:

- header: `x-ingest-secret: <value>`, or
- header: `Authorization: Bearer <value>` (Vercel cron compatible), or
- an active `angel_jwt` login cookie.

For GitHub Actions, add a repository secret with the same value:

- Secret name: `INGEST_CRON_SECRET`
- Secret value: the exact value used in Vercel/app env

Optional but recommended for non-cookie scheduler runs:

- Secret name: `ANGEL_JWT_TOKEN`
- Secret value: current Angel One JWT (rotate when session expires)

---

## 2) Supabase Schema (Normalized)

Run this SQL in Supabase:

```sql
create table if not exists market_snapshots (
  id bigint generated always as identity primary key,
  segment text not null,
  source text not null default 'angel_one',
  snapshot_at timestamptz not null,
  ltp numeric not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  trade_volume numeric,
  buy_qty numeric,
  sell_qty numeric,
  pcr numeric,
  pcr_symbol text,
  max_pain numeric,
  signal_bias text,
  signal_confidence numeric,
  signal_summary text,
  raw_payload jsonb not null default '{}'::jsonb,
  unique (segment, snapshot_at)
);

create index if not exists idx_market_snapshots_segment_time
  on market_snapshots (segment, snapshot_at desc);

create table if not exists market_oi_buildup (
  id bigint generated always as identity primary key,
  snapshot_at timestamptz not null,
  segment text not null,
  bucket text not null, -- LONG | SHORT
  trading_symbol text not null,
  oi_change numeric,
  price_change numeric,
  unique (snapshot_at, segment, bucket, trading_symbol)
);

create index if not exists idx_market_oi_buildup_segment_time
  on market_oi_buildup (segment, snapshot_at desc);

create table if not exists market_option_greeks (
  id bigint generated always as identity primary key,
  snapshot_at timestamptz not null,
  segment text not null,
  expiry text not null,
  strike numeric not null,
  option_type text not null, -- CE | PE
  delta numeric,
  gamma numeric,
  theta numeric,
  vega numeric,
  iv numeric,
  trade_volume numeric,
  unique (snapshot_at, segment, expiry, strike, option_type)
);

create index if not exists idx_market_option_greeks_segment_time
  on market_option_greeks (segment, snapshot_at desc);

create table if not exists market_candles (
  id bigint generated always as identity primary key,
  segment text not null,
  interval text not null,
  source text not null default 'angel_one',
  candle_time timestamptz not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume numeric,
  unique (segment, interval, candle_time)
);

create index if not exists idx_market_candles_segment_interval_time
  on market_candles (segment, interval, candle_time desc);

create table if not exists market_universe_flags (
  id bigint generated always as identity primary key,
  snapshot_date date not null,
  exchange text not null,
  symbol text not null,
  token text not null default '',
  is_intraday_allowed boolean not null default false,
  intraday_multiplier numeric,
  is_cautionary boolean not null default false,
  caution_message text,
  unique (snapshot_date, exchange, symbol, token)
);

create table if not exists market_ingestion_runs (
  id bigint generated always as identity primary key,
  run_id text not null unique,
  mode text not null, -- intraday | daily
  status text not null, -- SUCCESS | PARTIAL | FAILED
  started_at timestamptz not null,
  completed_at timestamptz not null,
  details jsonb not null default '{}'::jsonb
);
```

---

## 3) Ingestion Endpoints

### Intraday ingestion

`GET /api/market-data/ingest`

Optional query params:

- `mode=intraday|daily` (default: `intraday`)
- `segment=NIFTY|BANKNIFTY|SENSEX|MIDCPNIFTY`
- `secret=<INGEST_CRON_SECRET>`

### Daily universe ingestion

`GET /api/market-data/ingest/daily`

Optional:

- `segment=...`
- `secret=...`

### Latest normalized data contract

`GET /api/market-data/latest`

- no `segment`: returns latest snapshot per segment
- `?segment=NIFTY`: returns latest snapshot + OI buildup + greeks + last 1m candles

---

## 4) Scheduled Jobs (Free-tier setup)

### Vercel cron (Hobby compatible)

`vercel.json` keeps daily universe ingestion:

- `/api/market-data/ingest/daily` once before market open (UTC schedule)

### GitHub Actions cron (intraday cadence)

`.github/workflows/market-data-ingest.yml` runs intraday ingestion every 10 minutes
during market hours and calls:

- `GET /api/market-data/ingest?mode=intraday` (all segments)
- Auth header: `Authorization: Bearer $INGEST_CRON_SECRET`
- Optional auth header: `x-angel-jwt: $ANGEL_JWT_TOKEN`

The workflow fails if `authEnabled` is `false`, so you are alerted when secure
market ingestion is not active.

Current UTC schedule mapping:

- `50 3 * * 1-5` -> 09:20 IST
- `*/10 4-9 * * 1-5` -> 09:30 IST to 15:00 IST every 10 min
- `0 10 * * 1-5` -> 15:30 IST

### Manual trigger and verification

From GitHub UI:

1. Actions -> **Market Data Ingest**
2. Click **Run workflow**
3. Open run logs and confirm response `status` is `SUCCESS` or `PARTIAL`

Using GitHub CLI:

```bash
gh workflow run market-data-ingest.yml
gh run list --workflow market-data-ingest.yml --limit 1
gh run watch
```

API checks after a run:

```bash
curl -sS "https://intraday-trading-platform.vercel.app/api/market-data/ingest?mode=intraday&secret=<INGEST_CRON_SECRET>"
```

For `/api/market-data/latest`, open in browser while logged into the site password
session (`site_auth` cookie), because `proxy.ts` keeps this endpoint protected.

---

## 5) Notes

- This pipeline is read-only and uses market-data endpoints only.
- If JWT is missing/expired, secure endpoints are skipped and the run is marked `PARTIAL`.
- Best practice: log in at `/login` daily (before market open) so ingestion can use fresh session data.
- For headless schedulers (GitHub Actions), set `ANGEL_JWT_TOKEN` as a GitHub secret
  (or Vercel env) and rotate it whenever Angel One session expires.
