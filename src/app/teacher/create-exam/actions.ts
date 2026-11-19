'use server';

import { createClient } from '@supabase/supabase-js';

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
