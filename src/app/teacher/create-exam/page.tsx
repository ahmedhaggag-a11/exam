'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GeminiAIExamProvider } from '@/lib/ai/gemini';
import { generateExamModels } from '@/lib/utils/exam-shuffler';

interface Subject { id: string; name: string; }
interface Source { id: string; title: string; subject_id: string; }
interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  correct_answer: string | null;
  topic: string | null;
  subject_id: string;
}

const STEPS = ['بيانات الامتحان', 'الفصول والأسئلة', 'نماذج وخيارات', 'توليد الامتحان', 'مراجعة وحفظ'];

export default function CreateExamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedModels, setGeneratedModels] = useState<any[]>([]);
  const [activeModel, setActiveModel] = useState(0);
  const [error, setError] = useState('');

  // Step 1 - Exam header
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade] = useState('');
  const [duration, setDuration] = useState('60');
  const [examDate, setExamDate] = useState('');
  const [instructions, setInstructions] = useState('أجب عن جميع الأسئلة - المدة المحددة للامتحان هي المدة الكاملة');

  // Step 2 - Chapters & counts
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [mcqCount, setMcqCount] = useState(10);
  const [essayCount, setEssayCount] = useState(5);
  const [tfCount, setTfCount] = useState(5);
  const [totalMark, setTotalMark] = useState(100);

  // Step 3 - Models & options
  const [modelsCount, setModelsCount] = useState(2);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleChoices, setShuffleChoices] = useState(true);

  useEffect(() => {
    loadSubjects();
  }, []);

  useEffect(() => {
    if (subjectId) {
      loadSources(subjectId);
      loadQuestions(subjectId);
    }
  }, [subjectId]);

  async function loadSubjects() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('subjects').eq('id', user.id).single();
    if (data && data.subjects) {
      setSubjects(data.subjects.map((name: string) => ({ id: name, name })));
    }
  }

  async function loadSources(sid: string) {
    const { data } = await supabase.from('sources').select('id, title:name, subject').eq('subject', sid).order('name');
    setSources(data || []);
  }

  async function loadQuestions(sid: string) {
    const { data } = await supabase.from('questions').select('*').eq('subject', sid);
    setQuestions(data || []);
  }

  const availableTopics = Array.from(new Set(questions.map(q => q.topic).filter((t): t is string => t !== null && t !== undefined)));

  function toggleTopic(topic: string) {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const provider = new GeminiAIExamProvider();
      const pool = selectedTopics.length > 0
        ? questions.filter(q => selectedTopics.includes(q.topic || ''))
        : questions;

      const examConfig = {
        subject: subjects.find(s => s.id === subjectId)?.name || '',
        selected_chapters: selectedTopics,
        total_questions: mcqCount + essayCount + tfCount,
        question_types: { mcq: mcqCount, essay: essayCount, true_false: tfCount },
        grade,
        duration: parseInt(duration),
        instructions,
      };

      const result = await provider.generateExam(pool as any, examConfig as any);
      if (!result || result.selected_question_ids.length === 0) {
        setError('لم يتم العثور على أسئلة كافية في بنك الأسئلة للمعايير المحددة.');
        setGenerating(false);
        return;
      }

      // Map selected IDs back to question objects
      const selectedQs = result.selected_question_ids
        .map(id => pool.find(q => q.id === id))
        .filter(Boolean) as typeof questions;

      const models = generateExamModels(selectedQs as any, modelsCount, shuffleQuestions, shuffleChoices);
      setGeneratedModels(models);
      setStep(4);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء توليد الامتحان');
    }
    setGenerating(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('غير مسجل دخول');

      const { data: exam, error: examError } = await supabase.from('exams').insert({
        teacher_id: user.id,
        subject: subjectId, // Using the name directly since we mapped id to name
        title,
        grade_level: grade,
        duration_minutes: parseInt(duration),
        exam_date: examDate || null,
        instructions,
        total_marks: totalMark,
        models_count: modelsCount,
        status: 'draft',
      }).select().single();

      if (examError) throw examError;

      // Save questions
      const baseModel = generatedModels[0];
      if (baseModel && baseModel.questions) {
        const qRows = baseModel.questions.map((q: any, idx: number) => ({
          exam_id: exam.id,
          question_id: q.id,
          order_index: idx,
        }));
        await supabase.from('exam_questions').insert(qRows);
      }

      // Save models
      for (let i = 0; i < generatedModels.length; i++) {
        const model = generatedModels[i];
        await supabase.from('exam_models').insert({
          exam_id: exam.id,
          model_code: ['A', 'B', 'C', 'D'][i] || `M${i + 1}`,
          model_name: ['أ', 'ب', 'ج', 'د'][i] || `نموذج ${i + 1}`,
          questions_order: model.questions.map((q: any) => q.id),
          choices_order: model.choicesShuffle || {},
        });
      }

      router.push(`/teacher/exams/${exam.id}/edit`);
    } catch (e: any) {
      setError(e.message || 'خطأ أثناء الحفظ');
    }
    setSaving(false);
  }

  const canProceed = [
    title && subjectId && grade,
    mcqCount + essayCount + tfCount > 0,
    modelsCount >= 1,
    true,
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-0">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">إنشاء امتحان جديد</h1>

      {/* Stepper */}
      <div className="flex items-center mb-8 overflow-x-auto pb-4 custom-scrollbar">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-blue-600 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mx-2 text-xs whitespace-nowrap ${i === step ? 'text-blue-700 font-bold' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Step 0: Exam Header */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">بيانات الامتحان</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">عنوان الامتحان *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="امتحان الفصل الدراسي الأول" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">المادة *</label>
              <select value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">اختر المادة</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">الصف الدراسي *</label>
              <input value={grade} onChange={e => setGrade(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="الصف الثالث الثانوي" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">المدة (دقيقة)</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" min={15} max={240} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">تاريخ الامتحان</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">الدرجة الكلية</label>
              <input type="number" value={totalMark} onChange={e => setTotalMark(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" min={10} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">تعليمات الامتحان</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
          </div>
          <div className="flex justify-end pt-2">
            <button disabled={!canProceed[0]} onClick={() => setStep(1)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition">
              التالي ←
            </button>
          </div>
        </div>
      )}

      {/* Step 1: Chapters & Counts */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-700">الفصول وأعداد الأسئلة</h2>

          {availableTopics.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">اختر الفصول / الموضوعات (اتركها فارغة لكل المواضيع)</p>
              <div className="flex flex-wrap gap-2">
                {availableTopics.map(topic => (
                  <button key={topic} onClick={() => toggleTopic(topic)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                      selectedTopics.includes(topic)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}>
                    {topic}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {selectedTopics.length === 0 ? 'سيتم الاختيار من جميع الموضوعات' : `${selectedTopics.length} موضوع محدد`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
              ⚠️ لا توجد موضوعات محددة في بنك الأسئلة لهذه المادة. سيتم الاختيار من جميع الأسئلة المتاحة.
            </p>
          )}

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'أسئلة اختيار من متعدد (MCQ)', value: mcqCount, setter: setMcqCount },
              { label: 'أسئلة مقالية', value: essayCount, setter: setEssayCount },
              { label: 'أسئلة صح/خطأ', value: tfCount, setter: setTfCount },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type="number" value={value} onChange={e => setter(Number(e.target.value))} min={0}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            ))}
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            إجمالي الأسئلة المطلوبة: <strong>{mcqCount + essayCount + tfCount}</strong> سؤال |
            الأسئلة المتاحة في البنك: <strong>{questions.length}</strong>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(0)} className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">→ السابق</button>
            <button disabled={!canProceed[1]} onClick={() => setStep(2)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition">
              التالي ←
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Models & Options */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-700">إعدادات النماذج ومنع الغش</h2>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">عدد نماذج الامتحان</label>
            <div className="flex gap-3">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setModelsCount(n)}
                  className={`w-12 h-12 rounded-xl text-lg font-bold border-2 transition ${
                    modelsCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}>
                  {['أ', 'ب', 'ج', 'د'][n - 1]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">سيتم توليد {modelsCount} نموذج مختلف</p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">خلط ترتيب الأسئلة بين النماذج</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={shuffleChoices} onChange={e => setShuffleChoices(e.target.checked)}
                className="w-4 h-4 accent-blue-600" />
              <span className="text-sm text-gray-700">خلط ترتيب الخيارات (أ/ب/ج/د) بين النماذج</span>
            </label>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">→ السابق</button>
            <button onClick={() => { setStep(3); handleGenerate(); }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              توليد الامتحان ✨
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          {generating ? (
            <>
              <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">جاري توليد الامتحان بالذكاء الاصطناعي...</p>
              <p className="text-sm text-gray-400 mt-2">يتم اختيار الأسئلة من بنك أسئلتك وتوليد {modelsCount} نموذج</p>
            </>
          ) : error ? (
            <div className="text-red-600">
              <p className="text-lg font-semibold mb-2">❌ حدث خطأ</p>
              <p className="text-sm">{error}</p>
              <button onClick={() => setStep(2)} className="mt-4 px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">رجوع</button>
            </div>
          ) : null}
        </div>
      )}

      {/* Step 4: Preview & Save */}
      {step === 4 && generatedModels.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">مراجعة الامتحان</h2>
            <div className="flex gap-2">
              {generatedModels.map((_, i) => (
                <button key={i} onClick={() => setActiveModel(i)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold border transition ${
                    activeModel === i ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                  }`}>
                  نموذج {['أ', 'ب', 'ج', 'د'][i]}
                </button>
              ))}
            </div>
          </div>

          {/* Exam preview */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
            {generatedModels[activeModel]?.questions?.map((q: any, idx: number) => (
              <div key={q.id} className="border-b border-gray-100 pb-3">
                <p className="text-sm font-medium text-gray-800">
                  {idx + 1}. [{q.question_type === 'mcq' ? 'اختيار' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}] {q.question_text}
                </p>
                {q.options && q.options.length > 0 && (
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {q.options.map((opt: string, oi: number) => (
                      <p key={oi} className="text-xs text-gray-600 pr-2">{['أ', 'ب', 'ج', 'د'][oi]}. {opt}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              {generatedModels[activeModel]?.questions?.length || 0} سؤال | {modelsCount} نماذج
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-5 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50">إعادة التوليد</button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition">
                {saving ? 'جاري الحفظ...' : '💾 حفظ الامتحان'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
