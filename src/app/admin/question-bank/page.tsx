'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Question } from '@/types/database';

export default function AdminQuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true);
      const { data } = await supabase
        .from('questions')
        .select('*, choices:question_choices(*)')
        .order('created_at', { ascending: false });

      if (data) {
        setQuestions(data as Question[]);
      }
      setLoading(false);
    }
    loadQuestions();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">بنك الأسئلة الشامل</h1>
          <p className="text-slate-500 text-sm mt-1">
            عرض جميع الأسئلة المسجلة وتصفيتها حسب المدرس أو المادة.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm text-slate-700">
          إجمالي الأسئلة المتاحة في البنك ({questions.length})
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل أسئلة البنك...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            لا توجد أسئلة في البنك حالياً. قم برفع كتب PDF لتغذية البنك.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {questions.map((q, idx) => (
              <div key={q.id} className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs px-2.5 py-1 rounded-md bg-blue-100 text-blue-800">
                      سؤال #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                      {q.question_type === 'mcq' ? 'اختيار من متعدد' : q.question_type === 'essay' ? 'مقالي' : 'صح/خطأ'}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      {q.subject} • {q.chapter}
                    </span>
                  </div>
                </div>
                <p className="font-bold text-slate-800 text-base">{q.text}</p>
                {q.image_urls && q.image_urls.length > 0 && (
                  <div className="my-3">
                    <img src={q.image_urls[0]} alt="صورة السؤال" className="max-w-full h-auto max-h-48 rounded border border-slate-200 shadow-sm" />
                  </div>
                )}
                {q.choices && q.choices.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {q.choices.map((c) => (
                      <div
                        key={c.id || c.choice_code}
                        className={`p-2.5 rounded-lg text-xs font-medium border ${
                          c.is_correct
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        ({c.choice_code}) {c.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
