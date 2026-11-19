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
  Plus, 
  Check, 
  X, 
  BookOpen, 
  Layers, 
  Sparkles, 
  Sliders, 
  Shuffle, 
  QrCode, 
  Save, 
  FileCheck, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface Subject { id: string; name: string; }

interface SourceItem {
  id: string;
  name: string;
}

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

const STEPS = ['بيانات ومصادر الامتحان', 'الفصول والصعوبة والأعداد', 'نماذج وخيارات الترتيب', 'توليد الامتحان', 'مراجعة وتعديل وحفظ'];

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
  const [aiReasoning, setAiReasoning] = useState('');

  // Step 0 - Exam Header & Sources
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all');
  const [grade, setGrade] = useState('');
  const [duration, setDuration] = useState('60');
  const [examDate, setExamDate] = useState('');
  const [instructions, setInstructions] = useState('أجب عن جميع الأسئلة');
  const [totalMark, setTotalMark] = useState(100);

  // Smart QR Code options
  const [enableQrCode, setEnableQrCode] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrTitle, setQrTitle] = useState('امسح الكود لمشاهدة فيديو شرح وحل الامتحان');

  // Step 1 - Chapters, Difficulties, and Counts
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [mcqCount, setMcqCount] = useState(5);
  const [essayCount, setEssayCount] = useState(1);
  const [tfCount, setTfCount] = useState(0);

  // Difficulty counts (Easy, Medium, Hard)
  const [enableDifficultySplit, setEnableDifficultySplit] = useState(false);
  const [easyCount, setEasyCount] = useState(2);
  const [mediumCount, setMediumCount] = useState(3);
  const [hardCount, setHardCount] = useState(1);

  // Step 2 - Models & Options
  const [modelsCount, setModelsCount] = useState(2);
  const [modelsMode, setModelsMode] = useState<'same_questions_shuffled' | 'different_questions'>('same_questions_shuffled');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);
  const [template, setTemplate] = useState('classic');

  // Step 4 - Modal / Editing / Replacement State
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

    // Load Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('subjects, grades')
      .eq('id', user.id)
      .single();

    if (profile?.subjects && profile.subjects.length > 0) {
      setSubjects(profile.subjects.map((name: string) => ({ id: name, name })));
      setSubjectId((prev) => prev || profile.subjects[0]);
    }
    if (profile?.grades && profile.grades.length > 0) {
      setGrade((prev) => prev || profile.grades[0]);
    }

    // Load Sources
    const { data: sourcesData } = await supabase
      .from('sources')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (sourcesData) {
      setSources(sourcesData);
    }
  }

  async function loadQuestions(subject?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from('questions')
      .select('*, choices:question_choices(*)')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (subject && subject.trim() !== '') {
      query = query.eq('subject', subject);
    }

    const { data, error } = await query;
    if (error) console.error('loadQuestions error:', error);

    // Fallback: If no questions for this exact subject filter, fetch all teacher questions
    if ((!data || data.length === 0) && subject) {
      const { data: allTeacherQs } = await supabase
        .from('questions')
        .select('*, choices:question_choices(*)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });
      setQuestions(allTeacherQs || []);
    } else {
      setQuestions(data || []);
    }
  }

  // Filter questions by source if specified
  const sourceFilteredQuestions = selectedSourceId !== 'all'
    ? questions.filter(q => q.source_id === selectedSourceId)
    : questions;

  const availableTopics = Array.from(
    new Set(sourceFilteredQuestions.map(q => q.chapter || q.topic).filter(Boolean) as string[])
  );

  function toggleTopic(topic: string) {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  }

  // Final question pool for generator
  const pool = selectedTopics.length > 0
    ? sourceFilteredQuestions.filter(q => selectedTopics.includes(q.chapter || q.topic || ''))
    : sourceFilteredQuestions;

  // Breakdown metrics
  const mcqAvailable = pool.filter(q => q.question_type === 'mcq').length;
  const essayAvailable = pool.filter(q => q.question_type === 'essay').length;
  const tfAvailable = pool.filter(q => q.question_type === 'true_false').length;

  const easyAvailable = pool.filter(q => q.difficulty === 'easy').length;
  const medAvailable = pool.filter(q => q.difficulty === 'medium').length;
  const hardAvailable = pool.filter(q => q.difficulty === 'hard').length;

  const totalRequested = enableDifficultySplit 
    ? easyCount + mediumCount + hardCount 
    : mcqCount + essayCount + tfCount;

  // Auto-sync counts if difficulty split is toggled
  useEffect(() => {
    if (enableDifficultySplit) {
      const totalDiff = easyCount + mediumCount + hardCount;
      if (totalDiff > 0) {
        setMcqCount(totalDiff);
        setEssayCount(0);
        setTfCount(0);
      }
    }
  }, [enableDifficultySplit, easyCount, mediumCount, hardCount]);

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    setAiReasoning('');
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
        difficulty_counts: enableDifficultySplit ? { easy: easyCount, medium: mediumCount, hard: hardCount } : undefined,
        grade,
        duration: parseInt(duration),
        instructions,
      });

      if (!result.selected_question_ids.length) {
        setError('لم يتم العثور على أسئلة كافية في البنك للشروط المحددة. يرجى تقليل العدد أو اختيار فصول أكثر.');
        setGenerating(false);
        return;
      }

      setAiReasoning(result.reasoning);

      // Map IDs back to full question objects
      const selectedQs = result.selected_question_ids
        .map(id => pool.find(q => q.id === id))
        .filter(Boolean) as Question[];

      // Generate models with Fisher-Yates shuffle
      const models = generateExamModels(
        selectedQs as any, 
        modelsCount, 
        modelsMode === 'same_questions_shuffled' ? shuffleQuestions : false, 
        shuffleChoices
      );
      setGeneratedModels(models);
      setStep(4);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء توليد الامتحان');
    }
    setGenerating(false);
  }

  // Question Replacement Logic: Random
  function handleReplaceRandom(questionIndex: number) {
    const currentModel = generatedModels[activeModel];
    if (!currentModel || !currentModel.questions) return;

    const currentQ = currentModel.questions[questionIndex];
    const currentlyUsedIds = new Set(currentModel.questions.map((q: any) => q.id));

    // Look for alternative question in pool with same chapter/type/difficulty, not currently used
    const candidates = pool.filter(q => 
      !currentlyUsedIds.has(q.id) &&
      (q.question_type === currentQ.question_type || !currentQ.question_type)
    );

    const matchCandidate = candidates.find(q => q.chapter === currentQ.chapter && q.difficulty === currentQ.difficulty) ||
                           candidates.find(q => q.chapter === currentQ.chapter) ||
                           candidates[0];

    if (!matchCandidate) {
      alert('لا توجد أسئلة بديلة إضافية في بنك الأسئلة الحالي غير مستخدمة.');
      return;
    }

    // Apply replacement to current active model or all models
    const updatedModels = [...generatedModels];
    const updatedQs = [...currentModel.questions];
    updatedQs[questionIndex] = { ...matchCandidate };
    updatedModels[activeModel] = { ...currentModel, questions: updatedQs };
    setGeneratedModels(updatedModels);
  }

  // Question Replacement Logic: Choose from Bank Modal
  function openReplacementModal(questionIndex: number) {
    setTargetQuestionIndex(questionIndex);
    setReplacementSearch('');
    setReplacementModalOpen(true);
  }

  function handleSelectReplacementQuestion(chosenQuestion: Question) {
    if (targetQuestionIndex === null) return;

    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;

    const updatedModels = [...generatedModels];
    const updatedQs = [...currentModel.questions];
    updatedQs[targetQuestionIndex] = { ...chosenQuestion };
    updatedModels[activeModel] = { ...currentModel, questions: updatedQs };
    setGeneratedModels(updatedModels);

    setReplacementModalOpen(false);
    setTargetQuestionIndex(null);
  }

  // Remove Question from active model
  function handleRemoveQuestion(questionIndex: number) {
    if (!confirm('هل أنت متأكد من حذف هذا السؤال من النموذج الحالي؟')) return;
    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;

    const updatedModels = [...generatedModels];
    const updatedQs = currentModel.questions.filter((_: any, idx: number) => idx !== questionIndex);
    updatedModels[activeModel] = { ...currentModel, questions: updatedQs };
    setGeneratedModels(updatedModels);
  }

  // Open Direct Edit Modal for text or marks
  function openEditQuestionModal(q: Question, idx: number) {
    setEditingQuestion({ ...q });
    setEditingIndex(idx);
    setEditingQuestionModalOpen(true);
  }

  function handleSaveEditedQuestion() {
    if (editingIndex === null || !editingQuestion) return;
    const currentModel = generatedModels[activeModel];
    if (!currentModel) return;

    const updatedModels = [...generatedModels];
    const updatedQs = [...currentModel.questions];
    updatedQs[editingIndex] = { ...editingQuestion };
    updatedModels[activeModel] = { ...currentModel, questions: updatedQs };
    setGeneratedModels(updatedModels);

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

      // Insert exam with correct column names matching the schema
      const { data: exam, error: examError } = await supabase.from('exams').insert({
        teacher_id: user.id,
        subject: subjectId,
        title,
        grade_level: grade,
        duration_minutes: parseInt(duration),
        exam_date: examDate || null,
        instructions,
        total_marks: totalMark,
        total_questions: totalQuestions,
        models_count: modelsCount,
        template_name: template,
        status: 'draft',
      }).select().single();

      if (examError) throw new Error(`خطأ في حفظ الامتحان: ${examError.message}`);

      // Save exam questions (base model = model A)
      const baseModel = generatedModels[0];
      if (baseModel?.questions?.length) {
        const qRows = baseModel.questions.map((q: any, idx: number) => ({
          exam_id: exam.id,
          question_id: q.id,
          order_index: idx,
        }));
        const { error: qErr } = await supabase.from('exam_questions').insert(qRows);
        if (qErr) console.error('exam_questions insert error:', qErr);
      }

      // Save each model (A, B, C, D) with distinct question & choice orders
      for (let i = 0; i < generatedModels.length; i++) {
        const model = generatedModels[i];
        const { error: mErr } = await supabase.from('exam_models').insert({
          exam_id: exam.id,
          model_code: ['A', 'B', 'C', 'D'][i] || `M${i + 1}`,
          model_name: ['أ', 'ب', 'ج', 'د'][i] || `نموذج ${i + 1}`,
          questions_order: model.questions.map((q: any) => q.id),
          choices_order: model.choices_order || {},
        });
        if (mErr) console.error('exam_models insert error:', mErr);
      }

      // If QR code is enabled, save exam custom template config to Supabase Storage
      if (enableQrCode && qrUrl.trim()) {
        try {
          const { getPaperTemplateConfig, savePaperTemplateConfig } = await import('@/app/admin/paper-templates/actions');
          const currentCfg = await getPaperTemplateConfig(user.id);
          const updatedCfg = {
            ...currentCfg,
            qrCode: {
              enabled: true,
              url: qrUrl.trim(),
              title: qrTitle.trim() || 'امسح الكود لمشاهدة فيديو شرح وحل الامتحان',
            },
          };
          // Save exam-specific template
          await savePaperTemplateConfig(updatedCfg, `exam_${exam.id}`);
        } catch (qrErr) {
          console.warn('Could not save exam QR template:', qrErr);
        }
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
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">إنشاء وتوليد امتحان جديد 📝⚡</h1>
          <p className="text-xs text-slate-500 mt-1">
            اختر المصادر، حدد نسب الصعوبة، ثم راجع واستبدل أي سؤال قبل الاعتماد النهائي.
          </p>
        </div>
      </div>

      {/* Stepper Header */}
      <div className="flex items-center bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center shrink-0">
            <div className={`flex items-center justify-center w-7 h-7 rounded-xl text-xs font-bold transition ${
              i < step ? 'bg-emerald-500 text-white' :
              i === step ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mx-2 text-xs font-bold ${i === step ? 'text-blue-700 font-black' : 'text-slate-500'}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className={`w-4 h-0.5 ml-2 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Step 0: Exam Header & Sources ─── */}
      {step === 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-base">
            <Sliders className="w-5 h-5 text-blue-600" />
            <span>بيانات الامتحان والمصدر المستهدف</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">عنوان الامتحان *</label>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="امتحان شامل على الفصلين الأول والثاني" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المادة الدراسية *</label>
              <select 
                value={subjectId} 
                onChange={e => setSubjectId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
              >
                <option value="">اختر المادة</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* Source Selection (المصدر المستهدف) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>مصدر الأسئلة (الكتاب / الملزمة)</span>
              </label>
              <select
                value={selectedSourceId}
                onChange={e => setSelectedSourceId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none bg-indigo-50/40"
              >
                <option value="all">جميع الكتب والمصادر المرفوعة (الشامل)</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>
                    📖 {s.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                يمكنك حصر الامتحان في أسئلة كتاب أو مذكرة معينة قمت برفعها مسبقاً.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الصف الدراسي *</label>
              <input 
                value={grade} 
                onChange={e => setGrade(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="الصف الثالث الثانوي" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">المدة الزمنية (بالدقائق)</label>
              <input 
                type="number" 
                value={duration} 
                onChange={e => setDuration(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
                min={15} 
                max={240} 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">الدرجة الكلية للامتحان</label>
              <input 
                type="number" 
                value={totalMark} 
                onChange={e => setTotalMark(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none" 
                min={5} 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">تعليمات الامتحان للطلاب</label>
            <textarea 
              value={instructions} 
              onChange={e => setInstructions(e.target.value)} 
              rows={2}
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
            />
          </div>

          {/* Smart QR Code (Optional) */}
          <div className="border border-slate-200 bg-slate-50 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-blue-600" />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">إضافة كود QR ذكي على الورقة (اختياري)</span>
                  <span className="text-[11px] text-slate-500">
                    كود QR بأسفل الورقة ينقل الطالب مباشرة لفيديو الحل أو التقرير.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableQrCode}
                onChange={e => setEnableQrCode(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            {enableQrCode && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رابط الفيديو أو الحل (URL) *</label>
                  <input
                    type="url"
                    value={qrUrl}
                    onChange={e => setQrUrl(e.target.value)}
                    placeholder="https://youtu.be/... أو رابط الحل"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">النص التوضيحي بجوار الكود</label>
                  <input
                    type="text"
                    value={qrTitle}
                    onChange={e => setQrTitle(e.target.value)}
                    placeholder="امسح الباركود لفيديو الشرح ونموذج الإجابة"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button 
              disabled={!canStep0} 
              onClick={() => setStep(1)}
              className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition shadow-md shadow-blue-600/20"
            >
              التالي (الفصول والصعوبة) ←
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 1: Chapters, Difficulty Split, and Counts ─── */}
      {step === 1 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>تحديد الفصول ومستويات الصعوبة والأعداد</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              إجمالي المتاح: {pool.length} سؤال
            </span>
          </div>

          {pool.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>⚠️ لا توجد أسئلة مسجلة لهذا المصدر أو المادة. يرجى اختيار مصدر آخر أو رفع أسئلة.</span>
            </div>
          ) : availableTopics.length > 0 ? (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">اختر الفصول / الأبواب (اتركها فارغة لاختيار الكل):</p>
              <div className="flex flex-wrap gap-2">
                {availableTopics.map(topic => (
                  <button 
                    key={topic} 
                    onClick={() => toggleTopic(topic)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                      selectedTopics.includes(topic)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {selectedTopics.length === 0 ? 'سيتم السحب من جميع الفصول' : `تم اختيار ${selectedTopics.length} فصول`}
              </p>
            </div>
          ) : null}

          {/* Difficulty Split Option (تحديد نسب الصعوبة) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black text-slate-800 block">🎯 تحديد أعداد الأسئلة حسب مستوى الصعوبة (سهل / متوسط / صعب)</span>
                <span className="text-[11px] text-slate-500">
                  قم بضبط دقيق لعدد الأسئلة السهلة والمتوسطة والصعبة لضمان توازن الامتحان.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableDifficultySplit}
                onChange={e => setEnableDifficultySplit(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            {enableDifficultySplit && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div className="bg-white p-3 rounded-xl border border-emerald-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-emerald-800">أسئلة سهلة (Easy)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">متاح: {easyAvailable}</span>
                  </div>
                  <input
                    type="number"
                    value={easyCount}
                    onChange={e => setEasyCount(Math.max(0, Number(e.target.value)))}
                    min={0}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-emerald-700 outline-none"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-blue-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-blue-800">أسئلة متوسطة (Medium)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">متاح: {medAvailable}</span>
                  </div>
                  <input
                    type="number"
                    value={mediumCount}
                    onChange={e => setMediumCount(Math.max(0, Number(e.target.value)))}
                    min={0}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-blue-700 outline-none"
                  />
                </div>

                <div className="bg-white p-3 rounded-xl border border-red-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-red-800">أسئلة صعبة / عليا (Hard)</span>
                    <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">متاح: {hardAvailable}</span>
                  </div>
                  <input
                    type="number"
                    value={hardCount}
                    onChange={e => setHardCount(Math.max(0, Number(e.target.value)))}
                    min={0}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-bold text-red-700 outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Question Types Count */}
          {!enableDifficultySplit && (
            <div>
              <p className="text-xs font-bold text-slate-700 mb-2">توزيع أنواع الأسئلة:</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-blue-900">اختيار من متعدد (MCQ)</span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">متاح: {mcqAvailable}</span>
                  </div>
                  <input 
                    type="number" 
                    value={mcqCount} 
                    onChange={e => setMcqCount(Math.max(0, Number(e.target.value)))} 
                    min={0}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" 
                  />
                </div>

                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-emerald-900">أسئلة مقالية (Essay)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">متاح: {essayAvailable}</span>
                  </div>
                  <input 
                    type="number" 
                    value={essayCount} 
                    onChange={e => setEssayCount(Math.max(0, Number(e.target.value)))} 
                    min={0}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" 
                  />
                </div>

                <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-purple-900">صح أو خطأ (True/False)</span>
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">متاح: {tfAvailable}</span>
                  </div>
                  <input 
                    type="number" 
                    value={tfCount} 
                    onChange={e => setTfCount(Math.max(0, Number(e.target.value)))} 
                    min={0}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none" 
                  />
                </div>
              </div>
            </div>
          )}

          {/* Summary Box */}
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
              <span className="text-blue-700">متوسط: <strong>{medAvailable}</strong></span>
              <span className="text-red-700">صعب: <strong>{hardAvailable}</strong></span>
            </div>
            {pool.length < totalRequested && (
              <div className="text-amber-800 bg-amber-100/70 p-2 rounded-lg font-bold">
                ⚠️ عدد الأسئلة المطلوبة ({totalRequested}) أكبر من المتاح ({pool.length}). سيقوم الذكاء الاصطناعي باختيار المتاح بالكامل.
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button 
              onClick={() => setStep(0)} 
              className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
            >
              → السابق
            </button>
            <button 
              disabled={!canStep1} 
              onClick={() => setStep(2)}
              className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-blue-700 transition shadow-md shadow-blue-600/20"
            >
              التالي (إعدادات النماذج) ←
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Models & Options ─── */}
      {step === 2 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 font-bold text-slate-800 text-base">
            <Shuffle className="w-5 h-5 text-blue-600" />
            <span>إعدادات النماذج وترتيب الأسئلة والخيارات</span>
          </div>

          {/* Model Mode Option */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-xs font-black text-slate-800">طريقة إنشاء النماذج (أ، ب، ج، د):</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModelsMode('same_questions_shuffled')}
                className={`p-3.5 rounded-xl border text-right transition ${
                  modelsMode === 'same_questions_shuffled'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs text-blue-800 mb-1">
                  <Check className="w-4 h-4 text-blue-600" />
                  <span>نفس الأسئلة بأرقام وترتيب مختلف (موصى به لمنع الغش) 🎯</span>
                </div>
                <p className="text-[11px] text-slate-500 pr-6 leading-relaxed">
                  يحتوي كل نموذج على نفس أسئلة الامتحان بالضبط لضمان تكافؤ الفرص، ولكن بأرقام وترتيب مبعثر في كل نموذج.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModelsMode('different_questions')}
                className={`p-3.5 rounded-xl border text-right transition ${
                  modelsMode === 'different_questions'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-xs text-slate-800 mb-1">
                  <span>نماذج بأسئلة مستقلة تماماً</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  يقوم الذكاء الاصطناعي بتوليد أسئلة مختلفة ومستقلة لكل نموذج من البنك.
                </p>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">عدد نماذج الامتحان المطلوب توليدها:</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <button 
                  key={n} 
                  onClick={() => setModelsCount(n)}
                  className={`w-12 h-12 rounded-2xl text-base font-black border-2 transition ${
                    modelsCount === n 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30 ring-2 ring-blue-400' 
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {['أ', 'ب', 'ج', 'د'][n - 1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">سيتم توليد {modelsCount} نماذج جاهزة للطباعة والتصحيح.</p>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={shuffleQuestions} 
                onChange={e => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded" 
              />
              <span className="text-xs font-bold text-slate-700">بعثرة وخلط ترتيب أرقام الأسئلة في النماذج (س1 يصبح س4 في نموذج ب)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={shuffleChoices} 
                onChange={e => setShuffleChoices(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded" 
              />
              <span className="text-xs font-bold text-slate-700">بعثرة ترتيب خيارات الاختيار من متعدد (أ / ب / ج / د) لكل سؤال</span>
            </label>
          </div>

          <div className="flex justify-between pt-3 border-t border-slate-100">
            <button 
              onClick={() => setStep(1)} 
              className="px-5 py-2.5 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
            >
              → السابق
            </button>
            <button 
              onClick={() => { setStep(3); handleGenerate(); }}
              className="px-7 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black hover:bg-blue-700 transition shadow-md shadow-blue-600/30 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>توليد الامتحان بالذكاء الاصطناعي ✨</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Generating Animation ─── */}
      {step === 3 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center space-y-4">
          {generating ? (
            <>
              <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <h3 className="text-lg font-black text-slate-800">جاري معالجة وتوليد الامتحان ونماذجه...</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                يقوم محرك الذكاء الاصطناعي باختيار أنسب {totalRequested} سؤال، وتوزيعها على {modelsCount} نماذج بأرقام وترتيبات متباعدة.
              </p>
            </>
          ) : error ? (
            <div className="text-red-600 space-y-3">
              <p className="text-base font-black">❌ تعذر إتمام التوليد</p>
              <p className="text-xs text-slate-500">{error}</p>
              <button 
                onClick={() => setStep(2)} 
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
              >
                رجوع وتعديل الخيارات
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── Step 4: Review, Replace, Edit, and Save ─── */}
      {step === 4 && generatedModels.length > 0 && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-5">
          {aiReasoning && (
            <div className="p-3.5 bg-blue-50 border border-blue-200/80 rounded-2xl text-blue-900 text-xs font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{aiReasoning}</span>
            </div>
          )}

          {/* Models Bar and Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-800">مراجعة الامتحان قبل الحفظ</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكنك مراجعة كل نموذج، وتعديل أي سؤال، أو استبداله بسؤال آخر من البنك.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">معاينة النموذج:</span>
              <div className="flex gap-1.5">
                {generatedModels.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setActiveModel(i)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                      activeModel === i 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    نموذج {['أ', 'ب', 'ج', 'د'][i]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Questions Review List with Replace & Edit Buttons */}
          <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
            {generatedModels[activeModel]?.questions?.map((q: any, idx: number) => (
              <div key={q.id || idx} className="p-4 hover:bg-slate-50/50 transition space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <span className="text-sm font-black text-blue-700 bg-blue-50 w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          q.question_type === 'mcq' ? 'bg-blue-100 text-blue-800' :
                          q.question_type === 'essay' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-purple-100 text-purple-800'
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
                      </div>

                      <p className="text-sm font-bold text-slate-800 leading-relaxed pt-1">
                        {q.text || q.question_text}
                      </p>

                      {/* Display Choices */}
                      {q.choices && q.choices.length > 0 && (
                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {[...q.choices]
                            .sort((a: any, b: any) => a.order_index - b.order_index)
                            .map((c: any, ci: number) => (
                              <div 
                                key={ci} 
                                className={`text-xs p-2 rounded-lg border flex items-center justify-between ${
                                  c.is_correct 
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold' 
                                    : 'bg-white text-slate-700 border-slate-200'
                                }`}
                              >
                                <span>({c.choice_code || ['أ', 'ب', 'ج', 'د'][ci]}) {c.text}</span>
                                {c.is_correct && <span className="text-emerald-700 text-xs">✓ صحيح</span>}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for this question: Replace & Edit */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Random replacement */}
                    <button
                      type="button"
                      onClick={() => handleReplaceRandom(idx)}
                      title="استبدال عشوائي بسؤال بديل من البنك"
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">بديل عشوائي</span>
                    </button>

                    {/* Choose from Bank */}
                    <button
                      type="button"
                      onClick={() => openReplacementModal(idx)}
                      title="اختيار سؤال بديل بنفسك من البنك"
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">اختيار بديل</span>
                    </button>

                    {/* Edit text or marks */}
                    <button
                      type="button"
                      onClick={() => openEditQuestionModal(q, idx)}
                      title="تعديل نص السؤال أو خياراته"
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="حذف هذا السؤال"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="text-xs font-bold text-slate-500">
              النموذج الحالي ({['أ', 'ب', 'ج', 'د'][activeModel]}): يحتوي على {generatedModels[activeModel]?.questions?.length || 0} سؤال | {totalMark} درجة
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setStep(2); setGeneratedModels([]); }}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
              >
                إعادة التوليد
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-black disabled:opacity-50 hover:bg-emerald-700 transition shadow-md shadow-emerald-600/20 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ والاعتماد...' : '💾 حفظ الامتحان بالنماذج'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: Choose Replacement Question from Bank ─── */}
      {replacementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-slate-800 text-base">
                <Search className="w-5 h-5 text-blue-600" />
                <span>اختر سؤالاً بديلاً من بنك الأسئلة</span>
              </div>
              <button 
                onClick={() => setReplacementModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search filter in modal */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                value={replacementSearch}
                onChange={e => setReplacementSearch(e.target.value)}
                placeholder="ابحث في نص السؤال، الفصل، أو مستوى الصعوبة..."
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Questions list */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {pool
                .filter(q => {
                  if (!replacementSearch.trim()) return true;
                  const term = replacementSearch.toLowerCase();
                  return q.text?.toLowerCase().includes(term) || q.chapter?.toLowerCase().includes(term);
                })
                .map((q) => (
                  <div 
                    key={q.id}
                    className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                          {q.question_type === 'mcq' ? 'MCQ' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                          {q.difficulty}
                        </span>
                        {q.chapter && (
                          <span className="text-[10px] text-slate-500 font-semibold">
                            {q.chapter}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800">{q.text}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectReplacementQuestion(q)}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs shrink-0"
                    >
                      استبدال بهذا السؤال
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 2: Edit Question Directly ─── */}
      {editingQuestionModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <span className="text-base font-black text-slate-800">تعديل نص السؤال والدرجة</span>
              <button 
                onClick={() => setEditingQuestionModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نص السؤال</label>
              <textarea
                value={editingQuestion.text}
                onChange={e => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مستوى الصعوبة</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="easy">سهل (Easy)</option>
                  <option value="medium">متوسط (Medium)</option>
                  <option value="hard">صعب (Hard)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الدرجة المخصصة للسؤال</label>
                <input
                  type="number"
                  value={editingQuestion.marks || 2}
                  onChange={e => setEditingQuestion({ ...editingQuestion, marks: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold outline-none"
                  min={1}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingQuestionModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEditedQuestion}
                className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
              >
                تطبيق التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
