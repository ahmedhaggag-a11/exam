-- ============================================================
-- EXAM FORGE WEB PLATFORM: SUPABASE POSTGRESQL SCHEMA & RLS
-- ============================================================

-- 1. PROFILES (Admins & Teachers)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')) DEFAULT 'teacher',
  subjects TEXT[] DEFAULT '{}',
  grades TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SOURCES (PDF Files uploaded to Supabase Storage)
CREATE TABLE IF NOT EXISTS public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade_level TEXT,
  file_size BIGINT,
  question_count INT DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed')) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. QUESTIONS BANK
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'essay', 'true_false')),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'medium',
  subject TEXT NOT NULL,
  chapter TEXT NOT NULL,
  grade_level TEXT,
  branch TEXT,
  lesson TEXT,
  term TEXT,
  marks INT DEFAULT 2,
  model_answer TEXT,
  image_urls TEXT[] DEFAULT '{}',
  source_page INT,
  needs_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. QUESTION CHOICES
CREATE TABLE IF NOT EXISTS public.question_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  choice_code TEXT NOT NULL, -- 'a', 'b', 'c', 'd' or 'أ', 'ب', 'ج', 'د'
  text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INT DEFAULT 0
);

-- 5. EXAMS
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  grade_level TEXT NOT NULL,
  duration_minutes INT DEFAULT 90,
  exam_date DATE DEFAULT CURRENT_DATE,
  instructions TEXT,
  total_questions INT DEFAULT 0,
  total_marks INT DEFAULT 0,
  models_count INT DEFAULT 4,
  template_name TEXT DEFAULT 'classic',
  status TEXT CHECK (status IN ('draft', 'generated', 'ready')) DEFAULT 'generated',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EXAM QUESTIONS LINK
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0
);

-- 7. EXAM MULTI-MODEL DATA (A, B, C, D)
CREATE TABLE IF NOT EXISTS public.exam_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  model_code TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
  model_name TEXT NOT NULL,
  questions_order JSONB NOT NULL DEFAULT '[]',
  choices_order JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_models ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current auth user is Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Admins full access to profiles" ON public.profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Sources Policies
CREATE POLICY "Admins full access to sources" ON public.sources FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own sources" ON public.sources FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers manage own sources" ON public.sources FOR ALL USING (teacher_id = auth.uid());

-- Questions Policies
CREATE POLICY "Admins full access to questions" ON public.questions FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own questions" ON public.questions FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers manage own questions" ON public.questions FOR ALL USING (teacher_id = auth.uid());

-- Question Choices Policies
CREATE POLICY "Admins full access to choices" ON public.question_choices FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own choices" ON public.question_choices FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
);
CREATE POLICY "Teachers manage own choices" ON public.question_choices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.questions q WHERE q.id = question_id AND q.teacher_id = auth.uid())
);

-- Exams Policies
CREATE POLICY "Admins full access to exams" ON public.exams FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own exams" ON public.exams FOR SELECT USING (teacher_id = auth.uid());
CREATE POLICY "Teachers manage own exams" ON public.exams FOR ALL USING (teacher_id = auth.uid());

-- Exam Questions Policies
CREATE POLICY "Admins full access to exam_questions" ON public.exam_questions FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own exam_questions" ON public.exam_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
);
CREATE POLICY "Teachers manage own exam_questions" ON public.exam_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
);

-- Exam Models Policies
CREATE POLICY "Admins full access to exam_models" ON public.exam_models FOR ALL USING (public.is_admin());
CREATE POLICY "Teachers view own exam_models" ON public.exam_models FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
);
CREATE POLICY "Teachers manage own exam_models" ON public.exam_models FOR ALL USING (
  EXISTS (SELECT 1 FROM public.exams e WHERE e.id = exam_id AND e.teacher_id = auth.uid())
);

-- Create storage bucket for PDFs if not existing
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;
