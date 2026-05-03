-- ============================================================
-- Elham Platform — Performance Indexes & Optimizations
-- Run this in Supabase SQL Editor → New Query → Run
-- ============================================================

-- ─── INDEXES للـ posts table ──────────────────────────────────
-- Index على created_at لتسريع الـ ORDER BY (الأهم)
create index if not exists idx_posts_created_at 
  on public.posts(created_at desc);

-- Index على author_id لتسريع جلب منشورات مستخدم معين
create index if not exists idx_posts_author_id 
  on public.posts(author_id);

-- ─── INDEXES للـ likes table ─────────────────────────────────
-- Index على post_id لتسريع count الـ likes
create index if not exists idx_likes_post_id 
  on public.likes(post_id);

-- Index على user_id + post_id (compound) لتسريع "liked by me"
create index if not exists idx_likes_user_post 
  on public.likes(user_id, post_id);

-- ─── INDEXES للـ saved_posts table ───────────────────────────
create index if not exists idx_saved_posts_user_id 
  on public.saved_posts(user_id);

create index if not exists idx_saved_posts_user_post 
  on public.saved_posts(user_id, post_id);

-- ─── INDEXES للـ notifications table ─────────────────────────
create index if not exists idx_notifications_user_id 
  on public.notifications(user_id);

create index if not exists idx_notifications_user_read 
  on public.notifications(user_id, is_read);

-- ─── تفعيل is_pro column لو مش موجودة ───────────────────────
alter table public.profiles 
  add column if not exists is_pro boolean not null default false;

-- ─── تفعيل is_authentic و seal_requested لو مش موجودين ──────
alter table public.posts 
  add column if not exists is_authentic boolean not null default false;

alter table public.posts 
  add column if not exists seal_requested boolean not null default false;

-- ─── تحسين connection pooling (Supabase بيعمله تلقائي بس نأكد) ─
-- ملاحظة: Supabase بيستخدم PgBouncer تلقائياً في production

-- Done! ✅
select 'Performance indexes created successfully!' as status;
