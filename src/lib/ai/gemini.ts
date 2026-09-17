import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question } from "@/types/database";
import { ExamWizardConfig } from "@/types/exam";
import { AIExamProvider, AIExamGeneratorResult } from "./provider";

export class GeminiAIExamProvider implements AIExamProvider {
  name = "Google Gemini AI Engine";

  private getClient(): GoogleGenerativeAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  async generateExam(
    availableQuestions: Question[],
    config: ExamWizardConfig
  ): Promise<AIExamGeneratorResult> {
    const client = this.getClient();

    if (!client) {
      console.warn("GEMINI_API_KEY is missing. Using smart fallback question selector.");
      return this.fallbackSelection(availableQuestions, config);
    }

    try {
      const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });

      const questionBankSummary = availableQuestions.map((q) => ({
        id: q.id,
        chapter: q.chapter,
        type: q.question_type,
        difficulty: q.difficulty,
        text_snippet: q.text.slice(0, 100),
      }));

      const prompt = `
You are an expert exam composition engine.
Your task: Select exactly ${config.total_questions} question IDs from the provided Question Bank list.

STRICT CONSTRAINTS:
1. You MUST ONLY select IDs from the provided Question Bank array. DO NOT invent or create new questions.
2. Subject: ${config.subject}
3. Target Chapters: ${JSON.stringify(config.selected_chapters)}
4. Desired Question Types Split:
   - MCQ count: ${config.question_types.mcq}
   - Essay count: ${config.question_types.essay}
   - True/False count: ${config.question_types.true_false}
5. Total questions required: ${config.total_questions}

QUESTION BANK ITEMS:
${JSON.stringify(questionBankSummary, null, 2)}

OUTPUT REQUIREMENTS:
Return strictly a valid JSON object matching this schema:
{
  "selected_question_ids": ["uuid1", "uuid2", ...],
  "reasoning": "Short summary of why these questions were selected"
}
`;

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      const cleanedText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();

      const jsonRes = JSON.parse(cleanedText);
      if (Array.isArray(jsonRes.selected_question_ids) && jsonRes.selected_question_ids.length > 0) {
        return {
          selected_question_ids: jsonRes.selected_question_ids,
          reasoning: jsonRes.reasoning || "Exam assembled using Gemini AI model.",
        };
      }
    } catch (err) {
      console.error("Gemini API generation error:", err);
    }

    return this.fallbackSelection(availableQuestions, config);
  }

  private fallbackSelection(
    questions: Question[],
    config: ExamWizardConfig
  ): AIExamGeneratorResult {
    let filtered = questions.filter(
      (q) =>
        config.selected_chapters.length === 0 ||
        config.selected_chapters.includes(q.chapter)
    );

    if (filtered.length === 0) {
      filtered = [...questions];
    }

    const shuffled = [...filtered].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(config.total_questions, shuffled.length));

    return {
      selected_question_ids: selected.map((q) => q.id),
      reasoning: "Selected via smart algorithmic distribution.",
    };
  }
}
