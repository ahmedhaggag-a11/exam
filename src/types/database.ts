export type UserRole = 'admin' | 'teacher';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  subjects: string[];
  grades: string[];
  created_at: string;
  updated_at: string;
}

export interface SourceFile {
  id: string;
  teacher_id: string;
  name: string;
  original_filename: string;
  storage_path: string;
  file_url: string;
  subject: string;
  grade_level?: string;
  file_size?: number;
  question_count: number;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
}

export type QuestionType = 'mcq' | 'essay' | 'true_false';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface QuestionChoice {
  id?: string;
  question_id?: string;
  choice_code: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

export interface Question {
  id: string;
  teacher_id: string;
  source_id?: string | null;
  text: string;
  question_type: QuestionType;
  difficulty: DifficultyLevel;
  subject: string;
  chapter: string;
  grade_level?: string | null;
  branch?: string | null;
  lesson?: string | null;
  term?: string | null;
  marks: number;
  model_answer?: string | null;
  image_urls?: string[];
  source_page?: number | null;
  needs_review?: boolean;
  created_at?: string;
  choices?: QuestionChoice[];
}

export interface Exam {
  id: string;
  teacher_id: string;
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string;
  instructions?: string | null;
  total_questions: number;
  total_marks: number;
  models_count: number;
  template_name: string;
  status: 'draft' | 'generated' | 'ready';
  created_at: string;
  questions?: Question[];
  models?: ExamModel[];
}

export interface ExamModel {
  id: string;
  exam_id: string;
  model_code: string;
  model_name: string;
  questions_order: string[];
  choices_order: Record<string, string[]>;
}
