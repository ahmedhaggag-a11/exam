'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FileText, ExternalLink } from 'lucide-react';
import { SourceFile } from '@/types/database';

export default function TeacherSourcesPage() {
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">كتب ومصادر المادة الدراسية</h1>
        <p className="text-slate-500 text-sm mt-1">
          الملفات المرفوعة والمتاحة لحسابك والمخزنة في Supabase Storage.
        </p>
      </div>

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

                <div className="flex items-center gap-3">
                  <a
                    href={s.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>عرض الكتاب</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
