-- Chat Features Update
-- Run this in your Supabase SQL Editor

-- 1. تحديث جدول الرسائل لدعم التعديل والتفاعلات
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reaction TEXT;

-- 2. إنشاء جدول إعدادات المحادثة لدعم الخلفيات وإعادة التسمية
CREATE TABLE IF NOT EXISTS chat_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nickname TEXT,
  background_url TEXT,
  UNIQUE(user_id, target_user_id)
);

-- 3. تفعيل الأمان (RLS) للجدول الجديد
ALTER TABLE chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat settings" ON chat_settings;

CREATE POLICY "Users can manage their own chat settings" ON chat_settings
  FOR ALL USING (auth.uid() = user_id);
