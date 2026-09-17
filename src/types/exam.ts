import { DifficultyLevel, QuestionType } from "./database";

export interface ExamWizardConfig {
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string;
  school_name?: string;
  teacher_name?: string;
  instructions?: string;
  
  selected_chapters: string[];
  total_questions: number;
  question_types: {
    mcq: number;
    essay: number;
    true_false: number;
  };
  difficulty_distribution: {
    easy: number;
    medium: number;
    hard: number;
  };

  models_count: number;
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  template_name: string;
}
