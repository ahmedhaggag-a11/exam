'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateExamAction, varyModelNumericalQuestionsAction } from './actions';
import { generateExamModels } from '@/lib/utils/exam-shuffler';
import {
  RefreshCw,
  Search,
  Trash2,
  Edit3,
  X,
  BookOpen,
  Layers,
  Sparkles,
  Sliders,
  Shuffle,
  QrCode,
  Save,
  AlertCircle,
  Award,
  Check,
  CheckSquare,
  Square,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ListOrdered,
  Crop,
  RotateCcw,
  Bookmark,
  HelpCircle,
} from 'lucide-react';
import RecropModal from '@/components/RecropModal';

interface Subject { id: string; name: string; }
interface SourceItem { id: string; name: string; }
interface Question {
  id: string;
  text: string;
  question_text?: string;
  question_type: string;
  difficulty: string;
  options?: string[] | null;
  correct_answer?: string | null;
  topic?: string | null;
  chapter?: string | null;
  subject: string;
  source_id?: string | null;
  marks?: number;
  model_answer?: string | null;
  image_urls?: string[] | null;
  teacher_id?: string;
  source_page?: number | null;
  choices?: Array<{ id: string; choice_code: string; text: string; is_correct: boolean; order_index: number }>;
}

const STEPS = ['بيانات ومصادر الامتحان', 'الفصول والأعداد والصعوبة', 'نماذج وخيارات الترتيب', 'توليد الامتحان', 'مراجعة وتعديل وحفظ'];

