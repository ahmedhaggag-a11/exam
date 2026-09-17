import { Question } from "@/types/database";
import { ExamWizardConfig } from "@/types/exam";

export interface AIExamGeneratorResult {
  selected_question_ids: string[];
  reasoning?: string;
}

export interface AIExamProvider {
  name: string;
  generateExam(
    availableQuestions: Question[],
    config: ExamWizardConfig
  ): Promise<AIExamGeneratorResult>;
}
