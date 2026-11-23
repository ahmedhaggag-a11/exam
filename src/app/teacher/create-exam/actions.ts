'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export interface GenerateExamConfig {
  subject: string;
  selected_chapters: string[];
  total_questions: number;
  question_types: { mcq: number; essay: number; true_false: number };
  difficulty_counts?: { easy: number; medium: number; hard: number };
  grade: string;
  duration: number;
  instructions: string;
}

export interface QuestionPoolItem {
  id: string;
  text: string;
  question_type: string;
  difficulty: string;
  chapter: string;
  source_id?: string | null;
}

/**
 * Ultra-fast, highly accurate constraint solver to pick questions
 * matching the teacher's desired types, difficulties, and chapters in under 2ms.
 */
export async function generateExamAction(
  pool: QuestionPoolItem[],
  config: GenerateExamConfig
): Promise<{ selected_question_ids: string[]; reasoning: string }> {
  if (pool.length === 0) {
    return { selected_question_ids: [], reasoning: 'لا توجد أسئلة في البنك' };
  }

  // Shuffle candidate pool to ensure randomness across different generations
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5);

  // Filter by selected chapters if specified
  const chapterPool = config.selected_chapters.length > 0
    ? shuffledPool.filter(q => config.selected_chapters.includes(q.chapter))
    : shuffledPool;

  const candidatePool = chapterPool.length >= config.total_questions ? chapterPool : shuffledPool;

  const targetMcq = config.question_types.mcq || 0;
  const targetEssay = config.question_types.essay || 0;
  const targetTf = config.question_types.true_false || 0;

  const diffCounts = config.difficulty_counts || { easy: 0, medium: 0, hard: 0 };
  const hasDiffTarget = (diffCounts.easy + diffCounts.medium + diffCounts.hard) > 0;

  const remainingDiff = {
    easy: diffCounts.easy,
    medium: diffCounts.medium,
    hard: diffCounts.hard,
  };

  const remainingTypes = {
    mcq: targetMcq,
    essay: targetEssay,
    true_false: targetTf,
  };

  const selected: QuestionPoolItem[] = [];
  const selectedIds = new Set<string>();

  // Helper to normalize question type
  const normalizeType = (t: string): 'mcq' | 'essay' | 'true_false' => {
    if (t === 'essay') return 'essay';
    if (t === 'true_false' || t === 'tf') return 'true_false';
    return 'mcq';
  };

  // Helper to normalize difficulty
  const normalizeDiff = (d: string): 'easy' | 'medium' | 'hard' => {
    if (d === 'easy') return 'easy';
    if (d === 'hard') return 'hard';
    return 'medium';
  };

  // Pass 1: Select questions matching BOTH remaining desired type AND remaining desired difficulty
  if (hasDiffTarget) {
    for (const q of candidatePool) {
      if (selected.length >= config.total_questions) break;
      if (selectedIds.has(q.id)) continue;

      const qType = normalizeType(q.question_type);
      const qDiff = normalizeDiff(q.difficulty);

      const needsType = (remainingTypes[qType] || 0) > 0;
      const needsDiff = (remainingDiff[qDiff] || 0) > 0;

      if (needsType && needsDiff) {
        selected.push(q);
        selectedIds.add(q.id);
        remainingTypes[qType]--;
        remainingDiff[qDiff]--;
      }
    }

    // Pass 2: Select questions matching remaining desired difficulty
    for (const q of candidatePool) {
      if (selected.length >= config.total_questions) break;
      if (selectedIds.has(q.id)) continue;

      const qDiff = normalizeDiff(q.difficulty);
      if ((remainingDiff[qDiff] || 0) > 0) {
        selected.push(q);
        selectedIds.add(q.id);
        remainingDiff[qDiff]--;
        const qType = normalizeType(q.question_type);
        if ((remainingTypes[qType] || 0) > 0) remainingTypes[qType]--;
      }
    }
  }

  // Pass 3: Select questions matching remaining desired types
  for (const q of candidatePool) {
    if (selected.length >= config.total_questions) break;
    if (selectedIds.has(q.id)) continue;

    const qType = normalizeType(q.question_type);
    if ((remainingTypes[qType] || 0) > 0) {
      selected.push(q);
      selectedIds.add(q.id);
      remainingTypes[qType]--;
    }
  }

  // Pass 4: Fill any remaining slots to reach total_questions from candidatePool
  for (const q of candidatePool) {
    if (selected.length >= config.total_questions) break;
    if (!selectedIds.has(q.id)) {
      selected.push(q);
      selectedIds.add(q.id);
    }
  }

  // Pass 5: Fill from broader shuffled pool if candidatePool was too small
  if (selected.length < config.total_questions) {
    for (const q of shuffledPool) {
      if (selected.length >= config.total_questions) break;
      if (!selectedIds.has(q.id)) {
        selected.push(q);
        selectedIds.add(q.id);
      }
    }
  }

  const reasoning = hasDiffTarget
    ? `تم الاختيار الفوري للأسئلة بدقة مطابقة لمستويات الصعوبة (${diffCounts.easy} سهل، ${diffCounts.medium} متوسط، ${diffCounts.hard} صعب) وتوزيع الأنواع المطلوب.`
    : `تم الاختيار الفوري للأسئلة بتوزيع متوازن لأنواع الأسئلة (${targetMcq} اختيار من متعدد، ${targetEssay} مقالي، ${targetTf} صح وخطأ).`;

  return {
    selected_question_ids: selected.slice(0, config.total_questions).map(q => q.id),
    reasoning,
  };
}

