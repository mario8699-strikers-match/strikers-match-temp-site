-- =============================================
-- Strikers Match — Full Database Schema
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── profiles ──────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  role        text not null check (role in ('fighter','promoter','manager','sponsor','admin')),
  city        text,
  phone       text,
  is_banned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── fighters ──────────────────────────────────
create table if not exists public.fighters (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  weight_class    text,
  discipline      text,
  record_wins     integer not null default 0,
  record_losses   integer not null default 0,
  record_draws    integer not null default 0,
  is_available    boolean not null default true,
  verified        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── events ────────────────────────────────────
create table if not exists public.events (
  id                   uuid primary key default uuid_generate_v4(),
  promoter_id          uuid not null references public.profiles(id) on delete cascade,
  event_name           text not null,
  event_date           date,
  city                 text,
  venue                text,
  weight_class_needed  text,
  purse_amount         numeric(12,2),
  notes                text,
  status               text not null default 'draft'
                         check (status in ('draft','published','cancelled','completed')),
  created_at           timestamptz not null default now()
);

-- ── match_requests ────────────────────────────
create table if not exists public.match_requests (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references public.events(id) on delete cascade,
  fighter_id  uuid not null references public.fighters(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending','accepted','declined','cancelled')),
  message     text,
  created_at  timestamptz not null default now()
);

-- ── updated_at trigger ────────────────────────
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- ── auto-create profile on signup ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, email, role, city, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'promoter'),
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row Level Security ────────────────────────
alter table public.profiles      enable row level security;
alter table public.fighters      enable row level security;
alter table public.events        enable row level security;
alter table public.match_requests enable row level security;

-- profiles: users can read all, edit own
create policy "profiles_select_all" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- fighters: public read, owner write
create policy "fighters_select_all"   on public.fighters for select using (true);
create policy "fighters_insert_own"   on public.fighters for insert with check (
  profile_id = auth.uid()
);
create policy "fighters_update_own"   on public.fighters for update using (
  profile_id = auth.uid()
);

-- events: public read, promoter write own
create policy "events_select_all"     on public.events for select using (true);
create policy "events_insert_promoter" on public.events for insert with check (
  promoter_id = auth.uid()
);
create policy "events_update_own"     on public.events for update using (
  promoter_id = auth.uid()
);
create policy "events_delete_own"     on public.events for delete using (
  promoter_id = auth.uid()
);

-- match_requests: parties involved can read
create policy "requests_select"  on public.match_requests for select using (
  sender_id = auth.uid() or
  fighter_id in (select id from public.fighters where profile_id = auth.uid())
);
create policy "requests_insert"  on public.match_requests for insert with check (
  sender_id = auth.uid()
);
create policy "requests_update"  on public.match_requests for update using (
  sender_id = auth.uid() or
  fighter_id in (select id from public.fighters where profile_id = auth.uid())
);
