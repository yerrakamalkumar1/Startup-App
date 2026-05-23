-- Supabase schema for secure user profile, geolocation, avatars, and push subscriptions.
-- Run this in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null check (role in ('startup', 'freelancer', 'investor', 'client', 'admin')),
  headline text not null default '',
  bio text not null default '',
  avatar_url text,
  city text,
  region text,
  country text default 'India',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  accuracy_meters numeric(10, 2),
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatar_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists locations_set_updated_at on public.profile_locations;
create trigger locations_set_updated_at
before update on public.profile_locations
for each row execute function public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.profile_locations enable row level security;
alter table public.avatar_uploads enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "locations_manage_own" on public.profile_locations;
create policy "locations_manage_own"
on public.profile_locations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "avatars_manage_own" on public.avatar_uploads;
create policy "avatars_manage_own"
on public.avatar_uploads for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_manage_own" on public.push_subscriptions;
create policy "push_manage_own"
on public.push_subscriptions for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Storage policies for bucket: avatars
-- Object paths must start with the authenticated user's UUID.
drop policy if exists "avatar_objects_read_own" on storage.objects;
create policy "avatar_objects_read_own"
on storage.objects for select
using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

drop policy if exists "avatar_objects_insert_own" on storage.objects;
create policy "avatar_objects_insert_own"
on storage.objects for insert
with check (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

drop policy if exists "avatar_objects_update_own" on storage.objects;
create policy "avatar_objects_update_own"
on storage.objects for update
using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1))
with check (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

drop policy if exists "avatar_objects_delete_own" on storage.objects;
create policy "avatar_objects_delete_own"
on storage.objects for delete
using (bucket_id = 'avatars' and auth.uid()::text = split_part(name, '/', 1));

