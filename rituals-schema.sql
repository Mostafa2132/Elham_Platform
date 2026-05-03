-- إنشاء جدول الطقوس (Daily Inspiration)
CREATE TABLE IF NOT EXISTS rituals (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل الأمان (RLS)
ALTER TABLE rituals ENABLE ROW LEVEL SECURITY;

-- السماح للجميع برؤية الطقوس النشطة
CREATE POLICY "Public can view active rituals" ON rituals FOR SELECT USING (active = true);

-- السماح للأدمن فقط بتعديل الطقوس
CREATE POLICY "Admins can manage rituals" ON rituals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);
