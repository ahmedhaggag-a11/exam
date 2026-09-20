'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface ExamModel {
  id: string;
  model_code: string;
  model_name: string;
  questions_order: string[];
  choices_order: Record<string, string[]>; // question_id -> array of choice_codes
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
  title: string;
  subject: string;
  grade_level: string;
  duration_minutes: number;
  exam_date: string | null;
  total_marks: number;
  models_count: number;
  instructions: string;
  status: string;
}

export default function ExamEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [exam, setExam] = useState<Exam | null>(null);
  const [models, setModels] = useState<ExamModel[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [activeModel, setActiveModel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { loadExam(); }, [id]);

  async function loadExam() {
    setLoading(true);
    // 1. Fetch Exam
    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();
      
    if (!examData) { setLoading(false); return; }
    setExam(examData as Exam);

    // 2. Fetch Models
    const { data: modelsData } = await supabase
      .from('exam_models')
      .select('*')
      .eq('exam_id', id)
      .order('model_code');
    setModels(modelsData || []);

    // 3. Fetch Questions with their choices
    const { data: examQs } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        order_index,
        questions (
          id, text, question_type, model_answer, chapter, image_urls,
          choices:question_choices(*)
        )
      `)
      .eq('exam_id', id);

    const qMap: Record<string, Question> = {};
    (examQs || []).forEach((eq: any) => {
      if (eq.questions) {
        qMap[eq.questions.id] = { ...eq.questions };
      }
    });
    setQuestions(qMap);
    setLoading(false);
  }

  function getModelQuestions(model: ExamModel): Question[] {
    const shuffled: Question[] = [];
    (model.questions_order || []).forEach(qid => {
      if (!questions[qid]) return;
      const q = { ...questions[qid] };
      
      // Apply choices shuffle if there's a specific order
      if (model.choices_order?.[qid] && q.choices) {
        const order = model.choices_order[qid];
        q.choices = [...q.choices].sort((a, b) => {
          return order.indexOf(a.choice_code) - order.indexOf(b.choice_code);
        });
      } else if (q.choices) {
        // Default sort by order_index
        q.choices = [...q.choices].sort((a, b) => a.order_index - b.order_index);
      }
      shuffled.push(q);
    });
    // Fallback if no order
    if (shuffled.length === 0) return Object.values(questions);
    return shuffled;
  }

  function startEdit(q: Question) {
    setEditingQ(q.id);
    setEditText(q.text);
  }

  async function saveEdit(qid: string) {
    await supabase.from('questions').update({ text: editText }).eq('id', qid);
    setQuestions(prev => ({ ...prev, [qid]: { ...prev[qid], text: editText } }));
    setEditingQ(null);
  }

  async function removeQuestion(qid: string) {
    if (!confirm('هل تريد حذف هذا السؤال من الامتحان؟')) return;
    await supabase.from('exam_questions').delete().eq('exam_id', id).eq('question_id', qid);
    
    // Remove from all models
    const updatedModels = models.map(m => ({
      ...m,
      questions_order: m.questions_order.filter(q => q !== qid),
    }));
    for (const m of updatedModels) {
      await supabase.from('exam_models').update({ questions_order: m.questions_order }).eq('id', m.id);
    }
    setModels(updatedModels);
    setQuestions(prev => {
      const next = { ...prev };
      delete next[qid];
      return next;
    });
  }

  async function updateStatus(status: string) {
    setSaving(true);
    await supabase.from('exams').update({ status }).eq('id', id);
    setExam(prev => prev ? { ...prev, status } : prev);
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!exam) return <div className="p-12 text-center text-red-600 font-bold text-xl">❌ الامتحان غير موجود (تأكد من الرابط)</div>;

  const currentModel = models[activeModel];
  const modelQuestions = currentModel ? getModelQuestions(currentModel) : Object.values(questions);

  return (
    <div className="max-w-5xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{exam.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5 flex gap-3">
            <span>📚 {exam.subject}</span>
            <span>🏫 {exam.grade_level}</span>
            <span>⏱️ {exam.duration_minutes} دقيقة</span>
            <span>💯 {exam.total_marks} درجة</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(exam.status === 'draft' || exam.status === 'generated') && (
            <button onClick={() => updateStatus('published')} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50">
              ✅ نشر الامتحان للمراجعة
            </button>
          )}
          <Link href={`/teacher/exams/${id}/print`} target="_blank"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition">
            🖨️ طباعة
          </Link>
          <Link href="/teacher/exams"
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">
            ← رجوع
          </Link>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {/* Models tabs */}
      {models.length > 1 && (
        <div className="flex gap-2 mb-4">
          {models.map((m, i) => (
            <button key={m.id} onClick={() => setActiveModel(i)}
              className={`px-5 py-2 rounded-lg text-sm font-bold border transition ${
                activeModel === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}>
              {m.model_name}
            </button>
          ))}
        </div>
      )}

      {/* Questions list */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">
            {currentModel ? currentModel.model_name : 'الأسئلة'} — {modelQuestions.length} سؤال
          </h2>
        </div>

        <div className="space-y-3">
          {modelQuestions.map((q, idx) => (
            <div key={q.id} className={`border rounded-lg p-4 ${editingQ === q.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      q.question_type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                      q.question_type === 'essay' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {q.question_type === 'mcq' ? 'اختيار' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                    </span>
                    {q.chapter && <span className="text-xs text-gray-400">{q.chapter}</span>}
                  </div>

                  {editingQ === q.id ? (
                    <div>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={3}
                        className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveEdit(q.id)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">حفظ</button>
                        <button onClick={() => setEditingQ(null)} className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50">إلغاء</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-gray-800 font-medium leading-relaxed">{q.text}</p>
                      {q.image_urls && q.image_urls.length > 0 && (
                        <div className="my-3">
                          <img src={q.image_urls[0]} alt="صورة توضيحية" className="max-w-full h-auto max-h-40 border border-gray-200 rounded object-contain" />
                        </div>
                      )}
                    </>
                  )}

                  {q.choices && q.choices.length > 0 && editingQ !== q.id && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.choices.map((c, ci) => (
                        <p key={c.id} className={`text-xs px-2 py-1.5 rounded border ${
                          c.is_correct ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'border-gray-100 text-gray-600 bg-gray-50'
                        }`}>
                          {['أ', 'ب', 'ج', 'د', 'هـ', 'و'][ci] || c.choice_code}. {c.text}
                          {c.is_correct && ' ✓'}
                        </p>
                      ))}
                    </div>
                  )}

                  {q.model_answer && q.question_type !== 'mcq' && editingQ !== q.id && (
                    <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded px-3 py-2">
                      <span className="font-bold">الإجابة:</span> {q.model_answer}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => startEdit(q)} className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 text-xs transition" title="تعديل السؤال">✏️</button>
                  <button onClick={() => removeQuestion(q.id)} className="p-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 text-xs transition" title="حذف السؤال من الامتحان">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {modelQuestions.length === 0 && (
          <p className="text-center text-gray-400 py-8">لا توجد أسئلة في هذا النموذج</p>
        )}
      </div>
    </div>
  );
}
