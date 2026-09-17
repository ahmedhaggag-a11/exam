'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PlusCircle, FileCheck, HelpCircle, FileText, Sparkles, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    questionsCount: 0,
    examsCount: 0,
    sourcesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [pRes, qRes, eRes, sRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('exams').select('id', { count: 'exact' }),
        supabase.from('sources').select('id', { count: 'exact' }),
      ]);

      setProfile(pRes.data);
      setStats({
        questionsCount: qRes.count || 0,
        examsCount: eRes.count || 0,
        sourcesCount: sRes.count || 0,
      });
      setLoading(false);
    }
    loadData();
  }, [supabase]);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            Exam Forge AI Engine v2.0
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            مرحباً بك د.{profile?.full_name || 'المعلم'}! 👋
          </h1>
          <p className="text-blue-100 text-sm leading-relaxed">
            يمكنك الآن إنشاء وتوليد الامتحانات المعتمدة في دقائق من بنك أسئلتك المخصص باستخدام الذكاء الاصطناعي مع نماذج متعددة وشريط الإجابة النموذجية.
          </p>
          <div className="pt-2">
            <Link
              href="/teacher/create-exam"
              className="inline-flex items-center gap-2 bg-white hover:bg-blue-50 text-blue-900 font-bold px-5 py-3 rounded-xl shadow-lg transition"
            >
              <PlusCircle className="w-5 h-5 text-blue-600" />
              <span>بدء إنشاء امتحان جديد</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-xl bg-blue-100 text-blue-600">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">أسئلة بنكك الخاص</span>
            <span className="text-2xl font-bold text-slate-800">
              {loading ? '...' : stats.questionsCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-xl bg-indigo-100 text-indigo-600">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">الامتحانات المحفوظة</span>
            <span className="text-2xl font-bold text-slate-800">
              {loading ? '...' : stats.examsCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-4 rounded-xl bg-emerald-100 text-emerald-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block">المصادر المتاحة</span>
            <span className="text-2xl font-bold text-slate-800">
              {loading ? '...' : stats.sourcesCount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <span>المواد الدراسية المخصصة لك</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {profile?.subjects?.map((sub: string, i: number) => (
            <span key={i} className="px-4 py-2 rounded-xl text-sm font-bold bg-blue-50 text-blue-800 border border-blue-200">
              {sub}
            </span>
          )) || <span className="text-sm text-slate-400">جاري تحميل المواد...</span>}
        </div>
      </div>
    </div>
  );
}
