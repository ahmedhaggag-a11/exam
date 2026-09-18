'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

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
}

interface Exam {
  id: string;
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string | null;
  total_marks: number;
  models_count: number;
  instructions: string;
  status: string;
  template_name: string; // 'classic', 'modern', 'two-cols'
}

export default function ExamPrintPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [exam, setExam] = useState<Exam | null>(null);
  const [models, setModels] = useState<ExamModel[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [template, setTemplate] = useState('classic'); // Default template
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadExam(); }, [id]);

  async function loadExam() {
    setLoading(true);
    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();
    if (!examData) { setLoading(false); return; }
    setExam(examData as Exam);
    setTemplate(examData.template_name || 'classic');

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
          id, text, question_type, model_answer, chapter,
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
    (model.questions_order || []).forEach(qid => {
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

  async function handleTemplateChange(newTemp: string) {
    setTemplate(newTemp);
    if (exam) {
      await supabase.from('exams').update({ template_name: newTemp }).eq('id', exam.id);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!exam) return <div className="p-12 text-center text-red-600 font-bold text-xl">❌ الامتحان غير موجود</div>;

  const modelGroups = models.length > 0 ? models : [{ id: 'default', model_name: 'أ', questions_order: Object.keys(questions), choices_order: {} }];

  return (
    <>
      {/* Print Controls - hidden when printing */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <h1 className="font-bold text-gray-800 truncate pl-4">{exam.title}</h1>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-2 border-r border-gray-300 pr-4">
            <span className="text-gray-600">شكل القالب:</span>
            <select value={template} onChange={e => handleTemplateChange(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 outline-none text-sm bg-gray-50 hover:bg-white focus:ring-2 focus:ring-blue-500">
              <option value="classic">كلاسيكي (رسمي)</option>
              <option value="modern">حديث (مساحات واسعة)</option>
              <option value="two-cols">أعمدة مزدوجة (يوفر الورق)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer border-r border-gray-300 pr-4">
            <input type="checkbox" checked={showAnswerKey} onChange={e => setShowAnswerKey(e.target.checked)}
              className="w-4 h-4 accent-blue-600" />
            <span className="font-medium text-gray-700">تضمين نموذج الإجابة</span>
          </label>
          <button onClick={handlePrint}
            className="px-5 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition shadow-sm">
            🖨️ طباعة
          </button>
          <a href={`/teacher/exams/${id}/edit`}
            className="px-4 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition">
            ← رجوع
          </a>
        </div>
      </div>

      <div className={`pt-20 pb-10 no-print-padding bg-gray-100 min-h-screen template-${template}`}>
        {modelGroups.map((model) => {
          const modelQs = getModelQuestions(model as ExamModel);
          const mcqs = modelQs.filter(q => q.question_type === 'mcq');
          const tfs = modelQs.filter(q => q.question_type === 'true_false');
          const essays = modelQs.filter(q => q.question_type === 'essay');

          // Template variables
          const pageClass = template === 'modern' ? 'bg-white rounded-2xl shadow-xl p-10 max-w-5xl mx-auto border-t-8 border-blue-600' :
                            template === 'two-cols' ? 'bg-white rounded shadow-sm p-6 max-w-6xl mx-auto' :
                            'bg-white rounded shadow p-8 max-w-4xl mx-auto border border-gray-300';
          const headerClass = template === 'modern' ? 'flex flex-col items-center mb-8 gap-2 pb-6 border-b-2 border-gray-100' :
                              'text-center border-b-2 border-gray-800 pb-4 mb-6';

          return (
            <div key={model.id} className={`print-page mb-8 ${pageClass}`}>
              {/* Exam Header */}
              <div className={headerClass}>
                {template === 'modern' ? (
                  <>
                    <h1 className="text-3xl font-black text-gray-800 mb-1">{exam.title}</h1>
                    <div className="flex gap-4 text-sm font-semibold text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
                      <span>{exam.subject}</span>•<span>{exam.grade_level}</span>•<span>{exam.duration_minutes} دقيقة</span>
                    </div>
                    <div className="mt-2 text-blue-600 font-bold text-xl">{model.model_name}</div>
                  </>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-800 text-right w-1/3">
                      <p>المادة: <strong className="text-base">{exam.subject}</strong></p>
                      <p>الصف: <strong>{exam.grade_level}</strong></p>
                    </div>
                    <div className="text-center w-1/3">
                      <h1 className="text-2xl font-bold text-gray-900 leading-tight">{exam.title}</h1>
                      <p className="text-lg font-bold mt-1 inline-block border-2 border-black px-3 py-0.5 rounded-full">{model.model_name}</p>
                    </div>
                    <div className="text-sm text-gray-800 text-left w-1/3">
                      <p>الزمن: <strong>{exam.duration_minutes} دقيقة</strong></p>
                      <p>الدرجة: <strong>{exam.total_marks} درجة</strong></p>
                    </div>
                  </div>
                )}

                {/* Student Info Box */}
                <div className={`mt-4 flex flex-wrap gap-6 text-sm font-medium ${template==='modern'?'w-full justify-between bg-gray-50 p-4 rounded-xl border border-gray-100':'justify-center'}`}>
                  <div className="flex gap-2 items-center flex-1">
                    <span>اسم الطالب:</span>
                    <div className="border-b border-black flex-1 h-5 min-w-[200px]" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <span>رقم الجلوس:</span>
                    <div className="border-b border-black w-24 h-5" />
                  </div>
                  {exam.exam_date && (
                    <div className="flex gap-2 items-center">
                      <span>التاريخ:</span>
                      <span>{new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>
                    </div>
                  )}
                </div>

                {exam.instructions && (
                  <div className={`mt-4 text-xs font-semibold ${template==='modern'?'bg-blue-50 text-blue-800 p-3 rounded-lg w-full':'text-gray-800 border border-gray-300 p-2 text-right'}`}>
                    📌 تعليمات: {exam.instructions}
                  </div>
                )}
              </div>

              {/* QUESTIONS BODY */}
              <div className={template === 'two-cols' ? 'columns-1 md:columns-2 gap-8' : ''}>
                
                {/* MCQ Section */}
                {mcqs.length > 0 && (
                  <div className="mb-6 break-inside-avoid">
                    <h2 className={`font-bold mb-4 ${template==='modern'?'text-lg text-blue-800 bg-blue-50 inline-block px-3 py-1 rounded':'text-base text-gray-900 border-b border-black pb-1'}`}>
                      السؤال الأول: اختر الإجابة الصحيحة
                    </h2>
                    <div className="space-y-4">
                      {mcqs.map((q, qi) => (
                        <div key={q.id} className="break-inside-avoid">
                          <p className="text-sm font-bold text-gray-900 mb-1.5 leading-relaxed">
                            {qi + 1}. {q.text}
                          </p>
                          {q.choices && (
                            <div className={`grid gap-1.5 ${template==='two-cols'?'grid-cols-1':'grid-cols-2'} pr-4`}>
                              {q.choices.map((c, ci) => (
                                <p key={c.id} className="text-sm text-gray-800 font-medium">
                                  <span className="inline-block w-6 text-gray-600">
                                    {['أ', 'ب', 'ج', 'د', 'هـ', 'و'][ci] || c.choice_code})
                                  </span> 
                                  {c.text}
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
                  <div className="mb-6 break-inside-avoid">
                    <h2 className={`font-bold mb-4 ${template==='modern'?'text-lg text-blue-800 bg-blue-50 inline-block px-3 py-1 rounded':'text-base text-gray-900 border-b border-black pb-1'}`}>
                      السؤال الثاني: ضع علامة (✓) أو (✗)
                    </h2>
                    <div className="space-y-3">
                      {tfs.map((q, qi) => (
                        <div key={q.id} className="flex items-start gap-3 break-inside-avoid">
                          <p className="text-sm font-bold text-gray-900 flex-1 leading-relaxed">
                            {mcqs.length + qi + 1}. {q.text}
                          </p>
                          <div className="flex gap-2 shrink-0 pt-0.5">
                            <span className="w-8 h-8 rounded-full border border-gray-400 inline-block"></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Essay Section */}
                {essays.length > 0 && (
                  <div className="mb-6 break-inside-avoid">
                    <h2 className={`font-bold mb-4 ${template==='modern'?'text-lg text-blue-800 bg-blue-50 inline-block px-3 py-1 rounded':'text-base text-gray-900 border-b border-black pb-1'}`}>
                      السؤال الثالث: أجب عن الأسئلة التالية
                    </h2>
                    <div className="space-y-6">
                      {essays.map((q, qi) => (
                        <div key={q.id} className="break-inside-avoid">
                          <p className="text-sm font-bold text-gray-900 mb-2 leading-relaxed">
                            {mcqs.length + tfs.length + qi + 1}. {q.text}
                          </p>
                          <div className="space-y-2 mt-4">
                            <div className="border-b border-dashed border-gray-400 h-6" />
                            <div className="border-b border-dashed border-gray-400 h-6" />
                            <div className="border-b border-dashed border-gray-400 h-6" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-gray-300 flex justify-between text-xs font-medium text-gray-500">
                <span>{model.model_name}</span>
                <span>تم الإنشاء عبر منصة ExamForge</span>
                <span>{exam.title}</span>
              </div>
            </div>
          );
        })}

        {/* Answer Key Page */}
        {showAnswerKey && (
          <div className="print-page mt-8 bg-white rounded shadow p-8 max-w-4xl mx-auto border-t-8 border-green-600">
            <h2 className="text-2xl font-black text-center text-gray-800 border-b-2 border-gray-200 pb-4 mb-8">
              نموذج الإجابات — {exam.title}
            </h2>

            {modelGroups.map((model) => {
              const modelQs = getModelQuestions(model as ExamModel);
              return (
                <div key={model.id} className="mb-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="font-bold text-lg text-green-700 mb-4 flex items-center gap-2">
                    <span className="bg-green-100 p-1 rounded">📋</span> {model.model_name}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {modelQs.map((q, qi) => {
                      let ans = q.model_answer;
                      if (q.question_type === 'mcq' && q.choices) {
                        const correct = q.choices.find(c => c.is_correct);
                        ans = correct ? `${correct.choice_code}. ${correct.text}` : '—';
                      }
                      return (
                        <div key={q.id} className="text-sm border border-gray-200 rounded p-2 bg-white shadow-sm flex gap-2 items-start">
                          <span className="font-bold text-gray-400 w-5">{qi + 1}.</span>
                          <span className={`font-semibold ${q.question_type==='mcq'?'text-blue-700':'text-green-700'}`}>
                            {ans || '—'}
                          </span>
                        </div>
                      );
                    })}
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
          body { padding-top: 0 !important; background: white !important; }
          .print-page { 
            box-shadow: none !important; 
            margin: 0 !important; 
            padding: 20px !important; 
            border: none !important;
            page-break-after: always; 
            max-width: 100% !important;
          }
          .print-page:last-child { page-break-after: avoid; }
          .columns-1, .columns-2 { columns: auto !important; }
          .template-two-cols .columns-1 { columns: 2 !important; column-gap: 40px !important; }
        }
      `}</style>
    </>
  );
}
