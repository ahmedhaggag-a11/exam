'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ExamModel {
  id: string;
  model_label: string;
  questions_order: string[];
  choices_shuffle: Record<string, number[]>;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string | null;
  topic: string | null;
  mark?: number;
}

interface Exam {
  id: string;
  title: string;
  grade: string;
  duration: number;
  exam_date: string | null;
  total_mark: number;
  models_count: number;
  instructions: string;
  status: string;
  subjects?: { name: string };
}

export default function ExamPrintPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [exam, setExam] = useState<Exam | null>(null);
  const [models, setModels] = useState<ExamModel[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExam(); }, [id]);

  async function loadExam() {
    setLoading(true);
    const { data: examData } = await supabase
      .from('exams')
      .select('*, subjects(name)')
      .eq('id', id)
      .single();
    if (!examData) { setLoading(false); return; }
    setExam(examData as any);

    const { data: modelsData } = await supabase
      .from('exam_models')
      .select('*')
      .eq('exam_id', id)
      .order('model_label');
    setModels(modelsData || []);

    const { data: examQs } = await supabase
      .from('exam_questions')
      .select('question_id, mark, questions(*)')
      .eq('exam_id', id);

    const qMap: Record<string, Question> = {};
    (examQs || []).forEach((eq: any) => {
      if (eq.questions) {
        qMap[eq.questions.id] = { ...eq.questions, mark: eq.mark };
      }
    });
    setQuestions(qMap);
    setLoading(false);
  }

  function getModelQuestions(model: ExamModel): Question[] {
    const result: Question[] = [];
    (model.questions_order || []).forEach(qid => {
      if (!questions[qid]) return;
      const q = { ...questions[qid] };
      if (model.choices_shuffle?.[qid] && q.options) {
        const order = model.choices_shuffle[qid];
        q.options = order.map((i: number) => q.options![i]);
      }
      result.push(q);
    });
    return result.length > 0 ? result : Object.values(questions);
  }

  function handlePrint() {
    window.print();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!exam) return <p className="text-red-600 p-6">الامتحان غير موجود</p>;

  const modelGroups = models.length > 0 ? models : [{ id: 'default', model_label: 'أ', questions_order: Object.keys(questions), choices_shuffle: {} }];

  return (
    <>
      {/* Print Controls - hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="font-bold text-gray-800">{exam.title}</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showAnswerKey} onChange={e => setShowAnswerKey(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            <span>تضمين ورقة الإجابات</span>
          </label>
          <button onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            🖨️ طباعة
          </button>
          <a href={`/teacher/exams/${id}/edit`}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
            ← رجوع
          </a>
        </div>
      </div>

      <div className="pt-16 no-print-padding">
        {modelGroups.map((model, mi) => {
          const modelQs = getModelQuestions(model as ExamModel);
          const mcqs = modelQs.filter(q => q.question_type === 'mcq');
          const tfs = modelQs.filter(q => q.question_type === 'true_false');
          const essays = modelQs.filter(q => q.question_type === 'essay');

          return (
            <div key={model.id} className="print-page mb-8 bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
              {/* Exam Header */}
              <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">
                    <p>المادة: <strong>{exam.subjects?.name || '—'}</strong></p>
                    <p>الصف: <strong>{exam.grade}</strong></p>
                  </div>
                  <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">{exam.title}</h1>
                    <p className="text-lg font-bold text-blue-700 mt-1">نموذج {model.model_label}</p>
                  </div>
                  <div className="text-sm text-gray-600 text-left">
                    <p>الزمن: <strong>{exam.duration} دقيقة</strong></p>
                    <p>الدرجة: <strong>{exam.total_mark} درجة</strong></p>
                  </div>
                </div>

                {/* Student Info */}
                <div className="flex gap-8 justify-center mt-3 text-sm">
                  <div className="flex gap-2 items-center">
                    <span className="font-medium">اسم الطالب:</span>
                    <div className="border-b border-gray-400 w-48 h-5" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="font-medium">رقم الجلوس:</span>
                    <div className="border-b border-gray-400 w-24 h-5" />
                  </div>
                  {exam.exam_date && (
                    <div className="flex gap-2 items-center">
                      <span className="font-medium">التاريخ:</span>
                      <span>{new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                </div>

                {exam.instructions && (
                  <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded p-2 text-right">
                    <strong>تعليمات:</strong> {exam.instructions}
                  </div>
                )}
              </div>

              {/* MCQ Section */}
              {mcqs.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">
                    السؤال الأول: اختر الإجابة الصحيحة <span className="text-sm font-normal text-gray-500">({mcqs.length} أسئلة)</span>
                  </h2>
                  <div className="space-y-4">
                    {mcqs.map((q, qi) => (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          {qi + 1}. {q.question_text}
                          {q.mark && <span className="text-xs text-gray-400 mr-2">({q.mark} درجة)</span>}
                        </p>
                        {q.options && (
                          <div className="grid grid-cols-2 gap-1 pr-4">
                            {q.options.map((opt, oi) => (
                              <p key={oi} className="text-xs text-gray-700">
                                {['أ', 'ب', 'ج', 'د'][oi]}. {opt}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* True/False Section */}
              {tfs.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">
                    السؤال الثاني: صح أم خطأ <span className="text-sm font-normal text-gray-500">({tfs.length} أسئلة)</span>
                  </h2>
                  <div className="space-y-3">
                    {tfs.map((q, qi) => (
                      <div key={q.id} className="flex items-center gap-3">
                        <p className="text-sm text-gray-800 flex-1">
                          {mcqs.length + qi + 1}. {q.question_text}
                          {q.mark && <span className="text-xs text-gray-400 mr-2">({q.mark} درجة)</span>}
                        </p>
                        <div className="flex gap-4 text-xs shrink-0">
                          <label className="flex items-center gap-1"><span className="border border-gray-400 w-4 h-4 inline-block" /> صح</label>
                          <label className="flex items-center gap-1"><span className="border border-gray-400 w-4 h-4 inline-block" /> خطأ</label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Essay Section */}
              {essays.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-base font-bold text-gray-800 mb-3 border-b border-gray-300 pb-1">
                    السؤال الثالث: أسئلة مقالية <span className="text-sm font-normal text-gray-500">({essays.length} أسئلة)</span>
                  </h2>
                  <div className="space-y-5">
                    {essays.map((q, qi) => (
                      <div key={q.id}>
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          {mcqs.length + tfs.length + qi + 1}. {q.question_text}
                          {q.mark && <span className="text-xs text-gray-400 mr-2">({q.mark} درجة)</span>}
                        </p>
                        <div className="border-b border-gray-200 h-8 mt-2" />
                        <div className="border-b border-gray-200 h-8 mt-1" />
                        <div className="border-b border-gray-200 h-8 mt-1" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-3 border-t border-gray-200 text-center text-xs text-gray-400">
                نموذج {model.model_label} — {exam.title} — {exam.subjects?.name}
              </div>
            </div>
          );
        })}

        {/* Answer Key */}
        {showAnswerKey && (
          <div className="print-page mt-8 bg-white rounded-lg shadow p-8 max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-center text-gray-800 border-b-2 border-gray-800 pb-3 mb-6">
              ورقة إجابات — {exam.title}
            </h2>

            {modelGroups.map((model) => {
              const modelQs = getModelQuestions(model as ExamModel);
              return (
                <div key={model.id} className="mb-6">
                  <h3 className="font-bold text-blue-700 mb-3">نموذج {model.model_label}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {modelQs.map((q, qi) => (
                      <div key={q.id} className="text-xs border rounded p-2 bg-gray-50">
                        <span className="font-bold text-gray-600">{qi + 1}. </span>
                        <span className={`font-medium ${
                          q.question_type === 'mcq' ? 'text-blue-700' :
                          q.correct_answer?.toLowerCase() === 'صح' || q.correct_answer?.toLowerCase() === 'true' ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {q.correct_answer || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { padding-top: 0 !important; }
          .print-page { box-shadow: none !important; margin-bottom: 0 !important; page-break-after: always; }
          .print-page:last-child { page-break-after: avoid; }
        }
      `}</style>
    </>
  );
}
