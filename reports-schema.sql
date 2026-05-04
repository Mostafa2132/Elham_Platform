-- إنشاء جدول البلاغات والمشاكل
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('bug', 'user', 'post', 'other')),
  target_id UUID, -- Optional: ID of the reported user or post
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل الأمان RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- المستخدم العادي يقدر يضيف بلاغ جديد
CREATE POLICY "Users can insert their own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- المستخدم العادي يقدر يشوف بلاغاته بس
CREATE POLICY "Users can view their own reports" ON reports FOR SELECT USING (auth.uid() = user_id);

-- الأدمن يقدر يشوف كل البلاغات
CREATE POLICY "Admin can view all reports" ON reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- الأدمن يقدر يعدل حالة البلاغات (يخليها resolved)
CREATE POLICY "Admin can update reports" ON reports FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
