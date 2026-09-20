'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Filter, Search } from 'lucide-react';
import { Question } from '@/types/database';

export default function TeacherQuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
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

  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.text.toLowerCase().includes(searchTerm.toLowerCase()) || q.chapter.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || q.question_type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">بنك أسئلتي المخصص</h1>
          <p className="text-slate-500 text-sm mt-1">
            جميع الأسئلة المتاحة لحسابك والمعزولة تماماً عن بقية المعلمين.
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث في نص السؤال أو الفصل..."
            className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">جميع أنواع الأسئلة</option>
            <option value="mcq">اختيار من متعدد (MCQ)</option>
            <option value="essay">أسئلة مقالية (Essay)</option>
            <option value="true_false">صح أو خطأ</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm text-slate-700">
          الأسئلة المطابقة للبحث ({filteredQuestions.length})
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل أسئلة البنك...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            لا توجد أسئلة مطابقة للبحث حالياً.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((q, idx) => (
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
                      {q.chapter}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">الدرجة: {q.marks}</span>
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
