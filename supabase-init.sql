-- ============================================================
-- Elham Platform — Full Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  username text unique,
  avatar_url text,
  cover_url text,
  bio text,
  location text,
  website text,
  twitter text,
  instagram text,
  github text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);

-- ─── POSTS ───────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─── LIKES ───────────────────────────────────────────────────
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, post_id)
);

-- ─── ADS ─────────────────────────────────────────────────────
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text not null,
  link text not null,
  placement text not null default 'feed' check (placement in ('feed','sidebar','both')),
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ─── ANNOUNCEMENTS ───────────────────────────────────────────
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ─── RLS ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.ads enable row level security;
alter table public.announcements enable row level security;

-- PROFILES policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='read profiles') then
    create policy "read profiles" on public.profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='insert own profile') then
    create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='update own profile') then
    create policy "update own profile" on public.profiles for update using (auth.uid() = id);
  end if;
  if not exists (select 1 from pg_policies where tablename='profiles' and policyname='admin delete profiles') then
    create policy "admin delete profiles" on public.profiles for delete using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
end $$;

-- POSTS policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='posts' and policyname='read posts') then
    create policy "read posts" on public.posts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='posts' and policyname='insert own posts') then
    create policy "insert own posts" on public.posts for insert with check (auth.uid() = author_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='posts' and policyname='update own or admin posts') then
    create policy "update own or admin posts" on public.posts for update using (
      auth.uid() = author_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
  if not exists (select 1 from pg_policies where tablename='posts' and policyname='delete own or admin posts') then
    create policy "delete own or admin posts" on public.posts for delete using (
      auth.uid() = author_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
end $$;

-- LIKES policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='likes' and policyname='read likes') then
    create policy "read likes" on public.likes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='likes' and policyname='insert own likes') then
    create policy "insert own likes" on public.likes for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='likes' and policyname='delete own likes') then
    create policy "delete own likes" on public.likes for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ADS policies (public read, admin write)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ads' and policyname='read ads') then
    create policy "read ads" on public.ads for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='ads' and policyname='admin manage ads') then
    create policy "admin manage ads" on public.ads for all using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
end $$;

-- ANNOUNCEMENTS policies
do $$ begin
  if not exists (select 1 from pg_policies where tablename='announcements' and policyname='read announcements') then
    create policy "read announcements" on public.announcements for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='announcements' and policyname='admin manage announcements') then
    create policy "admin manage announcements" on public.announcements for all using (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    );
  end if;
end $$;

-- Set admin role for the designated admin email
-- Run this after the admin signs up:
-- update public.profiles set role = 'admin' where email = '12m0stafa7@gmail.com';
