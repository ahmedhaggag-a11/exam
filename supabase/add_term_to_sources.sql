-- Add term column to sources table if not exists
ALTER TABLE public.sources ADD COLUMN IF NOT EXISTS term TEXT DEFAULT 'الترم الأول';

-- Also ensure chapter in questions allows null (it's NOT NULL in schema, so make it nullable)
ALTER TABLE public.questions ALTER COLUMN chapter DROP NOT NULL;
ALTER TABLE public.questions ALTER COLUMN chapter SET DEFAULT 'عام';
