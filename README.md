# Elham (?????)

Modern bilingual inspirational platform using **Next.js App Router + Tailwind + Supabase (frontend-only)**.

## Stack
- Next.js + TypeScript
- Tailwind CSS
- Supabase JS (Auth + Database + Storage upload)
- Framer Motion
- Zustand
- Formik + Yup
- React Toastify

## Folder structure
```txt
src/
  app/
    [locale]/
      page.tsx
      login/page.tsx
      register/page.tsx
      profile/page.tsx
      create-post/page.tsx
      admin/page.tsx
  components/
    layout/
    sections/
    ui/
  context/
  data/
  hooks/
  lib/
  store/
  types/
  utils/
```

## Environment
Copy `.env.example` to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

> Never expose `SERVICE_ROLE_KEY` in frontend.

## Supabase setup (step-by-step)
1. Create a Supabase project.
2. Open **Project Settings -> API** and copy URL + anon key.
3. Create tables in SQL editor:

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique (user_id, post_id)
);
```

4. Create storage bucket for images:
```sql
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;
```

5. Enable RLS and add policies:

```sql
alter table profiles enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;

-- profiles
create policy "read profiles" on profiles for select using (true);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);
create policy "admin delete profiles" on profiles for delete using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- posts
create policy "read posts" on posts for select using (true);
create policy "insert own posts" on posts for insert with check (auth.uid() = author_id);
create policy "update own or admin posts" on posts for update using (
  auth.uid() = author_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "delete own or admin posts" on posts for delete using (
  auth.uid() = author_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- likes
create policy "read likes" on likes for select using (true);
create policy "insert own likes" on likes for insert with check (auth.uid() = user_id);
create policy "delete own likes" on likes for delete using (auth.uid() = user_id);
```

## Auth flow
- Sign up / login via `supabase.auth` in `auth-form.tsx`.
- Session is synced globally with Zustand in `use-auth-session.ts`.
- `ProtectedRoute` guards profile/create/admin pages.

## Roles system
- Role lives in `profiles.role` (`user` / `admin`).
- User: CRUD own posts + likes.
- Admin: delete any post and delete profiles.

## Run
```bash
npm install
npm run dev
```
Open: `http://localhost:3000`

## Notes
- App is frontend-focused and uses anon key only.
- Deleting **Auth users** directly is not possible from frontend anon key; admin delete here targets `profiles` records. For full auth user deletion use a secure server/edge function.