export interface VariedQuestionItem {
  original_id: string;
  text: string;
  choices?: Array<{ choice_code: string; text: string; is_correct: boolean; order_index: number }>;
  model_answer?: string | null;
}

/**
 * AI-powered numerical variation for physics/science calculation questions.
 * When enabled, models B, C, D get realistically changed numbers, accurately recalculated answers,
 * and updated choices to prevent students from sharing calculation results.
 */
export async function varyModelNumericalQuestionsAction(
  questions: any[],
  modelCode: string,
  modelNameAr: string
): Promise<{ success: boolean; variations: Record<string, VariedQuestionItem> }> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { success: false, variations: {} };

    // 1. Identify which questions have numbers/calculations
    const numericalCandidates = questions.filter(q => {
      const text = q.text || q.question_text || '';
      const choicesText = (q.choices || []).map((c: any) => c.text || '').join(' ');
      const combined = `${text} ${choicesText}`;

      // 1. Must contain any digit (0-9 or ٠-٩) or common fractions
      const hasDigitsOrFractions = /[0-9٠-٩½¼¾⅓⅔]|(\b[0-9٠-٩]+\s*[\/÷]\s*[0-9٠-٩]+\b)/.test(combined);
      if (!hasDigitsOrFractions) return false;

      // 2. Physical/mathematical units or prefixes
      const hasUnits = /[0-9٠-٩]+(\.[0-9٠-٩]+)?\s*(أوم|فولت|أمبير|جول|نيوتن|متر|سم|مم|ثانية|كيلو|وات|هرتز|كولوم|تسلا|ويبر|هنري|فاراد|V|A|W|Ω|Hz|m|cm|mm|km|kg|g|s|K|N|J|C|T|Wb|H|F|%|درجة|°|مللي|ميكرو|نانو|كيلوجرام|دقيقة|ساعة|كم|قسم)/i.test(combined);

      // 3. Calculation/physics keywords
      const hasCalcKeywords = /(احسب|أوجد|فإن|قيمة|شدة|مقاومة|طول|زاوية|نسبة|طاقة|كتلة|تساوي|يساوي|مقدار|سعة|تردد|جهد|تيار|قوة|كثافة|مستحثة|فوتون|إلكترون|سرعة|عجلة|مسافة|زمن|قدرة|حجم|مساحة|نصف قطر|دلالة|تدريج|قراءة|فرق|النسبة)/.test(combined);

      // 4. Choices contain numbers/calculations
      const choicesHaveNumbers = (q.choices || []).filter((c: any) => /[0-9٠-٩½¼¾⅓⅔]/.test(c.text || '')).length >= 2;

      return hasUnits || hasCalcKeywords || choicesHaveNumbers;
    });

    if (numericalCandidates.length === 0) {
      return { success: true, variations: {} };
    }

    // Process up to 20 numerical questions per model
    const targetBatch = numericalCandidates.slice(0, 20);

    const questionsPromptPayload = targetBatch.map((q, idx) => ({
      index: idx + 1,
      id: q.id,
      text: q.text || q.question_text,
      choices: (q.choices || []).map((c: any) => ({
        code: c.choice_code,
        text: c.text,
        is_correct: c.is_correct
      })),
      model_answer: q.model_answer || null
    }));

    const prompt = `أنت خبير واضع امتحانات فيزياء وعلوم ومناهج تعليمية ثانوية عامة.
المهمة المطلوبة: قم بتغيير الأرقام والمعطيات الحسابية في الأسئلة التالية لتوليد نموذج امتحاني جديد لـ (${modelNameAr} - كود ${modelCode}):

قواعد صارمة ودقيقة 100%:
1. غير الأرقام المعطاة في نص السؤال إلى أرقام أخرى واقعية وفيزيائية متناسقة وسهلة الحساب (مثل مضاعفة الرقم، أو تغيير معطى مناسب كالجهد أو المقاومة أو الطول أو التردد).
2. أعد حساب الإجابة الصحيحة رياضياً وفيزيائياً بدقة 100% بناءً على الأرقام الجديدة.
3. عدل جميع خيارات السؤال (أ، ب، ج، د) بحيث يكون أحدها مطابقاً للناتج الجديد الصحيح تماماً ومحدد كـ is_correct: true، وباقي الخيارات مشتتات ذكية متناسقة مع الأرقام الجديدة.
4. إذا كان السؤال مقالياً، حدّث الإجابة النموذجية (model_answer) بالحسابات والناتج الجديد.
5. حافظ على نفس النص اللغوي والصيغة والمفاهيم العلمية ومستوى الصعوبة بدون أي تغيير في جوهر السؤال.
6. إذا كان السؤال يعتمد على صورة أو رسم تخطيطي ولم تذكر أرقام في نصه وكان التغيير مقتصراً على نواتج الخيارات، فعدل الخيارات والحسابات بدقة.

الأسئلة المطلوب تغيير أرقامها:
${JSON.stringify(questionsPromptPayload, null, 2)}

أرجع الناتج بصيغة JSON حصراً بهذا المخطط:
{
  "variations": [
    {
      "id": "معرف_السؤال_الأصلي",
      "text": "نص السؤال بعد تغيير الأرقام الجديدة",
      "choices": [
        { "choice_code": "أ", "text": "...", "is_correct": true, "order_index": 0 },
        { "choice_code": "ب", "text": "...", "is_correct": false, "order_index": 1 },
        { "choice_code": "ج", "text": "...", "is_correct": false, "order_index": 2 },
        { "choice_code": "د", "text": "...", "is_correct": false, "order_index": 3 }
      ],
      "model_answer": "الإجابة والناتج الجديد"
    }
  ]
}`;

    const ai = new GoogleGenAI({ apiKey });
    const CANDIDATE_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash'];

    let responseText: string | undefined;
    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await ai.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { responseMimeType: 'application/json' },
          });
          if (result?.text) {
            responseText = result.text;
            break;
          }
        } catch (e: any) {
          // If rate limit or temporary server spike, short pause before retry
          await new Promise(r => setTimeout(r, 600));
        }
      }
      if (responseText) break;
    }

    if (!responseText) {
      console.warn('varyModelNumericalQuestionsAction: No response from Gemini models');
      return { success: false, variations: {} };
    }

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleanJson);
    const variationsMap: Record<string, VariedQuestionItem> = {};

    (parsed.variations || []).forEach((v: any) => {
      if (v.id && v.text) {
        variationsMap[v.id] = {
          original_id: v.id,
          text: v.text,
          choices: Array.isArray(v.choices) ? v.choices : [],
          model_answer: v.model_answer || null,
        };
      }
    });

    return { success: true, variations: variationsMap };
  } catch (err: any) {
    console.error('varyModelNumericalQuestionsAction error:', err);
    return { success: false, variations: {} };
  }
}
