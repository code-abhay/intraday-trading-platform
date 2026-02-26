import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
