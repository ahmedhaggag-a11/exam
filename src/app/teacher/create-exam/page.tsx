'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateExamAction } from './actions';
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
} from 'lucide-react';

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
  choices?: Array<{ id: string; choice_code: string; text: string; is_correct: boolean; order_index: number }>;
}

const STEPS = ['بيانات ومصادر الامتحان', 'الفصول والأعداد والصعوبة', 'نماذج وخيارات الترتيب', 'توليد الامتحان', 'مراجعة وتعديل وحفظ'];

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
  const [topicSearch, setTopicSearch] = useState('');

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

  // ── Step 1 — Chapters, Types, Difficulty
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
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
  const [shuffleNumbers, setShuffleNumbers] = useState(true);
  const [template] = useState('classic');

  // ── Step 4 — Grading Mode (تخصيص الدرجات)
  const [gradingMode, setGradingMode] = useState<'equal' | 'custom'>('equal');

  // ── Modals
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [targetQuestionIndex, setTargetQuestionIndex] = useState<number | null>(null);
  const [replacementSearch, setReplacementSearch] = useState('');
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

  // Filter out raw chunk labels (e.g. "الجزء 58 (ص 172 - 174)") — keep only real chapter names
  const isChunkLabel = (s: string) => /^الجزء\s*\d+/.test(s.trim()) || /^\d+$/.test(s.trim());
  const availableTopics = Array.from(
    new Set(
      sourceFilteredQuestions
        .map(q => q.chapter || q.topic)
        .filter((t): t is string => !!t && !isChunkLabel(t))
    )
  ).sort((a, b) => a.localeCompare(b, 'ar'));

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
        shuffleNumbers
      );

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
    setReplacementModalOpen(true);
  }

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

  function openEditQuestionModal(q: Question, idx: number) {
    setEditingQuestion({ ...q });
    setEditingIndex(idx);
    setEditingQuestionModalOpen(true);
  }

  function handleSaveEditedQuestion() {
    if (editingIndex === null || !editingQuestion) return;
    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;
    const updated = [...generatedModels];
    const qs = [...currentModel.questions];
    qs[editingIndex] = { ...editingQuestion };
    updated[activeModel] = { ...currentModel, questions: qs };
    setGeneratedModels(updated);
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
      const baseModel = generatedModels[0];
      if (baseModel?.questions?.length) {
        const qRows = baseModel.questions.map((q: any, idx: number) => ({ exam_id: exam.id, question_id: q.id, order_index: idx }));
        await supabase.from('exam_questions').insert(qRows);
      }
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
  const canStep1 = totalRequested > 0 && pool.length > 0;

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

      {/* ── Step 1: Chapters + Question Types + Difficulty */}
      {step === 1 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <Layers className="w-5 h-5 text-blue-600" /><span>تحديد الفصول والأعداد ومستويات الصعوبة</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">إجمالي المتاح: {pool.length} سؤال</span>
          </div>

          {pool.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" /><span>⚠️ لا توجد أسئلة لهذا المصدر أو المادة. يرجى اختيار مصدر آخر أو رفع أسئلة.</span>
            </div>
          ) : availableTopics.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">اختر الفصول / الأبواب:</p>
                <div className="flex items-center gap-2">
                  {selectedTopics.length > 0 && (
                    <button onClick={() => setSelectedTopics([])} className="text-[11px] text-red-500 hover:text-red-700 font-semibold transition">
                      إلغاء الكل ✕
                    </button>
                  )}
                  <button onClick={() => setSelectedTopics([...availableTopics])} className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold transition">
                    تحديد الكل
                  </button>
                </div>
              </div>

              {/* Search */}
              {availableTopics.length > 6 && (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={topicSearch}
                    onChange={e => setTopicSearch(e.target.value)}
                    placeholder="ابحث عن فصل أو باب..."
                    className="w-full pr-9 pl-3 py-2 text-xs font-medium border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                {availableTopics
                  .filter(t => !topicSearch || t.includes(topicSearch))
                  .map(topic => (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topic)}
                      title={topic}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition max-w-[260px] truncate ${
                        selectedTopics.includes(topic)
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-400/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                      }`}
                    >
                      {selectedTopics.includes(topic) && <span className="mr-1">✓</span>}
                      {topic}
                    </button>
                  ))}
              </div>

              <p className="text-[11px] text-slate-400">
                {selectedTopics.length === 0
                  ? '📚 سيتم السحب من جميع الفصول'
                  : `✅ تم اختيار ${selectedTopics.length} فصل — ${pool.length} سؤال متاح`}
              </p>
            </div>
          ) : null}

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

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(0)} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">→ السابق</button>
            <button disabled={!canStep1} onClick={() => setStep(2)} className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition shadow-md shadow-blue-600/20">التالي (إعدادات النماذج) ←</button>
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

            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shuffleNumbers} onChange={e => setShuffleNumbers(e.target.checked)} className="w-4 h-4 accent-blue-600 rounded" />
              <span className="text-xs font-bold text-slate-700">اختلاف أرقام الأسئلة (ترقيم مختلف في كل نموذج)</span>
            </label>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button onClick={() => setStep(1)} className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition">→ السابق</button>
            <button onClick={() => { setStep(3); handleGenerate(); }} className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition shadow-md shadow-blue-600/30 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>توليد الامتحان ⚡</span>
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
              <div className="flex gap-1.5">
                {generatedModels.map((_, i) => (
                  <button key={i} onClick={() => setActiveModel(i)} className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${activeModel === i ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    نموذج {['أ', 'ب', 'ج', 'د'][i]}
                  </button>
                ))}
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                <Search className="w-5 h-5 text-blue-600" /><span>اختر سؤالاً بديلاً من بنك الأسئلة</span>
              </div>
              <button onClick={() => setReplacementModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input type="text" value={replacementSearch} onChange={e => setReplacementSearch(e.target.value)} placeholder="ابحث في نص السؤال، الفصل، أو مستوى الصعوبة..." className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {pool.filter(q => {
                if (!replacementSearch.trim()) return true;
                const term = replacementSearch.toLowerCase();
                return q.text?.toLowerCase().includes(term) || q.chapter?.toLowerCase().includes(term);
              }).map(q => (
                <div key={q.id} className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">{q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">{q.difficulty}</span>
                      {q.chapter && <span className="text-[10px] text-slate-500 font-semibold">{q.chapter}</span>}
                    </div>
                    <p className="text-xs font-bold text-slate-800">{q.text}</p>
                  </div>
                  <button type="button" onClick={() => handleSelectReplacementQuestion(q)} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0">استبدال بهذا السؤال</button>
                </div>
              ))}
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
    </div>
  );
}
