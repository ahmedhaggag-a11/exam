'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Exam {
  id: string;
  title: string;
  grade: string;
  duration: number;
  exam_date: string | null;
  total_mark: number;
  models_count: number;
  status: string;
  created_at: string;
  subjects?: { name: string };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'مسودة', color: 'bg-yellow-100 text-yellow-700' },
  published: { label: 'منشور', color: 'bg-green-100 text-green-700' },
  archived: { label: 'مؤرشف', color: 'bg-gray-100 text-gray-600' },
};

export default function ExamsPage() {
  const supabase = createClient();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadExams(); }, []);

  async function loadExams() {
    setLoading(true);
    const { data } = await supabase
      .from('exams')
      .select('*, subjects(name)')
      .order('created_at', { ascending: false });
    setExams(data || []);
    setLoading(false);
  }

  async function deleteExam(id: string) {
    if (!confirm('هل أنت متأكد من حذف هذا الامتحان؟')) return;
    setDeleting(id);
    await supabase.from('exams').delete().eq('id', id);
    setExams(prev => prev.filter(e => e.id !== id));
    setDeleting(null);
  }

  const filtered = exams.filter(e =>
    e.title.includes(search) || e.grade?.includes(search) || e.subjects?.name?.includes(search)
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">امتحاناتي</h1>
        <Link href="/teacher/create-exam"
          className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + إنشاء امتحان جديد
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بعنوان الامتحان أو الصف أو المادة..."
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-12 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-lg font-medium text-gray-600 mb-1">لا توجد امتحانات بعد</p>
          <p className="text-sm text-gray-400 mb-4">ابدأ بإنشاء أول امتحان من بنك أسئلتك</p>
          <Link href="/teacher/create-exam"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            إنشاء امتحان الآن
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(exam => (
            <div key={exam.id} className="bg-white rounded-xl shadow hover:shadow-md transition p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-800 truncate">{exam.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[exam.status]?.color || 'bg-gray-100'}`}>
                    {STATUS_LABELS[exam.status]?.label || exam.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                  {exam.subjects?.name && <span>📚 {exam.subjects.name}</span>}
                  {exam.grade && <span>🏫 {exam.grade}</span>}
                  <span>⏱️ {exam.duration} دقيقة</span>
                  <span>💯 {exam.total_mark} درجة</span>
                  <span>📋 {exam.models_count} نماذج</span>
                  {exam.exam_date && <span>📅 {new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>}
                  <span>🕐 {new Date(exam.created_at).toLocaleDateString('ar-EG')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/teacher/exams/${exam.id}/edit`}
                  className="px-3 py-1.5 border border-blue-200 text-blue-700 rounded-lg text-xs hover:bg-blue-50 transition">
                  ✏️ تعديل
                </Link>
                <Link href={`/teacher/exams/${exam.id}/print`} target="_blank"
                  className="px-3 py-1.5 border border-green-200 text-green-700 rounded-lg text-xs hover:bg-green-50 transition">
                  🖨️ طباعة
                </Link>
                <button onClick={() => deleteExam(exam.id)} disabled={deleting === exam.id}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs hover:bg-red-50 transition disabled:opacity-50">
                  {deleting === exam.id ? '...' : '🗑️ حذف'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
