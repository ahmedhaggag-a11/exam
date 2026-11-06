'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ExamPaperConfig, DEFAULT_PAPER_CONFIG } from '@/types/paper-config';
import { getPaperTemplateConfig } from '@/app/admin/paper-templates/actions';
import { ExamPaperRenderer } from '@/components/exam/ExamPaperRenderer';
import { Sliders, Printer, ArrowRight, Eye, CheckCircle2 } from 'lucide-react';

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
  const [quickColumns, setQuickColumns] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);

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
      // If exam-specific has no QR or custom data, fall back to teacher config
      if (!cfg.qrCode?.enabled && examData.teacher_id) {
        const teacherCfg = await getPaperTemplateConfig(examData.teacher_id);
        cfg = { ...teacherCfg, ...(cfg.qrCode?.enabled ? { qrCode: cfg.qrCode } : {}) };
      }
      setConfig(cfg);
      setQuickColumns(cfg.columns || 1);
    } catch (e) {
      console.warn('Using default paper config:', e);
    }

    const { data: modelsData } = await supabase
      .from('exam_models')
      .select('*')
      .eq('exam_id', id)
      .order('model_code');
    setModels(modelsData || []);

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
    setQuestions(qMap);
    setLoading(false);
  }

  function getModelQuestions(model: ExamModel): Question[] {
    const result: Question[] = [];
    (model.questions_order || []).forEach((qid) => {
      if (!questions[qid]) return;
      const q = { ...questions[qid] };
      if (model.choices_order?.[qid] && q.choices) {
        const order = model.choices_order[qid];
        q.choices = [...q.choices].sort((a, b) => {
          return order.indexOf(a.choice_code) - order.indexOf(b.choice_code);
        });
      } else if (q.choices) {
        q.choices = [...q.choices].sort((a, b) => a.order_index - b.order_index);
      }
      result.push(q);
    });
    return result.length > 0 ? result : Object.values(questions);
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

  // Effective Config with Quick-Toggle support
  const effectiveConfig: ExamPaperConfig = {
    ...config,
    columns: quickColumns,
  };

  return (
    <>
      {/* Print Controls Floating Bar - Hidden in Print */}
      <nav className="no-print fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <a
            href={`/teacher/exams/${id}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع لتعديل الامتحان</span>
          </a>
          <h1 className="font-black text-slate-800 text-sm hidden sm:block truncate max-w-xs">
            {exam.title}
          </h1>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          {/* Quick Column Switch */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <span className="text-slate-500 pr-1">الأعمدة:</span>
            <button
              onClick={() => setQuickColumns(1)}
              className={`px-2.5 py-1 rounded transition ${
                quickColumns === 1
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عمود واحد
            </button>
            <button
              onClick={() => setQuickColumns(2)}
              className={`px-2.5 py-1 rounded transition ${
                quickColumns === 2
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              عمودين (توفير ورق)
            </button>
          </div>

          {/* Answer Key Toggle */}
          <label className="flex items-center gap-2 cursor-pointer border-r border-slate-200 pr-3">
            <input
              type="checkbox"
              checked={showAnswerKey}
              onChange={(e) => setShowAnswerKey(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <span className="text-slate-700">تضمين نموذج الإجابة</span>
          </label>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الورقة (Print / PDF)</span>
          </button>
        </div>
      </nav>

      {/* RENDERED EXAM PAPER PAGES */}
      <div className="pt-20 pb-16 bg-slate-100 min-h-screen space-y-8 no-print-bg">
        {modelGroups.map((model) => {
          const modelQs = getModelQuestions(model as ExamModel);

          return (
            <div key={model.id} className="print-page-wrapper">
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

              {modelGroups.map((model) => {
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
                            className="text-xs border border-slate-200 rounded-lg p-2 bg-white flex gap-1.5 items-start"
                          >
                            <span className="font-bold text-slate-400 w-5">{qi + 1}.</span>
                            <span className="font-bold text-emerald-700 truncate">{ans || '—'}</span>
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

      {/* Global CSS for Print Output */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .no-print-bg {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body {
            padding: 0 !important;
            background: white !important;
          }
          .print-page-wrapper {
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-page-wrapper:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
      `}</style>
    </>
  );
}
