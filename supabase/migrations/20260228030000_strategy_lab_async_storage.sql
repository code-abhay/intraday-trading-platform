create table if not exists strategy_lab_runs (
  run_id text primary key,
  status text not null check (status in ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  params jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_strategy_lab_runs_status_created
  on strategy_lab_runs(status, created_at desc);

create table if not exists strategy_lab_run_segments (
  id bigserial primary key,
  run_id text not null references strategy_lab_runs(run_id) on delete cascade,
  segment text not null,
  strategy_id text not null,
  final_score numeric not null,
  base_score numeric not null,
  consistency_score numeric not null,
  trades integer not null default 0,
  win_rate numeric not null default 0,
  net_r numeric not null default 0,
  consistency jsonb not null default '{}'::jsonb,
  activity jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, segment, strategy_id)
);

create index if not exists idx_strategy_lab_segments_run_score
  on strategy_lab_run_segments(run_id, final_score desc);

create table if not exists strategy_lab_run_windows (
  id bigserial primary key,
  run_id text not null references strategy_lab_runs(run_id) on delete cascade,
  segment text not null,
  strategy_id text not null,
  window_from timestamptz not null,
  window_to timestamptz not null,
  score numeric not null,
  trades integer not null default 0,
  net_r numeric not null default 0,
  win_rate numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (run_id, segment, strategy_id, window_from, window_to)
);

create index if not exists idx_strategy_lab_windows_run_strategy
  on strategy_lab_run_windows(run_id, segment, strategy_id, window_from);
