-- =============================================
-- Strikers Match — Gallery Migration
-- =============================================

-- ── gallery_photos ─────────────────────────────
create table if not exists public.gallery_photos (
  id           uuid primary key default uuid_generate_v4(),
  admin_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption      text,
  event_name   text,
  created_at   timestamptz not null default now()
);

alter table public.gallery_photos enable row level security;

-- Anyone can view gallery photos
create policy "gallery_select_all" on public.gallery_photos
  for select using (true);

-- Only admins can insert
create policy "gallery_insert_admin" on public.gallery_photos
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Only admins can delete
create policy "gallery_delete_admin" on public.gallery_photos
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ── Storage bucket ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do nothing;

-- Anyone can read from gallery bucket
create policy "gallery_storage_select" on storage.objects
  for select using (bucket_id = 'gallery');

-- Only admins can upload
create policy "gallery_storage_insert_admin" on storage.objects
  for insert with check (
    bucket_id = 'gallery' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Only admins can delete from storage
create policy "gallery_storage_delete_admin" on storage.objects
  for delete using (
    bucket_id = 'gallery' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
