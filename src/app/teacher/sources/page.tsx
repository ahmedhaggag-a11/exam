'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, ExternalLink, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { SourceFile } from '@/types/database';

export default function TeacherSourcesPage() {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSources() {
      setLoading(true);
      const { data } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setSources(data as SourceFile[]);
      }
      setLoading(false);
    }
    fetchSources();
  }, [supabase]);

  const handleDelete = async (sourceId: string) => {
    setDeletingId(sourceId);
    setConfirmId(null);
    try {
      // 1. Delete all question choices linked to questions of this source
      const { data: questions } = await supabase
        .from('questions')
        .select('id')
        .eq('source_id', sourceId);

      if (questions && questions.length > 0) {
        const qIds = questions.map((q: any) => q.id);
        await supabase.from('question_choices').delete().in('question_id', qIds);
      }

      // 2. Delete all questions linked to this source
      await supabase.from('questions').delete().eq('source_id', sourceId);

      // 3. Delete the source record itself
      await supabase.from('sources').delete().eq('id', sourceId);

      // 4. Remove from local state
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
    } catch (err) {
      console.error('Error deleting source:', err);
      alert('حدث خطأ أثناء حذف المصدر. يرجى المحاولة مرة أخرى.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">كتب ومصادر المادة الدراسية</h1>
        <p className="text-slate-500 text-sm mt-1">
          الملفات المرفوعة والمتاحة لحسابك والمخزنة في Supabase Storage.
        </p>
      </div>

      {/* Confirm Dialog Overlay */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 max-w-sm w-full mx-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base">تأكيد الحذف النهائي</h3>
                <p className="text-xs text-slate-500 mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-6">
              سيتم حذف هذا المصدر وجميع الأسئلة المرتبطة به نهائياً من بنك الأسئلة.
              <br />
              <span className="font-bold text-red-600">هل أنت متأكد؟</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(confirmId)}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition"
              >
                نعم، احذف نهائياً
              </button>
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm text-slate-700">
          المصادر المتاحة ({sources.length})
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل المصادر والكتب...</div>
        ) : sources.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            لا توجد كتب PDF مرفوعة لحسابك حالياً. يرجى التواصل مع المسؤول (Admin) لرفع الكتب والمصادر.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sources.map((s) => (
              <div key={s.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{s.name}</h4>
                    <span className="text-xs text-slate-500 block mt-0.5">
                      المادة: {s.subject} • الملف: {s.original_filename}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>عرض الكتاب</span>
                  </a>

                  <button
                    onClick={() => setConfirmId(s.id)}
                    disabled={deletingId === s.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition disabled:opacity-50"
                    title="حذف المصدر وجميع أسئلته"
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>{deletingId === s.id ? 'جاري الحذف...' : 'حذف'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