type OrderStrategy = 'shuffle' | 'by_chapter' | 'easy_to_hard' | 'hard_to_easy' | 'type_mcq_first';

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function CreateExamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedModels, setGeneratedModels] = useState<any[]>([]);
  const [activeModel, setActiveModel] = useState(0);
  const [error, setError] = useState('');
  const [reasoning, setReasoning] = useState('');

  // Re-crop Modal state for Create Exam
  const [recropModalOpen, setRecropModalOpen] = useState(false);
  const [selectedRecropQuestion, setSelectedRecropQuestion] = useState<any | null>(null);

  // ── Step 0
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('all');
  const [grade, setGrade] = useState('');
  const [duration, setDuration] = useState('60');
  const [examDate, setExamDate] = useState('');
  const [instructions, setInstructions] = useState('أجب عن جميع الأسئلة');
  const [totalMark, setTotalMark] = useState(100);
  const [enableQrCode, setEnableQrCode] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrTitle, setQrTitle] = useState('امسح الكود لمشاهدة فيديو شرح وحل الامتحان');

  // ── Step 1 — Mode & Questions Selection
  const [creationMode, setCreationMode] = useState<'auto' | 'manual'>('auto');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const [manualTypeFilter, setManualTypeFilter] = useState<'all' | 'mcq' | 'essay' | 'true_false'>('all');
  const [manualDiffFilter, setManualDiffFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [selectedManualIds, setSelectedManualIds] = useState<string[]>([]);
  const [mcqCount, setMcqCount] = useState(5);
  const [essayCount, setEssayCount] = useState(1);
  const [tfCount, setTfCount] = useState(0);
  const [easyCount, setEasyCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);

  // ── Step 2 — Models & Shuffle
  const [modelsCount, setModelsCount] = useState(2);
  const [shuffleQuestionOrder, setShuffleQuestionOrder] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [varyQuestionNumbers, setVaryQuestionNumbers] = useState(true);
  const [template] = useState('classic');

  // ── Per-model question order strategy
  const [perModelOrder, setPerModelOrder] = useState<OrderStrategy[]>(['shuffle', 'shuffle', 'shuffle', 'shuffle']);

  function setModelOrder(modelIndex: number, strategy: OrderStrategy) {
    setPerModelOrder(prev => prev.map((s, i) => i === modelIndex ? strategy : s));
  }

  function applyOrderStrategy(questions: any[], strategy: OrderStrategy, modelCode: string): any[] {
    switch (strategy) {
      case 'by_chapter':
        return [...questions].sort((a, b) => (a.chapter || a.topic || '').localeCompare(b.chapter || b.topic || '', 'ar'));
      case 'easy_to_hard': {
        const diff = { easy: 0, medium: 1, hard: 2 };
        return [...questions].sort((a, b) => (diff[a.difficulty as keyof typeof diff] ?? 1) - (diff[b.difficulty as keyof typeof diff] ?? 1));
      }
      case 'hard_to_easy': {
        const diff = { easy: 0, medium: 1, hard: 2 };
        return [...questions].sort((a, b) => (diff[b.difficulty as keyof typeof diff] ?? 1) - (diff[a.difficulty as keyof typeof diff] ?? 1));
      }
      case 'type_mcq_first':
        return [...questions].sort((a, b) => {
          const order = { mcq: 0, true_false: 1, essay: 2 };
          return (order[a.question_type as keyof typeof order] ?? 3) - (order[b.question_type as keyof typeof order] ?? 3);
        });
      case 'shuffle':
      default:
        return seededShuffle(questions, `order_${modelCode}_${questions.length}`);
    }
  }

  // ── Step 4 — Grading Mode (تخصيص الدرجات)
  const [gradingMode, setGradingMode] = useState<'equal' | 'custom'>('equal');

  // ── Modals
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [targetQuestionIndex, setTargetQuestionIndex] = useState<number | null>(null);
  const [replacementSearch, setReplacementSearch] = useState('');
  const [replacementScope, setReplacementScope] = useState<'all' | 'exam_topics'>('all');
  const [replacementChapter, setReplacementChapter] = useState('all');
  const [replacementLesson, setReplacementLesson] = useState('all');
  const [replacementType, setReplacementType] = useState('all');
  const [replacementDiff, setReplacementDiff] = useState('all');
  const [replacementSource, setReplacementSource] = useState('all');
  const [editingQuestionModalOpen, setEditingQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => {
    if (subjectId) loadQuestions(subjectId);
    else setQuestions([]);
  }, [subjectId]);

  async function loadInitialData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('subjects, grades').eq('id', user.id).single();
    if (profile?.subjects?.length) {
      setSubjects(profile.subjects.map((name: string) => ({ id: name, name })));
      setSubjectId(prev => prev || profile.subjects[0]);
    }
    if (profile?.grades?.length) setGrade(prev => prev || profile.grades[0]);
    const { data: src } = await supabase.from('sources').select('id, name').eq('teacher_id', user.id).order('created_at', { ascending: false });
    if (src) setSources(src);
  }

  async function loadQuestions(subject?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase.from('questions').select('*, choices:question_choices(*)').eq('teacher_id', user.id).order('created_at', { ascending: false });
    if (subject?.trim()) query = query.eq('subject', subject);
    const { data } = await query;
    if (!data?.length && subject) {
      const { data: all } = await supabase.from('questions').select('*, choices:question_choices(*)').eq('teacher_id', user.id).order('created_at', { ascending: false });
      setQuestions(all || []);
    } else {
      setQuestions(data || []);
    }
  }

  const sourceFilteredQuestions = selectedSourceId !== 'all'
    ? questions.filter(q => q.source_id === selectedSourceId)
    : questions;

  const availableTopics = Array.from(new Set(sourceFilteredQuestions.map(q => q.chapter || q.topic).filter(Boolean) as string[]));

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]);
  }

  const pool = selectedTopics.length > 0
    ? sourceFilteredQuestions.filter(q => selectedTopics.includes(q.chapter || q.topic || ''))
    : sourceFilteredQuestions;

  const mcqAvailable = pool.filter(q => q.question_type === 'mcq').length;
  const essayAvailable = pool.filter(q => q.question_type === 'essay').length;
  const tfAvailable = pool.filter(q => q.question_type === 'true_false').length;
  const easyAvailable = pool.filter(q => q.difficulty === 'easy').length;
  const medAvailable = pool.filter(q => q.difficulty === 'medium').length;
  const hardAvailable = pool.filter(q => q.difficulty === 'hard').length;

  const hasDiffTarget = (easyCount + mediumCount + hardCount) > 0;
  const totalRequested = hasDiffTarget
    ? easyCount + mediumCount + hardCount
    : mcqCount + essayCount + tfCount;

  function handleToggleManualSelect(id: string) {
    setSelectedManualIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleSelectAllVisibleManual(visibleIds: string[]) {
    const allSelected = visibleIds.every(id => selectedManualIds.includes(id));
    if (allSelected) {
      setSelectedManualIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedManualIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  }

  async function applyModelVariations(modelsList: any[]): Promise<any[]> {
    if (!varyQuestionNumbers || modelsList.length <= 1) return modelsList;
    const updated = [...modelsList];
    let totalVariedCount = 0;

    for (let m = 1; m < updated.length; m++) {
      const model = updated[m];
      try {
        const varRes = await varyModelNumericalQuestionsAction(
          model.questions,
          model.model_code,
          model.model_name
        );
        if (varRes.success && Object.keys(varRes.variations).length > 0) {
          model.questions = model.questions.map((q: any) => {
            const v = varRes.variations[q.id];
            if (v) {
              totalVariedCount++;
              return {
                ...q,
                original_id: q.id,
                id: `${q.id}_var_${model.model_code}`,
                text: v.text,
                choices: v.choices && v.choices.length > 0 ? v.choices : q.choices,
                model_answer: v.model_answer || q.model_answer,
                is_varied: true,
              };
            }
            return q;
          });
        }
      } catch (err) {
        console.warn('Numerical variation failed for model ' + model.model_code, err);
      }
    }

    if (totalVariedCount > 0) {
      setReasoning(prev => {
        const msg = `🔢 تم تغيير أرقام ومعطيات ${totalVariedCount} مسألة حسابية بنجاح عبر النماذج بالذكاء الاصطناعي بدقة 100%.`;
        return prev ? `${prev} • ${msg}` : msg;
      });
    }

    return updated;
  }

  async function handleGenerateManual() {
    if (selectedManualIds.length === 0) return;
    const selectedQs = selectedManualIds
      .map(id => pool.find(q => q.id === id) || questions.find(q => q.id === id))
      .filter(Boolean) as Question[];

    if (!selectedQs.length) return;

    setGenerating(true);
    setStep(3);
    setError('');

    try {
      let models = generateExamModels(
        selectedQs as any,
        modelsCount,
        shuffleQuestionOrder,
        shuffleChoices,
        false
      );

      // Apply per-model order strategy
      models = models.map((m, i) => ({
        ...m,
        questions: applyOrderStrategy(m.questions, perModelOrder[i] ?? 'shuffle', m.model_code),
      }));

      // Apply numerical variation across models (B, C, D) if enabled
      models = await applyModelVariations(models);

      if (gradingMode === 'equal' && selectedQs.length > 0) {
        const baseMark = Math.max(1, Math.round((totalMark / selectedQs.length) * 10) / 10);
        models = models.map(m => ({
          ...m,
          questions: m.questions.map((q: any) => ({ ...q, marks: baseMark }))
        }));
      }

      setGeneratedModels(models);
      setReasoning(prev => prev || `تم تكوين الامتحان بنجاح بناءً على اختيارك اليدوي لعدد (${selectedQs.length}) أسئلة محددة من بنك الأسئلة.`);
      setStep(4);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء توليد الامتحان');
    } finally {
      setGenerating(false);
    }
  }

  // Active Model Questions & Marks Calculations
  const currentModelQuestions = generatedModels[activeModel]?.questions || [];
  const totalQuestionsInModel = currentModelQuestions.length || 1;
  const currentSumMarks = currentModelQuestions.reduce((sum: number, q: any) => sum + (Number(q.marks) || 1), 0);
  const equalMarkPerQ = Math.max(1, Math.round((totalMark / totalQuestionsInModel) * 10) / 10);

  // Toggle or select grading mode
  function handleSelectGradingMode(mode: 'equal' | 'custom') {
    setGradingMode(mode);
    if (mode === 'equal') {
      const updatedModels = generatedModels.map(m => ({
        ...m,
        questions: m.questions.map((q: any) => ({
          ...q,
          marks: equalMarkPerQ
        }))
      }));
      setGeneratedModels(updatedModels);
    }
  }

  // Update a single question's marks across models
  function handleUpdateQuestionMarks(qIdOrIdx: string | number, newMarks: number) {
    const safeMark = Math.max(1, Number(newMarks) || 1);
    setGradingMode('custom');
    const updatedModels = generatedModels.map(m => ({
      ...m,
      questions: m.questions.map((q: any, i: number) => {
        if (q.id === qIdOrIdx || i === qIdOrIdx) {
          return { ...q, marks: safeMark };
        }
        return q;
      })
    }));
    setGeneratedModels(updatedModels);
  }

  function handleSyncTotalWithSum() {
    setTotalMark(currentSumMarks);
  }

  function handleImageUpdated(questionId: string, newImageUrl: string) {
    setGeneratedModels((prevModels) =>
      prevModels.map((model) => ({
        ...model,
        questions: model.questions.map((q: any) => {
          if (q.id === questionId || q.original_id === questionId) {
            const existing = q.image_urls || [];
            return {
              ...q,
              image_urls: [newImageUrl, ...existing.filter((u: string) => u !== newImageUrl)],
            };
          }
          return q;
        }),
      }))
    );
  }

  function handleImageRemoved(questionId: string) {
    setGeneratedModels((prevModels) =>
      prevModels.map((model) => ({
        ...model,
        questions: model.questions.map((q: any) => {
          if (q.id === questionId || q.original_id === questionId) {
            return {
              ...q,
              image_urls: [],
            };
          }
          return q;
        }),
      }))
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setReasoning('');
    try {
      const poolItems = pool.map(q => ({
        id: q.id,
        text: q.text || q.question_text || '',
        question_type: q.question_type,
        difficulty: q.difficulty || 'medium',
        chapter: q.chapter || q.topic || '',
        source_id: q.source_id,
      }));

      const result = await generateExamAction(poolItems, {
        subject: subjectId,
        selected_chapters: selectedTopics,
        total_questions: totalRequested,
        question_types: { mcq: mcqCount, essay: essayCount, true_false: tfCount },
        difficulty_counts: hasDiffTarget ? { easy: easyCount, medium: mediumCount, hard: hardCount } : undefined,
        grade,
        duration: parseInt(duration),
        instructions,
      });

      if (!result.selected_question_ids.length) {
        setError('لم يتم العثور على أسئلة كافية في البنك. يرجى تقليل العدد أو اختيار فصول أكثر.');
        setGenerating(false);
        return;
      }

      setReasoning(result.reasoning);

      const selectedQs = result.selected_question_ids
        .map(id => pool.find(q => q.id === id))
        .filter(Boolean) as Question[];

      let models = generateExamModels(
        selectedQs as any,
        modelsCount,
        shuffleQuestionOrder,
        shuffleChoices,
        false
      );

      // Apply per-model order strategy
      models = models.map((m, i) => ({
        ...m,
        questions: applyOrderStrategy(m.questions, perModelOrder[i] ?? 'shuffle', m.model_code),
      }));

      // Apply numerical variation across models (B, C, D) if enabled
      models = await applyModelVariations(models);

      // Apply initial equal marks distribution if equal mode
      if (gradingMode === 'equal' && selectedQs.length > 0) {
        const baseMark = Math.max(1, Math.round((totalMark / selectedQs.length) * 10) / 10);
        models = models.map(m => ({
          ...m,
          questions: m.questions.map((q: any) => ({ ...q, marks: baseMark }))
        }));
      }

      setGeneratedModels(models);
      setStep(4);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء توليد الامتحان');
    }
    setGenerating(false);
  }

  function handleReplaceRandom(questionIndex: number) {
    const currentModel = generatedModels[activeModel];
    if (!currentModel?.questions) return;
    const currentQ = currentModel.questions[questionIndex];
    const usedIds = new Set(currentModel.questions.map((q: any) => q.id));
    const candidates = pool.filter(q => !usedIds.has(q.id) && (q.question_type === currentQ.question_type || !currentQ.question_type));
    const best = candidates.find(q => q.chapter === currentQ.chapter && q.difficulty === currentQ.difficulty)
      || candidates.find(q => q.chapter === currentQ.chapter)
      || candidates[0];
    if (!best) { alert('لا توجد أسئلة بديلة غير مستخدمة.'); return; }
    const updated = [...generatedModels];
    const qs = [...currentModel.questions];
    qs[questionIndex] = { ...best, marks: currentQ.marks || 2 };
    updated[activeModel] = { ...currentModel, questions: qs };
    setGeneratedModels(updated);
  }

  function openReplacementModal(idx: number) {
    setTargetQuestionIndex(idx);
    setReplacementSearch('');
    const currentModel = generatedModels[activeModel];
    const currentQ = currentModel?.questions?.[idx];
    if (currentQ) {
      setReplacementChapter(currentQ.chapter || currentQ.topic || 'all');
      setReplacementLesson((currentQ as any).lesson || 'all');
      setReplacementType(currentQ.question_type || 'all');
    } else {
      setReplacementChapter('all');
      setReplacementLesson('all');
      setReplacementType('all');
    }
    setReplacementDiff('all');
    setReplacementSource('all');
    setReplacementScope('all');
    setReplacementModalOpen(true);
  }

  function resetReplacementFilters() {
    setReplacementSearch('');
    setReplacementChapter('all');
    setReplacementLesson('all');
    setReplacementType('all');
    setReplacementDiff('all');
    setReplacementSource('all');
    setReplacementScope('all');
  }

  const hasActiveReplacementFilters =
    replacementSearch.trim() !== '' ||
    replacementChapter !== 'all' ||
    replacementLesson !== 'all' ||
    replacementType !== 'all' ||
    replacementDiff !== 'all' ||
    replacementSource !== 'all' ||
    replacementScope !== 'all';

  const sourcesMap = useMemo(() => {
    const map: Record<string, string> = {};
    sources.forEach(s => { map[s.id] = s.name; });
    return map;
  }, [sources]);

  const replacementAvailableChapters = useMemo(() => {
    const baseList = replacementScope === 'exam_topics' && selectedTopics.length > 0
      ? questions.filter(q => selectedTopics.includes(q.chapter || q.topic || ''))
      : questions;
    const chapters = baseList
      .map(q => q.chapter || q.topic)
      .filter((c): c is string => !!c && c.trim() !== '');
    return Array.from(new Set(chapters)).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [questions, replacementScope, selectedTopics]);

  const replacementAvailableLessons = useMemo(() => {
    let subset = replacementScope === 'exam_topics' && selectedTopics.length > 0
      ? questions.filter(q => selectedTopics.includes(q.chapter || q.topic || ''))
      : questions;
    if (replacementChapter !== 'all') {
      subset = subset.filter(q => (q.chapter || q.topic) === replacementChapter);
    }
    const lessons = subset
      .map((q: any) => q.lesson)
      .filter((l): l is string => !!l && l.trim() !== '');
    return Array.from(new Set(lessons)).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [questions, replacementScope, selectedTopics, replacementChapter]);

  const currentModelQuestionIds = useMemo(() => {
    const currentModel = generatedModels[activeModel];
    if (!currentModel?.questions) return new Set<string>();
    return new Set(currentModel.questions.map((q: any) => q.id));
  }, [generatedModels, activeModel]);

  const filteredReplacementQuestions = useMemo(() => {
    const baseList = replacementScope === 'exam_topics' && selectedTopics.length > 0
      ? questions.filter(q => selectedTopics.includes(q.chapter || q.topic || ''))
      : questions;

    const list = baseList.filter(q => {
      // 1. Text Search
      if (replacementSearch.trim()) {
        const term = replacementSearch.toLowerCase();
        const textMatch = (q.text || q.question_text || '').toLowerCase().includes(term);
        const chapterMatch = (q.chapter || q.topic || '').toLowerCase().includes(term);
        const lessonMatch = ((q as any).lesson || '').toLowerCase().includes(term);
        if (!textMatch && !chapterMatch && !lessonMatch) return false;
      }

      // 2. Chapter Filter
      if (replacementChapter !== 'all') {
        if ((q.chapter || q.topic) !== replacementChapter) return false;
      }

      // 3. Lesson Filter
      if (replacementLesson !== 'all') {
        if ((q as any).lesson !== replacementLesson) return false;
      }

      // 4. Type Filter
      if (replacementType !== 'all') {
        if (q.question_type !== replacementType) return false;
      }

      // 5. Difficulty Filter
      if (replacementDiff !== 'all') {
        if (q.difficulty !== replacementDiff) return false;
      }

      // 6. Source Filter
      if (replacementSource !== 'all') {
        if (q.source_id !== replacementSource) return false;
      }

      return true;
    });

    // Sort: Unused questions in current exam first
    return [...list].sort((a, b) => {
      const aUsed = currentModelQuestionIds.has(a.id) ? 1 : 0;
      const bUsed = currentModelQuestionIds.has(b.id) ? 1 : 0;
      return aUsed - bUsed;
    });
  }, [
    questions,
    replacementScope,
    selectedTopics,
    currentModelQuestionIds,
    replacementSearch,
    replacementChapter,
    replacementLesson,
    replacementType,
    replacementDiff,
    replacementSource
  ]);

  function handleSelectReplacementQuestion(q: Question) {
    if (targetQuestionIndex === null) return;
    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;
    const currentQ = currentModel.questions[targetQuestionIndex];
    const updated = [...generatedModels];
    const qs = [...currentModel.questions];
    qs[targetQuestionIndex] = { ...q, marks: currentQ?.marks || 2 };
    updated[activeModel] = { ...currentModel, questions: qs };
    setGeneratedModels(updated);
    setReplacementModalOpen(false);
    setTargetQuestionIndex(null);
  }

  function handleRemoveQuestion(idx: number) {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال؟')) return;
    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;
    const updated = [...generatedModels];
    updated[activeModel] = { ...currentModel, questions: currentModel.questions.filter((_: any, i: number) => i !== idx) };
    setGeneratedModels(updated);
  }

  function handleMoveQuestion(fromIndex: number, direction: 'up' | 'down') {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    const currentModel = generatedModels[activeModel];
    if (!currentModel?.questions || toIndex < 0 || toIndex >= currentModel.questions.length) return;
    const updated = [...generatedModels];
    const qs = [...currentModel.questions];
    const temp = qs[fromIndex];
    qs[fromIndex] = qs[toIndex];
    qs[toIndex] = temp;
    updated[activeModel] = { ...currentModel, questions: qs };
    setGeneratedModels(updated);
  }

  function handleApplyOrderToCurrentModel(strategy: OrderStrategy) {
    const currentModel = generatedModels[activeModel];
    if (!currentModel?.questions) return;
    const sorted = applyOrderStrategy(currentModel.questions, strategy, `${currentModel.model_code}_${Date.now()}`);
    const updated = [...generatedModels];
    updated[activeModel] = { ...currentModel, questions: sorted };
    setGeneratedModels(updated);
  }

  function openEditQuestionModal(q: Question, idx: number) {
    setEditingQuestion({ ...q });
    setEditingIndex(idx);
    setEditingQuestionModalOpen(true);
  }

  function handleSaveEditedQuestion() {
    if (!editingQuestion) return;

    // 1. Update questions in the local bank state so manual selection picks up the updated text
    setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...q, ...editingQuestion } : q));

    // 2. Also persist the updated question text to Supabase database so it remains saved
    (async () => {
      try {
        await supabase.from('questions').update({
          question_text: editingQuestion.text,
          difficulty: editingQuestion.difficulty,
        }).eq('id', editingQuestion.id);
      } catch (err) {
        console.error('Failed to update question in DB:', err);
      }
    })();

    // 3. If we are editing from Step 4 (active generated model)
    if (editingIndex !== null) {
      const currentModel = generatedModels[activeModel];
      if (currentModel) {
        const updated = [...generatedModels];
        const qs = [...currentModel.questions];
        qs[editingIndex] = { ...editingQuestion };
        updated[activeModel] = { ...currentModel, questions: qs };
        setGeneratedModels(updated);
      }
    }

    setEditingQuestionModalOpen(false);
    setEditingIndex(null);
    setEditingQuestion(null);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مسجل دخول');
      const totalQuestions = generatedModels[0]?.questions?.length || 0;
      const finalTotalMarks = gradingMode === 'custom' ? currentSumMarks : totalMark;

      const { data: exam, error: examError } = await supabase.from('exams').insert({
        teacher_id: user.id,
        subject: subjectId,
        title,
        grade_level: grade,
        duration_minutes: parseInt(duration),
        exam_date: examDate || null,
        instructions,
        total_marks: finalTotalMarks,
        total_questions: totalQuestions,
        models_count: modelsCount,
        template_name: template,
        status: 'draft',
      }).select().single();
      if (examError) throw new Error(`خطأ في حفظ الامتحان: ${examError.message}`);

      // 1. If any questions were varied for models B, C, D, insert them into questions and question_choices to get their real IDs!
      for (let i = 0; i < generatedModels.length; i++) {
        const model = generatedModels[i];
        for (let qIdx = 0; qIdx < model.questions.length; qIdx++) {
          const q = model.questions[qIdx];
          if (q.is_varied) {
            const baseQ = pool.find((pq: any) => pq.id === q.original_id) || questions.find((pq: any) => pq.id === q.original_id) || q;
            const { data: newQ, error: newQError } = await supabase.from('questions').insert({
              teacher_id: user.id,
              text: q.text,
              question_type: q.question_type || baseQ.question_type || 'mcq',
              difficulty: q.difficulty || baseQ.difficulty || 'medium',
              subject: q.subject || baseQ.subject || subjectId,
              chapter: q.chapter || baseQ.chapter || 'عام',
              lesson: q.lesson || baseQ.lesson || null,
              grade_level: q.grade_level || baseQ.grade_level || grade || null,
              branch: q.branch || baseQ.branch || null,
              term: q.term || baseQ.term || null,
              model_answer: q.model_answer || baseQ.model_answer || null,
              marks: q.marks || baseQ.marks || 1,
              image_urls: q.image_urls || baseQ.image_urls || [],
              needs_review: false,
            }).select().single();

            if (newQ && !newQError) {
              if (q.choices && q.choices.length > 0) {
                await supabase.from('question_choices').insert(q.choices.map((c: any, cIdx: number) => ({
                  question_id: newQ.id,
                  choice_code: c.choice_code || ['أ', 'ب', 'ج', 'د'][cIdx] || 'أ',
                  text: c.text,
                  is_correct: !!c.is_correct,
                  order_index: c.order_index ?? cIdx,
                })));
              }
              model.questions[qIdx] = { ...q, id: newQ.id };
            } else {
              console.warn('Varied question insert error, falling back to original ID:', newQError);
              model.questions[qIdx] = { ...q, id: q.original_id || q.id };
            }
          }
        }
      }

      // Extra safeguard: Ensure all question IDs across all models are valid UUIDs (no '_var_' leftovers)
      for (const model of generatedModels) {
        for (let qIdx = 0; qIdx < model.questions.length; qIdx++) {
          const q = model.questions[qIdx];
          if (typeof q.id === 'string' && q.id.includes('_var_')) {
            model.questions[qIdx].id = q.original_id || q.id.split('_var_')[0];
          }
        }
      }

      // Collect ALL unique question IDs across ALL models (Base model + varied models)
      const allUniqueQuestionIds = Array.from(new Set(generatedModels.flatMap(m => m.questions.map((q: any) => q.id))));
      const qRows = allUniqueQuestionIds.map((qid, idx) => ({ exam_id: exam.id, question_id: qid, order_index: idx }));
      await supabase.from('exam_questions').insert(qRows);

      for (let i = 0; i < generatedModels.length; i++) {
        const model = generatedModels[i];
        await supabase.from('exam_models').insert({
          exam_id: exam.id,
          model_code: ['A', 'B', 'C', 'D'][i] || `M${i + 1}`,
          model_name: ['أ', 'ب', 'ج', 'د'][i] || `نموذج ${i + 1}`,
          questions_order: model.questions.map((q: any) => q.id),
          choices_order: model.choices_order || {},
        });
      }
      if (enableQrCode && qrUrl.trim()) {
        try {
          const { getPaperTemplateConfig, savePaperTemplateConfig } = await import('@/app/admin/paper-templates/actions');
          const cfg = await getPaperTemplateConfig(user.id);
          await savePaperTemplateConfig({ ...cfg, qrCode: { enabled: true, url: qrUrl.trim(), title: qrTitle.trim() } }, `exam_${exam.id}`);
        } catch {}
      }
      router.push('/teacher/exams');
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء الحفظ');
    }
    setSaving(false);
  }

  const canStep0 = !!(title && subjectId && grade);
  const canStep1 = creationMode === 'manual'
    ? selectedManualIds.length > 0
    : (totalRequested > 0 && pool.length > 0);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-12 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800">إنشاء وتوليد امتحان جديد 📝⚡</h1>
        <p className="text-xs text-slate-500 mt-1">اختر المصادر والفصول والأعداد، ثم راجع وخصص درجات كل سؤال قبل الحفظ.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center shrink-0">
            <div className={`flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold transition ${
              i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-100 text-slate-400'
            }`}>{i < step ? '✓' : i + 1}</div>
            <span className={`mx-2 text-xs font-bold ${i === step ? 'text-blue-700 font-black' : 'text-slate-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ml-2 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* ── Step 0: Exam Info & Source */}
      {step === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-base">
            <Sliders className="w-5 h-5 text-blue-600" /><span>بيانات الامتحان والمصدر المستهدف</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان الامتحان *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="امتحان شامل على الفصلين الأول والثاني" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المادة الدراسية *</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50">
                <option value="">اختر المادة</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" /><span>مصدر الأسئلة (الكتاب / الملزمة)</span>
              </label>
              <select value={selectedSourceId} onChange={e => setSelectedSourceId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-indigo-50/40">
                <option value="all">جميع الكتب والمصادر المرفوعة (الشامل)</option>
                {sources.map(s => <option key={s.id} value={s.id}>📖 {s.name}</option>)}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">يمكنك حصر الامتحان في أسئلة كتاب أو مذكرة معينة قمت برفعها مسبقاً.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الصف الدراسي *</label>
              <input value={grade} onChange={e => setGrade(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="الصف الثالث الثانوي" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المدة الزمنية (بالدقائق)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" min={15} max={240} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الدرجة الكلية للامتحان</label>
              <input type="number" value={totalMark} onChange={e => setTotalMark(Number(e.target.value))} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" min={5} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">تعليمات الامتحان للطلاب</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
          {/* QR Code */}
          <div className="border border-slate-200 bg-slate-50 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">إضافة كود QR ذكي على الورقة (اختياري)</span>
                  <span className="text-[11px] text-slate-500">كود QR بأسفل الورقة ينقل الطالب مباشرة لفيديو الحل أو التقرير.</span>
                </div>
              </div>
              <input type="checkbox" checked={enableQrCode} onChange={e => setEnableQrCode(e.target.checked)} className="w-5 h-5 accent-blue-600 rounded cursor-pointer" />
            </div>
            {enableQrCode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رابط الفيديو أو الحل (URL) *</label>
                  <input type="url" value={qrUrl} onChange={e => setQrUrl(e.target.value)} placeholder="https://youtu.be/..." className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">النص التوضيحي بجوار الكود</label>
                  <input type="text" value={qrTitle} onChange={e => setQrTitle(e.target.value)} placeholder="امسح الباركود لفيديو الشرح ونموذج الإجابة" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!canStep0} onClick={() => setStep(1)} className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition shadow-md shadow-blue-600/20">
              التالي (الفصول والأعداد) ←
            </button>
          </div>
        </div>
      )}

      {/* ── Step 1: Chapters + Question Types + Difficulty / Manual Picker */}
      {step === 1 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          {/* Header & Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <Layers className="w-5 h-5 text-blue-600" /><span>تحديد واختيار أسئلة الامتحان</span>
            </div>
            
            {/* Mode Toggle Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCreationMode('auto')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  creationMode === 'auto'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>توليد آلي ذكي (AI)</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode('manual')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
                  creationMode === 'manual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>اختيار يدوي وبحث في البنك</span>
                {selectedManualIds.length > 0 && (
                  <span className="bg-white text-blue-700 px-1.5 py-0.2 rounded-full text-[10px] font-black mr-1">
                    {selectedManualIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {pool.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" /><span>⚠️ لا توجد أسئلة لهذا المصدر أو المادة. يرجى اختيار مصدر آخر أو رفع أسئلة.</span>
            </div>
          ) : creationMode === 'auto' ? (
            /* ─── Mode A: Automatic / AI Configuration ─── */
            <div className="space-y-6">
              {availableTopics.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-700 mb-2">اختر الفصول / الأبواب (اتركها فارغة لاختيار الكل):</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTopics.map(topic => (
                      <button key={topic} onClick={() => toggleTopic(topic)} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${selectedTopics.includes(topic) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400'}`}>{topic}</button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">{selectedTopics.length === 0 ? 'سيتم السحب من جميع الفصول' : `تم اختيار ${selectedTopics.length} فصول`}</p>
                </div>
              )}

              {/* Question Types */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">توزيع أنواع الأسئلة:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-blue-900">اختيار من متعدد (MCQ)</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">متاح: {mcqAvailable}</span>
                    </div>
                    <input type="number" value={mcqCount} onChange={e => setMcqCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" />
                  </div>
                  <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-emerald-900">أسئلة مقالية (Essay)</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">متاح: {essayAvailable}</span>
                    </div>
                    <input type="number" value={essayCount} onChange={e => setEssayCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" />
                  </div>
                  <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-purple-900">صح أو خطأ (True/False)</span>
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">متاح: {tfAvailable}</span>
                    </div>
                    <input type="number" value={tfCount} onChange={e => setTfCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" />
                  </div>
                </div>
              </div>

              {/* Difficulty Distribution */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">
                  توزيع مستويات الصعوبة
                  <span className="text-slate-400 font-normal mr-1">(اختياري — اتركها أصفاراً للاختيار العشوائي)</span>
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-emerald-800">🟢 سهل (Easy)</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">متاح: {easyAvailable}</span>
                    </div>
                    <input type="number" value={easyCount} onChange={e => setEasyCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700 outline-none" />
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-amber-800">🟡 متوسط (Medium)</span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">متاح: {medAvailable}</span>
                    </div>
                    <input type="number" value={mediumCount} onChange={e => setMediumCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 outline-none" />
                  </div>
                  <div className="p-3 bg-red-50/60 rounded-xl border border-red-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-red-800">🔴 صعب (Hard)</span>
                      <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">متاح: {hardAvailable}</span>
                    </div>
                    <input type="number" value={hardCount} onChange={e => setHardCount(Math.max(0, Number(e.target.value)))} min={0} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-red-700 outline-none" />
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                  <span>إجمالي المطلوب: <strong className="text-sm font-black text-blue-700">{totalRequested}</strong> سؤال</span>
                  <span>المتاح في البنك: <strong className="text-sm font-black text-emerald-700">{pool.length}</strong> سؤال</span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap gap-3 pt-1 border-t border-blue-200/60">
                  <span>MCQ: <strong>{mcqAvailable}</strong></span>
                  <span>مقالي: <strong>{essayAvailable}</strong></span>
                  <span>صح/خطأ: <strong>{tfAvailable}</strong></span>
                  <span className="text-emerald-700">سهل: <strong>{easyAvailable}</strong></span>
                  <span className="text-amber-700">متوسط: <strong>{medAvailable}</strong></span>
                  <span className="text-red-700">صعب: <strong>{hardAvailable}</strong></span>
                </div>
                {pool.length < totalRequested && totalRequested > 0 && (
                  <div className="text-amber-800 bg-amber-100/70 p-2 rounded-lg font-bold">
                    ⚠️ المطلوب ({totalRequested}) أكبر من المتاح ({pool.length}). سيتم اختيار المتاح بالكامل.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ─── Mode B: Manual Selection & Search in Question Bank ─── */
            <div className="space-y-4">
              {/* Search Bar & Filters */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    value={manualSearch}
                    onChange={e => setManualSearch(e.target.value)}
                    placeholder="ابحث في نص السؤال، الفصل، الدرس، أو الكلمات المفتاحية..."
                    className="w-full pr-10 pl-10 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {manualSearch && (
                    <button
                      type="button"
                      onClick={() => setManualSearch('')}
                      className="absolute left-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500 font-bold flex items-center gap-1 text-[11px]">
                      <Filter className="w-3.5 h-3.5" />
                      <span>النوع:</span>
                    </span>
                    {(['all', 'mcq', 'essay', 'true_false'] as const).map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setManualTypeFilter(type)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          manualTypeFilter === type
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {type === 'all' ? 'الكل' : type === 'mcq' ? 'MCQ' : type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500 font-bold text-[11px]">الصعوبة:</span>
                    {(['all', 'easy', 'medium', 'hard'] as const).map(diff => (
                      <button
                        key={diff}
                        type="button"
                        onClick={() => setManualDiffFilter(diff)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                          manualDiffFilter === diff
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {diff === 'all' ? 'الكل' : diff === 'easy' ? '🟢 سهل' : diff === 'medium' ? '🟡 متوسط' : '🔴 صعب'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic selection chips if available */}
                {availableTopics.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/80">
                    <p className="text-[11px] font-bold text-slate-600 mb-1.5">تصفية حسب الفصل / الباب:</p>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {availableTopics.map(topic => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => toggleTopic(topic)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            selectedTopics.includes(topic)
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                          }`}
                        >
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Filtered Question Bank Results */}
              {(() => {
                const filteredQuestions = pool.filter(q => {
                  if (manualTypeFilter !== 'all' && q.question_type !== manualTypeFilter) return false;
                  if (manualDiffFilter !== 'all' && q.difficulty !== manualDiffFilter) return false;
                  if (manualSearch.trim()) {
                    const term = manualSearch.toLowerCase();
                    const textMatch = (q.text || q.question_text || '').toLowerCase().includes(term);
                    const chapterMatch = (q.chapter || q.topic || '').toLowerCase().includes(term);
                    if (!textMatch && !chapterMatch) return false;
                  }
                  return true;
                });

                const visibleIds = filteredQuestions.map(q => q.id);
                const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedManualIds.includes(id));

                return (
                  <div className="space-y-3">
                    {/* List Controls & Counter */}
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectAllVisibleManual(visibleIds)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        >
                          {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                          <span>{allVisibleSelected ? 'إلغاء تحديد المعروض' : 'تحديد كل المعروض'}</span>
                        </button>
                        <span className="text-xs text-slate-500 font-semibold">
                          (معروض: {filteredQuestions.length} سؤال)
                        </span>
                      </div>

                      {/* Selected Counter Pill */}
                      <div className="flex items-center gap-2">
                        {selectedManualIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedManualIds([])}
                            className="text-[11px] text-red-600 hover:underline font-bold"
                          >
                            مسح التحديد
                          </button>
                        )}
                        <span className="px-3 py-1 bg-blue-50 text-blue-800 rounded-xl border border-blue-200 text-xs font-black flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-blue-600" />
                          <span>تم اختيار: {selectedManualIds.length} سؤال</span>
                        </span>
                      </div>
                    </div>

                    {/* Questions Cards List */}
                    <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                      {filteredQuestions.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs font-bold">
                          لا توجد أسئلة تطابق البحث أو التصفيات الحالية.
                        </div>
                      ) : (
                        filteredQuestions.map((q, idx) => {
                          const isSelected = selectedManualIds.includes(q.id);
                          return (
                            <div
                              key={q.id || idx}
                              className={`p-4 transition space-y-2 cursor-pointer ${
                                isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-slate-50/50'
                              }`}
                              onClick={() => handleToggleManualSelect(q.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1">
                                  {/* Checkbox */}
                                  <div className="pt-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleManualSelect(q.id)}
                                      className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                                    />
                                  </div>

                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                                        q.question_type === 'mcq' ? 'bg-blue-100 text-blue-800' : q.question_type === 'essay' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {q.question_type === 'mcq' ? 'اختيار من متعدد' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                                        {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                                      </span>
                                      {q.chapter && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                                          {q.chapter}
                                        </span>
                                      )}
                                      {isSelected && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-600 text-white font-bold mr-auto">
                                          ✓ تم الاختيار
                                        </span>
                                      )}
                                    </div>

                                    {/* Question Text */}
                                    <p className="text-sm font-bold text-slate-800 leading-relaxed pt-1">
                                      {q.text || q.question_text}
                                    </p>

                                    {/* MCQ choices preview if present */}
                                    {q.choices && q.choices.length > 0 && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                        {[...q.choices].sort((a: any, b: any) => a.order_index - b.order_index).map((c: any, ci: number) => (
                                          <div key={ci} className={`text-xs p-2 rounded-lg border flex items-center justify-between ${
                                            c.is_correct ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold' : 'bg-white text-slate-700 border-slate-200'
                                          }`}>
                                            <span>({c.choice_code || ['أ', 'ب', 'ج', 'د'][ci]}) {c.text}</span>
                                            {c.is_correct && <span className="text-emerald-700 text-xs">✓ صحيح</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Quick Edit Question Text Button */}
                                <div className="shrink-0 pt-0.5" onClick={e => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => openEditQuestionModal(q, -1)}
                                    title="تعديل نص السؤال"
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-slate-200"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">تعديل النص</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex justify-between pt-2 border-t border-slate-100">
            <button onClick={() => setStep(0)} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">→ السابق</button>
            <button
              disabled={!canStep1}
              onClick={() => {
                if (creationMode === 'manual') {
                  setStep(2);
                } else {
                  setStep(2);
                }
              }}
              className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition shadow-md shadow-blue-600/20"
            >
              التالي (إعدادات النماذج) ←
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Models & Shuffle Options */}
      {step === 2 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-base">
            <Shuffle className="w-5 h-5 text-blue-600" /><span>إعدادات النماذج وترتيب الأسئلة والخيارات</span>
          </div>

          {/* Number of models */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">عدد نماذج الامتحان المطلوب توليدها:</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setModelsCount(n)} className={`w-12 h-12 rounded-2xl text-base font-black border-2 transition ${modelsCount === n ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 ring-2 ring-blue-400' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
                  {['أ', 'ب', 'ج', 'د'][n - 1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">سيتم توليد {modelsCount} نموذج جاهز للطباعة والتصحيح.</p>
          </div>

          {/* 3 Checkboxes */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-xs font-black text-slate-800 mb-1">خيارات الاختلاف بين النماذج:</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shuffleQuestionOrder} onChange={e => setShuffleQuestionOrder(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
              <span className="text-xs font-bold text-slate-700">اختلاف ترتيب الأسئلة (س1 في نموذج أ يصبح س4 في نموذج ب)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shuffleChoices} onChange={e => setShuffleChoices(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
              <span className="text-xs font-bold text-slate-700">اختلاف ترتيب الإجابات (أ / ب / ج / د) لكل سؤال بين النماذج</span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-2.5 bg-white rounded-xl border border-blue-200 hover:border-blue-400 transition shadow-2xs">
              <input
                type="checkbox"
                checked={varyQuestionNumbers}
                onChange={e => setVaryQuestionNumbers(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded mt-0.5 shrink-0"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-black text-slate-800 block">
                  🔢 تغيير أرقام ومعطيات المسائل الحسابية في النماذج (أرقام وحسابات مختلفة في كل نموذج)
                </span>
                <span className="text-[11px] text-slate-500 block leading-relaxed">
                  إذا كان السؤال يحتوي على أرقام وحسابات، يتم تغيير الأرقام في كل نموذج بحسابات ونواتج صحيحة ومختلفة لمنع نقل الإجابات.
                </span>
              </div>
            </label>
          </div>

          {/* Per-model question order customization */}
          <div className="space-y-3 p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <ListOrdered className="w-4 h-4 text-blue-600" />
              <p className="text-xs font-black text-slate-800">تخصيص طريقة ترتيب الأسئلة لكل نموذج في ورقة الامتحان:</p>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              يمكنك اختيار تسلسل وترتيب مختلف للأسئلة لكل نموذج على حدة (مثلاً نموذج مرتب حسب الدروس، ونموذج عشوائي، ونموذج من الأسهل للأصعب):
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: modelsCount }).map((_, mIdx) => {
                const modelName = ['أ', 'ب', 'ج', 'د'][mIdx];
                const currentStrategy = perModelOrder[mIdx] || 'shuffle';
                return (
                  <div key={mIdx} className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-900 bg-blue-100/70 px-2.5 py-1 rounded-lg">
                        نموذج ({modelName})
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {currentStrategy === 'shuffle' ? '🔀 عشوائي' :
                         currentStrategy === 'by_chapter' ? '📖 حسب الدروس' :
                         currentStrategy === 'easy_to_hard' ? '🟢 أسهل فأصعب' :
                         currentStrategy === 'hard_to_easy' ? '🔴 أصعب فأسهل' : '📝 مقالي أخيراً'}
                      </span>
                    </div>

                    <select
                      value={currentStrategy}
                      onChange={e => setModelOrder(mIdx, e.target.value as OrderStrategy)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="shuffle">🔀 ترتيب عشوائي / ملخبط (لمنع الغش)</option>
                      <option value="by_chapter">📖 مرتب حسب الفصول والدروس (منهجي)</option>
                      <option value="easy_to_hard">🟢 ترتيب تدريجي (من الأسهل إلى الأصعب)</option>
                      <option value="hard_to_easy">🔴 ترتيب عكسي (من الأصعب إلى الأسهل)</option>
                      <option value="type_mcq_first">📝 حسب نوع السؤال (اختيار من متعدد ثم مقالي)</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">→ السابق</button>
            <button
              onClick={() => {
                if (creationMode === 'manual') {
                  handleGenerateManual();
                } else {
                  setStep(3);
                  handleGenerate();
                }
              }}
              className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition shadow-md shadow-blue-600/30 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{creationMode === 'manual' ? 'تجهيز النماذج بالأسئلة المختارة ⚡' : 'توليد الامتحان ⚡'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Generating */}
      {step === 3 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
          {generating ? (
            <>
              <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-lg font-black text-slate-800">جاري اختيار الأسئلة وبناء النماذج...</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                يتم الآن اختيار {totalRequested} سؤال وتوزيعها على {modelsCount} نماذج بترتيبات مختلفة. العملية فورية!
              </p>
            </>
          ) : error ? (
            <div className="text-red-600 space-y-3">
              <p className="text-base font-black">❌ تعذر إتمام التوليد</p>
              <p className="text-xs text-slate-500">{error}</p>
              <button onClick={() => setStep(2)} className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition">رجوع وتعديل الخيارات</button>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Step 4: Review, Replace, Edit, Custom Grading, and Save */}
      {step === 4 && generatedModels.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          {reasoning && (
            <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl text-blue-900 text-xs font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" /><span>{reasoning}</span>
            </div>
          )}

          {/* Models Tab Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-800">مراجعة الامتحان وتخصيص الدرجات</h2>
              <p className="text-xs text-slate-400 mt-0.5">يمكنك مراجعة كل نموذج، وتعديل أي سؤال، وتخصيص درجات الأسئلة بحرية.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">معاينة النموذج:</span>
              <div className="flex gap-1.5 flex-wrap">
                {generatedModels.map((m, i) => {
                  const hasVaried = m.questions?.some((q: any) => q.is_varied);
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveModel(i)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black border transition flex items-center gap-1.5 ${
                        activeModel === i
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>نموذج {['أ', 'ب', 'ج', 'د'][i]}</span>
                      {hasVaried && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                          activeModel === i ? 'bg-blue-700 text-blue-100' : 'bg-purple-100 text-purple-700'
                        }`}>
                          🔢 أرقام جديدة
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ─── NEW: Grading Mode Customization Box (خيارين لتوزيع الدرجات) ─── */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>نظام وتوزيع درجات الامتحان:</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  اختر تقسيم الدرجة الكلية بالتساوي أو تخصيص درجة محددة لكل سؤال على حدة.
                </span>
              </div>

              {/* Live Marks Counter Badge */}
              <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                currentSumMarks === totalMark 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                <span>مجموع درجات الأسئلة:</span>
                <strong className="text-sm font-black">{currentSumMarks}</strong>
                <span>من</span>
                <strong className="text-sm font-black">{totalMark}</strong>
                {currentSumMarks === totalMark ? (
                  <span className="text-emerald-700 font-bold mr-1 flex items-center gap-0.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>متطابق</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSyncTotalWithSum}
                    title="مزامنة الدرجة الكلية للامتحان مع مجموع الأسئلة الحالي"
                    className="mr-1 text-[11px] bg-amber-200 hover:bg-amber-300 text-amber-900 px-2 py-0.5 rounded-md transition font-black"
                  >
                    مزامنة ({currentSumMarks})
                  </button>
                )}
              </div>
            </div>

            {/* The 2 Choices Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Option 1: Equal Distribution */}
              <button
                type="button"
                onClick={() => handleSelectGradingMode('equal')}
                className={`p-3 rounded-xl border text-right transition flex items-start gap-3 ${
                  gradingMode === 'equal'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  gradingMode === 'equal' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {gradingMode === 'equal' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-black block">1. تقسيم الدرجة الكلية بالتساوي</span>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    تقسيم الدرجة الكلية ({totalMark}) بالتساوي على {totalQuestionsInModel} سؤال = <strong>{equalMarkPerQ} درجة لكل سؤال</strong> تلقائياً.
                  </span>
                </div>
              </button>

              {/* Option 2: Custom per-question marks */}
              <button
                type="button"
                onClick={() => handleSelectGradingMode('custom')}
                className={`p-3 rounded-xl border text-right transition flex items-start gap-3 ${
                  gradingMode === 'custom'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                  gradingMode === 'custom' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {gradingMode === 'custom' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs font-black block">2. تخصيص يدوي لكل سؤال</span>
                  <span className="text-[11px] text-slate-500 block leading-relaxed">
                    تحديد درجة مخصصة لكل سؤال بشكل منفصل (مثلاً: سؤال بـ 3 درجات، سؤال بـ 5 درجات).
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Active Model Reordering Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black text-slate-700">
                ترتيب أسئلة نموذج ({['أ', 'ب', 'ج', 'د'][activeModel]}):
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 font-bold">إعادة ترتيب سريعة:</span>
              <button
                type="button"
                onClick={() => handleApplyOrderToCurrentModel('shuffle')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="خلط عشوائي لمنع الغش"
              >
                <Shuffle className="w-3 h-3 text-purple-600" />
                <span>عشوائي</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyOrderToCurrentModel('by_chapter')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="ترتيب تسلسلي حسب الفصول والدروس"
              >
                <BookOpen className="w-3 h-3 text-blue-600" />
                <span>حسب الفصول</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyOrderToCurrentModel('easy_to_hard')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="من الأسهل للأصعب"
              >
                <span>🟢 الأسهل أولاً</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyOrderToCurrentModel('hard_to_easy')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="من الأصعب للأسهل"
              >
                <span>🔴 الأصعب أولاً</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyOrderToCurrentModel('type_mcq_first')}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                title="الاختياري أولاً ثم المقالي"
              >
                <span>📝 اختياري ثم مقالي</span>
              </button>
            </div>
          </div>

          {/* Questions Review List */}
          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
            {generatedModels[activeModel]?.questions?.map((q: any, idx: number) => (
              <div key={q.id || idx} className="p-4 hover:bg-slate-50/50 transition space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="text-sm font-black text-blue-700 bg-blue-50 w-7 h-7 rounded-lg flex items-center justify-center shrink-0">{idx + 1}</span>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${q.question_type === 'mcq' ? 'bg-blue-100 text-blue-800' : q.question_type === 'essay' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'}`}>
                          {q.question_type === 'mcq' ? 'اختيار من متعدد' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                          {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                        </span>
                        {q.chapter && <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">{q.chapter}</span>}
                        {q.is_varied && (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 font-bold flex items-center gap-1">
                            🔢 أرقام مخصصة لـ {generatedModels[activeModel]?.model_name || 'هذا النموذج'}
                          </span>
                        )}

                        {/* Interactive Marks Allocator for this question */}
                        <div className="mr-auto flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">
                          <span className="text-[11px] font-bold text-slate-600">الدرجة:</span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={q.marks || 1}
                            onChange={(e) => handleUpdateQuestionMarks(q.id || idx, Number(e.target.value))}
                            className="w-12 text-center bg-white border border-slate-300 rounded-lg py-0.5 text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {/* Quick selection chips: 1, 2, 3, 5 */}
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 5].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => handleUpdateQuestionMarks(q.id || idx, m)}
                                className={`w-5 h-5 rounded-md text-[10px] font-black transition ${
                                  q.marks === m 
                                    ? 'bg-blue-600 text-white shadow-2xs' 
                                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <p className="text-sm font-bold text-slate-800 leading-relaxed pt-1">{q.text || q.question_text}</p>

                      {/* Question Image & Re-crop in Create Exam */}
                      {q.image_urls && q.image_urls.length > 0 ? (
                        <div className="my-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <img
                            src={q.image_urls[0]}
                            alt="صورة السؤال"
                            className="max-h-36 max-w-xs object-contain rounded-lg border border-slate-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecropQuestion(q);
                              setRecropModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                          >
                            <Crop className="w-3.5 h-3.5 text-blue-600" />
                            <span>🔄 إعادة قص / تعديل الصورة</span>
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRecropQuestion(q);
                              setRecropModalOpen(true);
                            }}
                            className="text-[11px] font-bold text-slate-400 hover:text-blue-600 flex items-center gap-1 transition"
                          >
                            <Crop className="w-3 h-3" />
                            <span>➕ قص / إضافة صورة لهذا السؤال</span>
                          </button>
                        </div>
                      )}

                      {q.choices?.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {[...q.choices].sort((a: any, b: any) => a.order_index - b.order_index).map((c: any, ci: number) => (
                            <div key={ci} className={`text-xs p-2 rounded-lg border flex items-center justify-between ${c.is_correct ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold' : 'bg-white text-slate-700 border-slate-200'}`}>
                              <span>({c.choice_code || ['أ', 'ب', 'ج', 'د'][ci]}) {c.text}</span>
                              {c.is_correct && <span className="text-emerald-700 text-xs">✓ صحيح</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Move Up / Down Buttons for custom question ordering */}
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        title="تحريك السؤال لأعلى"
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:pointer-events-none transition"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === (generatedModels[activeModel]?.questions?.length || 1) - 1}
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        title="تحريك السؤال لأسفل"
                        className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white rounded disabled:opacity-30 disabled:pointer-events-none transition"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button type="button" onClick={() => handleReplaceRandom(idx)} title="استبدال عشوائي" className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200">
                      <RefreshCw className="w-3.5 h-3.5" /><span className="hidden sm:inline">بديل عشوائي</span>
                    </button>
                    <button type="button" onClick={() => openReplacementModal(idx)} title="اختيار بديل من البنك" className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                      <Search className="w-3.5 h-3.5" /><span className="hidden sm:inline">اختيار بديل</span>
                    </button>
                    <button type="button" onClick={() => openEditQuestionModal(q, idx)} title="تعديل السؤال" className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => handleRemoveQuestion(idx)} title="حذف السؤال" className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-600 flex items-center gap-2">
              <span>النموذج الحالي ({['أ', 'ب', 'ج', 'د'][activeModel]}):</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-black">{totalQuestionsInModel} سؤال</span>
              <span>|</span>
              <span>إجمالي الدرجات:</span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-black">{currentSumMarks} درجة</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setStep(2); setGeneratedModels([]); }} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">إعادة التوليد</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black disabled:opacity-50 hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20 flex items-center gap-2">
                <Save className="w-4 h-4" /><span>{saving ? 'جاري الحفظ...' : '💾 حفظ الامتحان بالنماذج'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 1: Replacement from Bank */}
      {replacementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-slate-800 text-base">اختر سؤالاً بديلاً من بنك الأسئلة</h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                      {filteredReplacementQuestions.length} سؤال متاح
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    تصفح وابحث وفلتر الأسئلة البديلة بسهولة لاستبدال السؤال في النموذج الحالي
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setReplacementModalOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Question Banner (The question being replaced) */}
            {targetQuestionIndex !== null && generatedModels[activeModel]?.questions?.[targetQuestionIndex] && (() => {
              const currentQ = generatedModels[activeModel].questions[targetQuestionIndex];
              return (
                <div className="px-4 py-3 bg-amber-50/80 border-b border-amber-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <span>السؤال الحالي المستهدف:</span>
                      <strong className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded font-black">#{targetQuestionIndex + 1}</strong>
                    </span>
                    {currentQ.chapter && (
                      <span className="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-amber-800 font-bold">
                        📁 {currentQ.chapter}
                      </span>
                    )}
                    {(currentQ as any).lesson && (
                      <span className="px-2 py-0.5 bg-white border border-emerald-200 rounded-md text-emerald-800 font-bold">
                        🔖 {(currentQ as any).lesson}
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 font-bold">
                      {currentQ.question_type === 'mcq' ? 'اختيار من متعدد' : currentQ.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                    </span>
                    <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600 font-bold">
                      {currentQ.difficulty === 'easy' ? 'سهل' : currentQ.difficulty === 'hard' ? 'صعب' : 'متوسط'}
                    </span>
                  </div>
                  <p className="text-slate-600 font-semibold line-clamp-1 italic max-w-sm">
                    &quot;{currentQ.text}&quot;
                  </p>
                </div>
              );
            })()}

            {/* Filter Section (Search & Dropdowns Grid) */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
              {/* Search Bar & Reset button */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={replacementSearch}
                    onChange={e => setReplacementSearch(e.target.value)}
                    placeholder="ابحث في نص السؤال، اسم الفصل، أو الدرس..."
                    className="w-full pr-10 pl-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  {replacementSearch && (
                    <button
                      type="button"
                      onClick={() => setReplacementSearch('')}
                      className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {hasActiveReplacementFilters && (
                  <button
                    type="button"
                    onClick={resetReplacementFilters}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs"
                    title="إعادة ضبط جميع الفلاتر"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إعادة ضبط</span>
                  </button>
                )}
              </div>

              {/* 6 Filter Dropdowns */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 text-xs">
                {/* 1. الفصل */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-amber-600" />
                    <span>الفصل</span>
                  </label>
                  <select
                    value={replacementChapter}
                    onChange={e => {
                      setReplacementChapter(e.target.value);
                      setReplacementLesson('all');
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">الكل (جميع الفصول)</option>
                    {replacementAvailableChapters.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* 2. الدرس */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Bookmark className="w-3 h-3 text-emerald-600" />
                    <span>الدرس</span>
                  </label>
                  <select
                    value={replacementLesson}
                    onChange={e => setReplacementLesson(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">الكل (جميع الدروس)</option>
                    {replacementAvailableLessons.map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                {/* 3. نوع السؤال */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <HelpCircle className="w-3 h-3 text-blue-600" />
                    <span>نوع السؤال</span>
                  </label>
                  <select
                    value={replacementType}
                    onChange={e => setReplacementType(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">الكل (جميع الأنواع)</option>
                    <option value="mcq">اختيار من متعدد</option>
                    <option value="true_false">صح أو خطأ</option>
                    <option value="essay">مقالي</option>
                  </select>
                </div>

                {/* 4. الصعوبة */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-amber-500" />
                    <span>مستوى الصعوبة</span>
                  </label>
                  <select
                    value={replacementDiff}
                    onChange={e => setReplacementDiff(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">الكل (جميع المستويات)</option>
                    <option value="easy">سهل</option>
                    <option value="medium">متوسط</option>
                    <option value="hard">صعب</option>
                  </select>
                </div>

                {/* 5. المصدر */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-600" />
                    <span>المصدر</span>
                  </label>
                  <select
                    value={replacementSource}
                    onChange={e => setReplacementSource(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">الكل (جميع المصادر)</option>
                    {sources.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* 6. نطاق البحث */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <Filter className="w-3 h-3 text-cyan-600" />
                    <span>نطاق البحث</span>
                  </label>
                  <select
                    value={replacementScope}
                    onChange={e => setReplacementScope(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">كل بنك الأسئلة</option>
                    <option value="exam_topics">فصول الامتحان فقط</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {filteredReplacementQuestions.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-600">
                    لا توجد أسئلة تطابق معايير البحث والفلترة الحالية
                  </p>
                  <button
                    type="button"
                    onClick={resetReplacementFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                  >
                    إعادة ضبط الفلاتر وعرض جميع الأسئلة
                  </button>
                </div>
              ) : (
                filteredReplacementQuestions.map(q => {
                  const isUsedInCurrentExam = currentModelQuestionIds.has(q.id);
                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 transition flex flex-col sm:flex-row items-start justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                            {q.question_type === 'mcq' ? 'اختيار من متعدد' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold border ${
                            q.difficulty === 'hard'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : q.difficulty === 'easy'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {q.difficulty === 'hard' ? 'صعب' : q.difficulty === 'easy' ? 'سهل' : 'متوسط'}
                          </span>
                          {q.chapter && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              📁 {q.chapter}
                            </span>
                          )}
                          {(q as any).lesson && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                              🔖 {(q as any).lesson}
                            </span>
                          )}
                          {q.source_id && sourcesMap[q.source_id] && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                              📖 {sourcesMap[q.source_id]}
                            </span>
                          )}
                          {q.image_urls && q.image_urls.length > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              🖼️ صورة
                            </span>
                          )}
                          {isUsedInCurrentExam && (
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 border border-orange-200 font-bold">
                              ⚠️ موجود بالامتحان
                            </span>
                          )}
                        </div>

                        <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                          {q.text}
                        </p>

                        {/* Display choices if available */}
                        {q.choices && q.choices.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                            {q.choices
                              .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                              .map((c, cIdx) => (
                                <div
                                  key={c.id || cIdx}
                                  className={`text-[11px] p-2 rounded-lg border flex items-center justify-between ${
                                    c.is_correct
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                                      : 'bg-white text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span>({c.choice_code || ['أ', 'ب', 'ج', 'د'][cIdx]}) {c.text}</span>
                                  {c.is_correct && <span className="text-emerald-700 font-black">✓ صحيح</span>}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectReplacementQuestion(q)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 shadow-sm mt-2 sm:mt-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>استبدال بهذا السؤال</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Edit Question */}
      {editingQuestionModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <span className="text-base font-black text-slate-800">تعديل نص السؤال والدرجة</span>
              <button onClick={() => setEditingQuestionModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نص السؤال</label>
              <textarea value={editingQuestion.text} onChange={e => setEditingQuestion({ ...editingQuestion, text: e.target.value })} rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مستوى الصعوبة</label>
                <select value={editingQuestion.difficulty} onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none">
                  <option value="easy">سهل (Easy)</option>
                  <option value="medium">متوسط (Medium)</option>
                  <option value="hard">صعب (Hard)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدرجة المخصصة للسؤال</label>
                <input type="number" value={editingQuestion.marks || 2} onChange={e => setEditingQuestion({ ...editingQuestion, marks: Number(e.target.value) })} className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none" min={1} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditingQuestionModalOpen(false)} className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50">إلغاء</button>
              <button type="button" onClick={handleSaveEditedQuestion} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">تطبيق التعديل</button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Re-crop Modal during exam creation */}
      <RecropModal
        isOpen={recropModalOpen}
        question={selectedRecropQuestion}
        onClose={() => {
          setRecropModalOpen(false);
          setSelectedRecropQuestion(null);
        }}
        onImageUpdated={handleImageUpdated}
        onImageRemoved={handleImageRemoved}
      />
    </div>
  );
}
