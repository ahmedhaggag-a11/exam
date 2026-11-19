'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { 
  Key, 
  Printer, 
  Trash2, 
  Edit3, 
  Smartphone, 
  FileText, 
  Search, 
  X, 
  Check, 
  Clock, 
  Award, 
  HelpCircle, 
  Layers, 
  BookOpen, 
  GraduationCap, 
  Calendar 
} from 'lucide-react';

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string | null;
  total_marks: number;
  total_questions: number;
  models_count: number;
  status: string;
  created_at: string;
}

interface QuestionChoice {
  id: string;
  choice_code: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

interface ExamQuestionItem {
  id: string;
  text: string;
  question_type: string;
  difficulty: string;
  chapter?: string;
  lesson?: string;
  marks?: number;
  model_answer?: string;
  choices?: QuestionChoice[];
}

interface ExamModelData {
  id: string;
  model_code: string;
  model_name: string;
  questions_order: string[];
  choices_order?: Record<string, string[]>;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:     { label: 'مسودة',   color: 'bg-amber-100 text-amber-800 border-amber-200' },
  generated: { label: 'تم التوليد', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  ready:     { label: 'جاهز',    color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  published: { label: 'منشور',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  archived:  { label: 'مؤرشف',  color: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function ExamsPage() {
  const supabase = createClient();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Answer Key Modal State
  const [answerKeyModalOpen, setAnswerKeyModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [examModels, setExamModels] = useState<ExamModelData[]>([]);
  const [questionsMap, setQuestionsMap] = useState<Record<string, ExamQuestionItem>>({});
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [loadingAnswerKey, setLoadingAnswerKey] = useState(false);

  useEffect(() => { loadExams(); }, []);

  async function loadExams() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from('exams')
      .select('id, title, subject, grade_level, duration_minutes, exam_date, total_marks, total_questions, models_count, status, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false });

    if (error) console.error('loadExams error:', error);
    setExams(data || []);
    setLoading(false);
  }

  async function deleteExam(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الامتحان نهائياً؟')) return;
    setDeleting(id);
    await supabase.from('exams').delete().eq('id', id);
    setExams(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }

  // Open Answer Key Modal
  async function openAnswerKey(exam: Exam) {
    setSelectedExam(exam);
    setAnswerKeyModalOpen(true);
    setLoadingAnswerKey(true);
    setActiveModelIndex(0);

    try {
      // 1. Fetch exam models
      const { data: modelsData, error: modelsErr } = await supabase
        .from('exam_models')
        .select('*')
        .eq('exam_id', exam.id)
        .order('model_code');

      if (modelsErr) console.error('Models error:', modelsErr);

      // 2. Fetch exam questions with choices
      const { data: eqData, error: eqErr } = await supabase
        .from('exam_questions')
        .select('question_id, order_index, question:questions(*, choices:question_choices(*))')
        .eq('exam_id', exam.id);

      if (eqErr) console.error('Exam questions error:', eqErr);

      const qMap: Record<string, ExamQuestionItem> = {};
      if (eqData) {
        eqData.forEach((item: any) => {
          if (item.question) {
            qMap[item.question.id] = {
              id: item.question.id,
              text: item.question.text || item.question.question_text || '',
              question_type: item.question.question_type || 'mcq',
              difficulty: item.question.difficulty || 'medium',
              chapter: item.question.chapter,
              lesson: item.question.lesson,
              marks: item.question.marks || 2,
              model_answer: item.question.model_answer,
              choices: item.question.choices || [],
            };
          }
        });
      }

      setQuestionsMap(qMap);
      setExamModels(modelsData || []);
    } catch (err) {
      console.error('Error loading answer key:', err);
    }
    setLoadingAnswerKey(false);
  }

  const filtered = exams.filter(e =>
    e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.grade_level?.includes(search) ||
    e.subject?.includes(search)
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 pb-12 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800">امتحاناتي 📝</h1>
          <p className="text-xs text-slate-500 mt-1">إدارة وطباعة وتصحيح الامتحانات ونماذج الإجابة لجميع الصفوف.</p>
        </div>
        <Link href="/teacher/create-exam"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-md shadow-blue-600/20 text-center">
          + إنشاء امتحان جديد
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بعنوان الامتحان أو الصف أو المادة..."
          className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
        />
      </div>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-lg font-bold text-slate-700 mb-1">لا توجد امتحانات مسجلة</p>
          <p className="text-xs text-slate-400 mb-5">ابدأ بإنشاء أول امتحان ونماذجه بكل سهولة من بنك الأسئلة</p>
          <Link href="/teacher/create-exam"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-600/20">
            إنشاء امتحان الآن
          </Link>
        </div>
      ) : (
        /* Exams List */
        <div className="space-y-4">
          {filtered.map(exam => (
            <div 
              key={exam.id} 
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-4 sm:p-5 space-y-4"
            >
              {/* Top row: Title and Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-800 text-base sm:text-lg leading-snug">{exam.title}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${STATUS_LABELS[exam.status]?.color || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {STATUS_LABELS[exam.status]?.label || exam.status}
                  </span>
                </div>
              </div>

              {/* Meta information badges - Responsive grid on mobile, flex on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 text-xs text-slate-600 font-bold">
                {exam.subject && (
                  <span className="px-2.5 py-1.5 bg-blue-50/70 text-blue-900 border border-blue-200 rounded-xl flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">{exam.subject}</span>
                  </span>
                )}
                {exam.grade_level && (
                  <span className="px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{exam.grade_level}</span>
                  </span>
                )}
                <span className="px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{exam.duration_minutes} دقيقة</span>
                </span>
                <span className="px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{exam.total_marks} درجة</span>
                </span>
                <span className="px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>{exam.total_questions} سؤال</span>
                </span>
                <span className="px-2.5 py-1.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{exam.models_count} نماذج</span>
                </span>
                {exam.exam_date && (
                  <span className="px-2.5 py-1.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl flex items-center gap-1.5 col-span-2 sm:col-span-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>
                  </span>
                )}
              </div>

              {/* Action Buttons - Fully responsive on mobile with no clipping */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                <Link 
                  href={`/teacher/exams/${exam.id}/bubble-sheet`} 
                  target="_blank"
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                  <span>بابل شيت</span>
                </Link>

                <Link 
                  href={`/teacher/exams/${exam.id}/scanner`}
                  className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تصحيح بالكاميرا</span>
                </Link>

                {/* NEW: Answer Key Button */}
                <button
                  type="button"
                  onClick={() => openAnswerKey(exam)}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  <span>نماذج الإجابة</span>
                </button>

                <Link 
                  href={`/teacher/exams/${exam.id}/print`} 
                  target="_blank"
                  className="px-3 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-500" />
                  <span>طباعة</span>
                </Link>

                <Link 
                  href={`/teacher/exams/${exam.id}/edit`}
                  className="px-3 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>تعديل</span>
                </Link>

                <button 
                  onClick={() => deleteExam(exam.id)} 
                  disabled={deleting === exam.id}
                  className="px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5 mr-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>{deleting === exam.id ? 'جاري الحذف...' : 'حذف'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Answer Key Modal ─── */}
      {answerKeyModalOpen && selectedExam && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-800">
                    مفتاح ونماذج الإجابة: {selectedExam.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إجمالي {selectedExam.total_questions} سؤال | {selectedExam.total_marks} درجة
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setAnswerKeyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Models Switcher Tabs */}
            {examModels.length > 0 && (
              <div className="p-3 border-b border-slate-100 bg-white flex items-center gap-2 overflow-x-auto">
                <span className="text-xs font-bold text-slate-500 shrink-0">اختر النموذج:</span>
                <div className="flex gap-1.5">
                  {examModels.map((m, idx) => (
                    <button
                      key={m.id || idx}
                      onClick={() => setActiveModelIndex(idx)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black border transition ${
                        activeModelIndex === idx
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {m.model_name || `نموذج ${['أ', 'ب', 'ج', 'د'][idx]}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Questions & Answer Key Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
              {loadingAnswerKey ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold">جاري تحميل مفتاح الإجابة للنماذج...</span>
                </div>
              ) : examModels.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-bold">
                  لم يتم العثور على نماذج مسجلة لهذا الامتحان.
                </div>
              ) : (
                (() => {
                  const currentModel = examModels[activeModelIndex] || examModels[0];
                  const qOrder = currentModel.questions_order || Object.keys(questionsMap);

                  return (
                    <div className="space-y-3">
                      {qOrder.map((qId, qIdx) => {
                        const q = questionsMap[qId];
                        if (!q) return null;

                        const isMcq = q.question_type === 'mcq' || (q.choices && q.choices.length > 0);
                        const correctChoice = q.choices?.find(c => c.is_correct);

                        return (
                          <div 
                            key={qId || qIdx}
                            className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 flex-1">
                                <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                  س{qIdx + 1}
                                </span>
                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap text-[10px]">
                                    <span className="px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800">
                                      {q.question_type === 'mcq' ? 'اختيار من متعدد' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-600">
                                      {q.difficulty === 'easy' ? '🟢 سهل' : q.difficulty === 'hard' ? '🔴 صعب' : '🟡 متوسط'}
                                    </span>
                                    {q.chapter && (
                                      <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        {q.chapter}
                                      </span>
                                    )}
                                    {q.lesson && (
                                      <span className="px-2 py-0.5 rounded-md font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        {q.lesson}
                                      </span>
                                    )}
                                    <span className="mr-auto font-bold text-slate-500">
                                      {q.marks || 2} درجات
                                    </span>
                                  </div>

                                  <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed pt-1">
                                    {q.text}
                                  </p>

                                  {/* Answer Highlight Box */}
                                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 font-black text-xs">
                                      <Check className="w-4 h-4" />
                                    </div>
                                    <div className="text-xs font-bold leading-normal">
                                      <span className="text-emerald-800 font-black ml-1">الإجابة النموذجية:</span>
                                      {correctChoice ? (
                                        <span>
                                          ({correctChoice.choice_code || '✓'}) {correctChoice.text}
                                        </span>
                                      ) : q.model_answer ? (
                                        <span>{q.model_answer}</span>
                                      ) : (
                                        <span className="text-slate-500">محددة بنموذج التصحيح</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                النموذج النشط: {examModels[activeModelIndex]?.model_name || `نموذج ${['أ', 'ب', 'ج', 'د'][activeModelIndex]}`}
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة مفتاح الإجابة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
