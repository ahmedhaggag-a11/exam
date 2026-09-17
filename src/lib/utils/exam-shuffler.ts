import { Question } from "@/types/database";

export interface GeneratedExamModel {
  model_code: string;
  model_name: string;
  questions: Question[];
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

    if (shuffleQuestions && m > 0) {
      modelQuestions = [...modelQuestions].sort((a, b) => {
        const hashA = (a.id + code).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hashB = (b.id + code).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return hashA - hashB;
      });
    }

    if (shuffleChoices && m > 0) {
      modelQuestions = modelQuestions.map((q) => {
        if (!q.choices || q.choices.length < 2) return q;

        const shuffledChoices = [...q.choices].sort((a, b) => {
          const hashA = (a.text + code).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const hashB = (b.text + code).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return hashA - hashB;
        });

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
    });
  }

  return results;
}
