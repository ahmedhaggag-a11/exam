import { Question } from "@/types/database";

export interface GeneratedExamModel {
  model_code: string;
  model_name: string;
  questions: Question[];
  choices_order?: Record<string, string[]>; // questionId -> array of choice IDs in shuffled order
}

/**
 * Deterministic pseudo-random number generator based on seed string
 */
function createSeededRandom(seedStr: string) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/**
 * Fisher-Yates array shuffle using a deterministic seed
 */
function shuffleArray<T>(items: T[], seedStr: string): T[] {
  const rng = createSeededRandom(seedStr);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateExamModels(
  questions: Question[],
  modelsCount: number = 4,
  shuffleQuestions: boolean = true,
  shuffleChoices: boolean = true
): GeneratedExamModel[] {
  const modelCodes = ["A", "B", "C", "D"];
  const modelNamesAr = ["نموذج أ", "نموذج ب", "نموذج ج", "نموذج د"];
  const choiceCodesAr = ["أ", "ب", "ج", "د", "هـ", "و"];

  const results: GeneratedExamModel[] = [];

  for (let m = 0; m < modelsCount; m++) {
    const code = modelCodes[m] || `M${m + 1}`;
    const nameAr = modelNamesAr[m] || `نموذج ${m + 1}`;

    let modelQuestions = [...questions];
    const choicesOrderMap: Record<string, string[]> = {};

    // For Model A (m === 0), keep the original order
    // For Model B, C, D (m > 0), perform distinct shuffle
    if (shuffleQuestions && m > 0) {
      modelQuestions = shuffleArray(modelQuestions, `exam_model_shuffle_q_${code}_${m * 739}`);
    }

    if (shuffleChoices && m > 0) {
      modelQuestions = modelQuestions.map((q, qIndex) => {
        if (!q.choices || q.choices.length < 2) return q;

        // Shuffle choices distinctly per question and per model
        const shuffledChoices = shuffleArray(
          q.choices,
          `exam_model_shuffle_c_${code}_${q.id}_${qIndex * 137}`
        );

        // Record the shuffled choice IDs for database persistence
        choicesOrderMap[q.id] = shuffledChoices.map((c) => c.id || c.choice_code);

        const reCodedChoices = shuffledChoices.map((c, idx) => ({
          ...c,
          choice_code: choiceCodesAr[idx] || String.fromCharCode(65 + idx),
          order_index: idx,
        }));

        return {
          ...q,
          choices: reCodedChoices,
        };
      });
    }

    results.push({
      model_code: code,
      model_name: nameAr,
      questions: modelQuestions,
      choices_order: choicesOrderMap,
    });
  }

  return results;
}
