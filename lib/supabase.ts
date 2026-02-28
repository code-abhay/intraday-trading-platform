import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;
let _warnedInvalidUrl = false;

function normalizeSupabaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Accept a project ref directly and convert it to the canonical API URL.
  if (/^[a-z0-9]{20}$/i.test(trimmed)) {
    return `https://${trimmed.toLowerCase()}.supabase.co`;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".supabase.co")) {
      return `${parsed.protocol}//${host}`;
    }
    // Common misconfiguration: dashboard URL copied instead of API URL.
    if (host === "supabase.com" || host === "www.supabase.com" || host === "app.supabase.com") {
      const match = parsed.pathname.match(/\/(?:dashboard\/)?project\/([a-z0-9]{20})/i);
      if (match?.[1]) {
        return `https://${match[1].toLowerCase()}.supabase.co`;
      }
    }
  } catch {
    // fall through to warning below
  }

  if (!_warnedInvalidUrl) {
    _warnedInvalidUrl = true;
    console.warn(
      "[supabase] Invalid SUPABASE URL format. Use https://<project-ref>.supabase.co or set project ref."
    );
  }
  return undefined;
}

function getSupabaseUrl(): string | undefined {
  const preferred = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (preferred) return preferred;
  return normalizeSupabaseUrl(process.env.SUPABASE_URL);
}

export function getSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Server-side client for ingestion and storage jobs.
 *
 * Prefers service-role key when available. Falls back to anon key so local
 * development still works (assuming RLS policies allow required writes).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_adminClient) {
    _adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _adminClient;
}

export function isSupabaseAdminConfigured(): boolean {
  return !!(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/*
Supabase SQL to create the paper_trades table:

create table paper_trades (
  id text primary key,
  segment text not null,
  segment_label text not null,
  strike integer not null,
  side text not null,
  expiry text not null default '',
  entry_premium numeric not null,
  entry_underlying numeric not null default 0,
  current_premium numeric not null,
  qty integer not null,
  lot_size integer not null,
  sl_premium numeric not null,
  t1_premium numeric not null,
  t2_premium numeric not null,
  t3_premium numeric not null,
  trail_sl_premium numeric not null,
  active_sl numeric not null,
  invested numeric not null,
  status text not null default 'OPEN',
  t1_reached boolean not null default false,
  t2_reached boolean not null default false,
  pnl numeric not null default 0,
  exit_premium numeric,
  exit_reason text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  user_id text not null default 'default'
);

create index idx_paper_trades_status on paper_trades (status);
create index idx_paper_trades_user on paper_trades (user_id);
*/
