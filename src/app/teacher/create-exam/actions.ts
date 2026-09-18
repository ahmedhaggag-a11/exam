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
}

export async function generateExamAction(
  pool: QuestionPoolItem[],
  config: GenerateExamConfig
): Promise<{ selected_question_ids: string[]; reasoning: string }> {
  if (pool.length === 0) {
    return { selected_question_ids: [], reasoning: 'لا توجد أسئلة في البنك' };
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback: algorithmic selection without AI
  const fallback = () => {
    const mcqPool = pool.filter(q => q.question_type === 'mcq');
    const essayPool = pool.filter(q => q.question_type === 'essay');
    const tfPool = pool.filter(q => q.question_type === 'true_false');
    const shuffle = (arr: QuestionPoolItem[]) => [...arr].sort(() => Math.random() - 0.5);

    const selected = [
      ...shuffle(mcqPool).slice(0, config.question_types.mcq),
      ...shuffle(essayPool).slice(0, config.question_types.essay),
      ...shuffle(tfPool).slice(0, config.question_types.true_false),
    ];

    // Fill remaining slots from any type if not enough of one type
    if (selected.length < config.total_questions) {
      const usedIds = new Set(selected.map(q => q.id));
      const remaining = shuffle(pool.filter(q => !usedIds.has(q.id)));
      selected.push(...remaining.slice(0, config.total_questions - selected.length));
    }

    return {
      selected_question_ids: selected.map(q => q.id),
      reasoning: 'تم الاختيار الخوارزمي بناءً على توزيع أنواع الأسئلة',
    };
  };

  if (!apiKey) {
    console.warn('No GEMINI_API_KEY, using algorithmic fallback');
    return fallback();
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const bankSummary = pool.map(q => ({
      id: q.id,
      type: q.question_type,
      difficulty: q.difficulty,
      chapter: q.chapter,
      text: q.text.slice(0, 80),
    }));

    const prompt = `أنت محرك توليد امتحانات ذكي.
مهمتك: اختر بالضبط ${config.total_questions} سؤال من البنك التالي.

المواصفات:
- المادة: ${config.subject}
- الصف: ${config.grade}
- الفصول المطلوبة: ${config.selected_chapters.length > 0 ? config.selected_chapters.join('، ') : 'جميع الفصول'}
- أسئلة اختيار من متعدد: ${config.question_types.mcq}
- أسئلة مقالية: ${config.question_types.essay}
- أسئلة صح/خطأ: ${config.question_types.true_false}

قواعد صارمة:
1. اختر IDs حقيقية من البنك فقط - لا تخترع IDs
2. التزم بالأعداد المحددة لكل نوع قدر الإمكان
3. وزّع الأسئلة على الفصول بشكل متوازن
4. فضّل الأسئلة متنوعة الصعوبة

بنك الأسئلة:
${JSON.stringify(bankSummary)}

أعد JSON فقط بهذا الشكل:
{"selected_question_ids": ["id1", "id2", ...], "reasoning": "سبب الاختيار"}`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const text = result.text;
    if (!text) return fallback();

    const parsed = JSON.parse(text);
    if (Array.isArray(parsed.selected_question_ids) && parsed.selected_question_ids.length > 0) {
      // Validate IDs exist in pool
      const validIds = new Set(pool.map(q => q.id));
      const filtered = parsed.selected_question_ids.filter((id: string) => validIds.has(id));
      if (filtered.length > 0) {
        return { selected_question_ids: filtered, reasoning: parsed.reasoning || '' };
      }
    }
    return fallback();
  } catch (err) {
    console.error('Gemini generateExam error:', err);
    return fallback();
  }
}
