'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  shuffle_questions: boolean;
  shuffle_choices: boolean;
  status: string;
  subjects?: { name: string };
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
    const shuffled: Question[] = [];
    (model.questions_order || []).forEach(qid => {
      if (!questions[qid]) return;
      const q = { ...questions[qid] };
      // Apply choices shuffle
      if (model.choices_shuffle?.[qid] && q.options) {
        const order = model.choices_shuffle[qid];
        q.options = order.map((i: number) => q.options![i]);
      }
      shuffled.push(q);
    });
    // If no model order, use all questions
    if (shuffled.length === 0) return Object.values(questions);
    return shuffled;
  }

  function startEdit(q: Question) {
    setEditingQ(q.id);
    setEditText(q.question_text);
  }

  async function saveEdit(qid: string) {
    await supabase.from('questions').update({ question_text: editText }).eq('id', qid);
    setQuestions(prev => ({ ...prev, [qid]: { ...prev[qid], question_text: editText } }));
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
  if (!exam) return <p className="text-red-600 p-6">الامتحان غير موجود</p>;

  const currentModel = models[activeModel];
  const modelQuestions = currentModel ? getModelQuestions(currentModel) : Object.values(questions);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{exam.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {exam.subjects?.name && `${exam.subjects.name} | `}
            {exam.grade && `${exam.grade} | `}
            {exam.duration} دقيقة | {exam.total_mark} درجة
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {exam.status === 'draft' && (
            <button onClick={() => updateStatus('published')} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50">
              ✅ نشر الامتحان
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
              نموذج {m.model_label}
            </button>
          ))}
        </div>
      )}

      {/* Questions list */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-700">
            {currentModel ? `نموذج ${currentModel.model_label}` : 'الأسئلة'} — {modelQuestions.length} سؤال
          </h2>
        </div>

        <div className="space-y-3">
          {modelQuestions.map((q, idx) => (
            <div key={q.id} className={`border rounded-lg p-4 ${editingQ === q.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      q.question_type === 'mcq' ? 'bg-blue-100 text-blue-700' :
                      q.question_type === 'essay' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {q.question_type === 'mcq' ? 'اختيار' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                    </span>
                    {q.topic && <span className="text-xs text-gray-400">{q.topic}</span>}
                    {q.mark && <span className="text-xs text-gray-500 mr-auto">{q.mark} درجة</span>}
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
                    <p className="text-sm text-gray-800">{q.question_text}</p>
                  )}

                  {q.options && q.options.length > 0 && editingQ !== q.id && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {q.options.map((opt, oi) => (
                        <p key={oi} className={`text-xs px-2 py-1 rounded ${
                          q.correct_answer === opt ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-600'
                        }`}>
                          {['أ', 'ب', 'ج', 'د'][oi]}. {opt}
                        </p>
                      ))}
                    </div>
                  )}

                  {q.correct_answer && q.question_type !== 'mcq' && editingQ !== q.id && (
                    <p className="mt-1 text-xs text-green-700 bg-green-50 rounded px-2 py-1">✓ الإجابة: {q.correct_answer}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => startEdit(q)} className="p-1.5 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 text-xs">✏️</button>
                  <button onClick={() => removeQuestion(q.id)} className="p-1.5 border border-red-100 rounded-lg text-red-400 hover:bg-red-50 text-xs">🗑️</button>
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
