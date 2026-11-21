'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ExamPaperConfig, DEFAULT_PAPER_CONFIG } from '@/types/paper-config';
import { getPaperTemplateConfig, savePaperTemplateConfig } from '@/app/admin/paper-templates/actions';
import { ExamPaperRenderer } from '@/components/exam/ExamPaperRenderer';
import { 
  Sliders, 
  Printer, 
  ArrowRight, 
  Eye, 
  CheckCircle2, 
  Save, 
  Check, 
  Sparkles, 
  Layers, 
  FileText,
  RotateCcw
} from 'lucide-react';

interface ExamModel {
  id: string;
  model_code: string;
  model_name: string;
  questions_order: string[];
  choices_order: Record<string, string[]>;
}

interface QuestionChoice {
  id: string;
  choice_code: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

interface Question {
  id: string;
  text: string;
  question_type: string;
  choices: QuestionChoice[];
  model_answer: string | null;
  chapter: string | null;
  marks?: number;
  image_urls: string[] | null;
}

interface Exam {
  id: string;
  teacher_id?: string;
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string | null;
  total_marks: number;
  models_count: number;
  instructions: string;
  status: string;
  template_name: string;
}

export default function ExamPrintPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [exam, setExam] = useState<Exam | null>(null);
  const [models, setModels] = useState<ExamModel[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [config, setConfig] = useState<ExamPaperConfig>(DEFAULT_PAPER_CONFIG);
  const [loading, setLoading] = useState(true);

  // Layout & Pagination States
  const [quickColumns, setQuickColumns] = useState<1 | 2>(1);
  const [questionsPerPage, setQuestionsPerPage] = useState<number>(0);
  const [autoScaleFont, setAutoScaleFont] = useState<boolean>(true);
  const [fontSize, setFontSize] = useState<'xs' | 'sm' | 'base' | 'lg' | 'xl'>('base');
  const [imagePosition, setImagePosition] = useState<'inline' | 'below'>('inline');
  const [selectedModelTab, setSelectedModelTab] = useState<string>('all');

  // Saving state
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadExamAndConfig();
  }, [id]);

  async function loadExamAndConfig() {
    setLoading(true);
    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (!examData) {
      setLoading(false);
      return;
    }
    setExam(examData as Exam);

    // Fetch the customized template: Check exam-specific first, then teacher, then global
    try {
      let cfg = await getPaperTemplateConfig(`exam_${examData.id}`);
      if (!cfg.qrCode?.enabled && examData.teacher_id) {
        const teacherCfg = await getPaperTemplateConfig(examData.teacher_id);
        cfg = { ...teacherCfg, ...(cfg.qrCode?.enabled ? { qrCode: cfg.qrCode } : {}) };
      }
      setConfig(cfg);
      setQuickColumns(cfg.columns || 1);
      setQuestionsPerPage(cfg.questionsPerPage || 0);
      setAutoScaleFont(cfg.autoScaleFont ?? true);
      setFontSize(cfg.fontSize || 'base');
      setImagePosition(cfg.imagePosition || 'inline');
    } catch (e) {
      console.warn('Using default paper config:', e);
    }

    const { data: modelsData } = await supabase
      .from('exam_models')
      .select('*')
      .eq('exam_id', id)
      .order('model_code');
    setModels(modelsData || []);

    // 1. Collect all question IDs from all models
    const allQids = Array.from(
      new Set(
        (modelsData || [])
          .flatMap((m: any) => m.questions_order || [])
          .map((qid: string) => (qid.includes('_var_') ? qid.split('_var_')[0] : qid))
      )
    );

    // 2. Query exam_questions join
    const { data: examQs } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        questions (
          id, text, question_type, model_answer, chapter, image_urls, marks,
          choices:question_choices(*)
        )
      `)
      .eq('exam_id', id);

    const qMap: Record<string, Question> = {};
    (examQs || []).forEach((eq: any) => {
      if (eq.questions) qMap[eq.questions.id] = { ...eq.questions };
    });

    // 3. Fallback: If any questions from models are not in exam_questions, fetch directly by ID
    const missingQids = allQids.filter((qid) => !qMap[qid]);
    if (missingQids.length > 0) {
      const { data: directQs } = await supabase
        .from('questions')
        .select(`
          id, text, question_type, model_answer, chapter, image_urls, marks,
          choices:question_choices(*)
        `)
        .in('id', missingQids);

      (directQs || []).forEach((q: any) => {
        qMap[q.id] = { ...q };
      });
    }

    setQuestions(qMap);
    setLoading(false);
  }

  function getModelQuestions(model: ExamModel): Question[] {
    const result: Question[] = [];
    const choiceLetters = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

    (model.questions_order || []).forEach((qid) => {
      const baseId = qid.includes('_var_') ? qid.split('_var_')[0] : qid;
      const qSource = questions[qid] || questions[baseId];
      if (!qSource) return;
      const q = { ...qSource };
      if (model.choices_order?.[qid] && q.choices && q.choices.length > 1) {
        const order = model.choices_order[qid];
        q.choices = [...q.choices]
          .sort((a, b) => {
            const idxA = order.indexOf(a.id) !== -1 ? order.indexOf(a.id) : order.indexOf(a.choice_code);
            const idxB = order.indexOf(b.id) !== -1 ? order.indexOf(b.id) : order.indexOf(b.choice_code);
            return idxA - idxB;
          })
          .map((c, idx) => ({
            ...c,
            choice_code: choiceLetters[idx] || c.choice_code,
            order_index: idx,
          }));
      } else if (q.choices) {
        q.choices = [...q.choices].sort((a, b) => a.order_index - b.order_index);
      }
      result.push(q);
    });
    return result.length > 0 ? result : Object.values(questions);
  }

  // Handle Questions Per Page Change with Auto Font Scaling
  function handleQuestionsPerPageChange(val: number) {
    setQuestionsPerPage(val);
    const count = val > 0 ? val : totalQuestionsCount;
    if (count >= 5) {
      setImagePosition('inline');
    }
    if (autoScaleFont) {
      if (quickColumns === 2) {
        if (count <= 4) setFontSize('base');
        else if (count <= 6) setFontSize('sm');
        else setFontSize('xs');
      } else {
        if (count <= 2) setFontSize('lg');
        else if (count <= 3) setFontSize('base');
        else if (count <= 5) setFontSize('sm');
        else setFontSize('xs');
      }
    }
  }

  // Handle Columns Change with Auto Font Scaling
  function handleColumnsChange(cols: 1 | 2) {
    setQuickColumns(cols);
    const count = questionsPerPage > 0 ? questionsPerPage : totalQuestionsCount;
    if (autoScaleFont) {
      if (cols === 2) {
        if (count <= 4) setFontSize('base');
        else setFontSize('sm');
      } else {
        if (count <= 2) setFontSize('lg');
        else if (count <= 4) setFontSize('base');
        else setFontSize('sm');
      }
    }
  }

  // Save this customized config for future prints of this exam
  async function handleSaveCustomConfig() {
    if (!exam) return;
    setSavingConfig(true);
    try {
      const updatedConfig: ExamPaperConfig = {
        ...config,
        columns: quickColumns,
        questionsPerPage,
        autoScaleFont,
        fontSize,
        imagePosition,
      };
      await savePaperTemplateConfig(updatedConfig, `exam_${exam.id}`);
      setConfig(updatedConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e: any) {
      alert('خطأ أثناء حفظ التنسيق: ' + e.message);
    } finally {
      setSavingConfig(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-12 text-center text-red-600 font-bold text-xl">
        ❌ الامتحان غير موجود
      </div>
    );
  }

  const modelGroups =
    models.length > 0
      ? models
      : [
          {
            id: 'default',
            model_code: 'A',
            model_name: 'أ',
            questions_order: Object.keys(questions),
            choices_order: {},
          },
        ];

  // Filter models based on user selection in tabs
  const displayedModels =
    selectedModelTab === 'all'
      ? modelGroups
      : modelGroups.filter((m) => m.id === selectedModelTab || m.model_name === selectedModelTab);

  // Total questions in first model
  const sampleModelQs = getModelQuestions(modelGroups[0] as ExamModel);
  const totalQuestionsCount = sampleModelQs.length;

  // Estimated pages per model
  const estimatedPagesCount =
    questionsPerPage > 0
      ? Math.ceil(totalQuestionsCount / questionsPerPage)
      : totalQuestionsCount <= 8
      ? 1
      : Math.ceil(totalQuestionsCount / (quickColumns === 2 ? 8 : 5));

  // Effective Config passed to renderer
  const effectiveConfig: ExamPaperConfig = {
    ...config,
    columns: quickColumns,
    questionsPerPage: questionsPerPage,
    autoScaleFont: autoScaleFont,
    fontSize: fontSize,
    imagePosition: imagePosition,
  };

  return (
    <>
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Top Floating Control Bar - Hidden during window.print()       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <nav 
        className="no-print fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 z-50 shadow-sm"
        dir="rtl"
      >
        {/* Row 1: Title, Page Counter & Print Actions */}
        <div className="px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <a
              href={`/teacher/exams/${id}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition text-xs font-bold shrink-0"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>رجوع لتعديل الامتحان</span>
            </a>
            <div className="truncate max-w-xs sm:max-w-md">
              <h1 className="font-black text-slate-800 text-sm truncate">
                {exam.title}
              </h1>
              <p className="text-[11px] text-slate-500 font-semibold truncate">
                {exam.subject} • {exam.grade_level} • {totalQuestionsCount} سؤال
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            {/* Live Page Estimate Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl font-bold">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>
                الورق المقدر: <strong className="font-black text-blue-900">{estimatedPagesCount}</strong> ورقة A4
              </span>
            </div>

            {/* Save Config Button */}
            <button
              type="button"
              onClick={handleSaveCustomConfig}
              disabled={savingConfig}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                saveSuccess
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
              title="حفظ هذا التنسيق للامتحان ليعتمد دائماً عند الطباعة"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تم حفظ التنسيق!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-slate-600" />
                  <span>{savingConfig ? 'جاري الحفظ...' : 'حفظ التنسيق'}</span>
                </>
              )}
            </button>

            {/* Quick 1-Page Fit Button */}
            {totalQuestionsCount <= 10 && (
              <button
                type="button"
                onClick={() => {
                  handleQuestionsPerPageChange(totalQuestionsCount);
                  setAutoScaleFont(true);
                  setFontSize('xs');
                  setImagePosition('inline');
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black transition shadow-2xs"
                title="ضبط وتصغير تلقائي لتثبيت الامتحان داخل صفحة A4 واحدة تماماً ومنع خروج التذييل"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>🎯 ضبط لصفحة واحدة (A4)</span>
              </button>
            )}

            {/* Save as PDF Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-md shadow-emerald-600/20 transition text-xs"
              title="احفظ الامتحان كملف PDF نظيف عبر اختيار 'حفظ بتنسيق PDF' في الطابعة"
            >
              <span>💾 حفظ كـ PDF</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black shadow-md shadow-blue-600/20 transition text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ طباعة الامتحان</span>
            </button>
          </div>
        </div>

        {/* Row 2: Visual Formatting & Questions Per Page Controls */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 text-xs font-bold overflow-x-auto">
          <div className="flex items-center gap-4 flex-wrap">
            {/* 1. Questions Per Page Selector */}
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 pr-1 text-[11px] font-bold">الأسئلة في الصفحة:</span>
              <div className="flex items-center gap-0.5">
                {[
                  { label: 'تلقائي', val: 0 },
                  { label: '2', val: 2 },
                  { label: '3', val: 3 },
                  { label: '4', val: 4 },
                  { label: '5', val: 5 },
                  { label: '6', val: 6 },
                  { label: '8', val: 8 },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => handleQuestionsPerPageChange(item.val)}
                    className={`px-2 py-1 rounded-lg transition text-xs font-bold ${
                      questionsPerPage === item.val
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Auto Font Scaling Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={autoScaleFont}
                onChange={(e) => {
                  setAutoScaleFont(e.target.checked);
                  if (e.target.checked && questionsPerPage > 0) {
                    handleQuestionsPerPageChange(questionsPerPage);
                  }
                }}
                className="w-3.5 h-3.5 accent-blue-600 rounded"
              />
              <span className="text-slate-700 text-[11px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>تصغير الخط تلقائياً</span>
              </span>
            </label>

            {/* 3. Manual Font Size Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 pr-1 text-[11px]">حجم الخط:</span>
              {[
                { label: 'صغير', val: 'sm' as const },
                { label: 'متوسط', val: 'base' as const },
                { label: 'كبير', val: 'lg' as const },
              ].map((f) => (
                <button
                  key={f.val}
                  type="button"
                  onClick={() => {
                    setFontSize(f.val);
                    setAutoScaleFont(false); // manual override
                  }}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition ${
                    fontSize === f.val && !autoScaleFont
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* 4. Columns Switch */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 pr-1 text-[11px]">الأعمدة:</span>
              <button
                type="button"
                onClick={() => handleColumnsChange(1)}
                className={`px-2 py-0.5 rounded-lg transition ${
                  quickColumns === 1
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                عمود 1
              </button>
              <button
                type="button"
                onClick={() => handleColumnsChange(2)}
                className={`px-2 py-0.5 rounded-lg transition ${
                  quickColumns === 2
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                عمودين (توفير)
              </button>
            </div>

            {/* 5. Image Position Mode */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 pr-1 text-[11px]">موضع الصور:</span>
              <button
                type="button"
                onClick={() => setImagePosition('inline')}
                className={`px-2 py-0.5 rounded-lg transition ${
                  imagePosition === 'inline'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="عرض الرسم بجانب نص السؤال لتوفير مساحة كبيرة ومنع زيادة الصفحات"
              >
                بجانب السؤال (مدمج)
              </button>
              <button
                type="button"
                onClick={() => setImagePosition('below')}
                className={`px-2 py-0.5 rounded-lg transition ${
                  imagePosition === 'below'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="عرض الرسم تحت نص السؤال"
              >
                تحت السؤال
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 5. Models Selector (Tabs) */}
            {modelGroups.length > 1 && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-slate-500 pr-1 text-[11px]">النموذج المعروض:</span>
                <button
                  type="button"
                  onClick={() => setSelectedModelTab('all')}
                  className={`px-2 py-0.5 rounded-lg transition ${
                    selectedModelTab === 'all'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل
                </button>
                {modelGroups.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedModelTab(m.id)}
                    className={`px-2 py-0.5 rounded-lg transition ${
                      selectedModelTab === m.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    نموذج ({m.model_name})
                  </button>
                ))}
              </div>
            )}

            {/* Answer Key Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
              <input
                type="checkbox"
                checked={showAnswerKey}
                onChange={(e) => setShowAnswerKey(e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600 rounded"
              />
              <span className="text-slate-700 text-[11px]">نموذج الإجابة</span>
            </label>
          </div>
        </div>
      </nav>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RENDERED EXAM PAPER PAGES (Live A4 Preview)                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="pt-32 pb-20 bg-slate-200/70 min-h-screen space-y-10 no-print-bg print:p-0 print:m-0 print:space-y-0 print:bg-white print:min-h-0 print:w-full">
        {displayedModels.map((model) => {
          const modelQs = getModelQuestions(model as ExamModel);

          return (
            <div key={model.id} className="print-page-wrapper print:m-0 print:p-0">
              <ExamPaperRenderer
                config={effectiveConfig}
                exam={{
                  title: exam.title,
                  subject: exam.subject,
                  grade_level: exam.grade_level,
                  duration_minutes: exam.duration_minutes,
                  total_marks: exam.total_marks,
                  exam_date: exam.exam_date,
                  instructions: exam.instructions,
                }}
                modelName={model.model_name}
                questions={modelQs}
                isPreview={false}
              />
            </div>
          );
        })}

        {/* Answer Key Section */}
        {showAnswerKey && (
          <div className="print-page-wrapper">
            <div
              dir="rtl"
              className="bg-white p-8 max-w-5xl mx-auto border-2 border-emerald-600 rounded-xl shadow-md"
            >
              <h2 className="text-xl font-black text-center text-slate-900 border-b-2 border-emerald-600 pb-3 mb-6">
                نموذج الإجابات الرسمية والشرح — {exam.title}
              </h2>

              {displayedModels.map((model) => {
                const modelQs = getModelQuestions(model as ExamModel);
                return (
                  <div key={model.id} className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h3 className="font-bold text-sm text-emerald-800 mb-3 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>إجابات النموذج ({model.model_name})</span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                      {modelQs.map((q, qi) => {
                        let ans = q.model_answer;
                        if (q.question_type === 'mcq' && q.choices) {
                          const correct = q.choices.find((c) => c.is_correct);
                          ans = correct
                            ? `${correct.choice_code}. ${correct.text}`
                            : '—';
                        }
                        return (
                          <div
                            key={q.id}
                            className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs"
                          >
                            <span className="font-bold text-blue-900 ml-1">س{qi + 1}:</span>
                            <span className="text-slate-800 font-semibold">{ans || '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
