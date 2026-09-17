'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, FileText, HelpCircle, FileCheck, Plus, Upload } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    teachersCount: 0,
    sourcesCount: 0,
    questionsCount: 0,
    examsCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function loadStats() {
      try {
        const [teachers, sources, questions, exams] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'teacher'),
          supabase.from('sources').select('id', { count: 'exact' }),
          supabase.from('questions').select('id', { count: 'exact' }),
          supabase.from('exams').select('id', { count: 'exact' }),
        ]);

        setStats({
          teachersCount: teachers.count || 0,
          sourcesCount: sources.count || 0,
          questionsCount: questions.count || 0,
          examsCount: exams.count || 0,
        });
      } catch (e) {
        console.error('Error loading admin stats:', e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [supabase]);

  const cards = [
    { title: 'إجمالي المعلمين', value: stats.teachersCount, icon: Users, color: 'bg-blue-500' },
    { title: 'الكتب والمصادر', value: stats.sourcesCount, icon: FileText, color: 'bg-emerald-500' },
    { title: 'أسئلة البنك', value: stats.questionsCount, icon: HelpCircle, color: 'bg-amber-500' },
    { title: 'الامتحانات المبتكرة', value: stats.examsCount, icon: FileCheck, color: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">نظرة عامة على منصة الامتحانات</h1>
        <p className="text-slate-500 text-sm mt-1">
          إدارة المعلمين، رفع المصادر، وتغذية بنوك الأسئلة المخصصة لكل حساب.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4"
            >
              <div className={`p-4 rounded-xl text-white ${card.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-400 block">{card.title}</span>
                <span className="text-2xl font-bold text-slate-800">
                  {loading ? '...' : card.value.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-slate-800">إجراءات إدارية سريعة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/teachers"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block text-sm">إضافة حساب معلم جديد</span>
                <span className="text-xs text-slate-500">إنشاء اسم المستخدم وتحديد المواد المتاحة</span>
              </div>
            </div>
          </Link>

          <Link
            href="/admin/upload-pdf"
            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition group"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-800 block text-sm">رفع كتاب PDF للمدرس</span>
                <span className="text-xs text-slate-500">رفع الملف إلى Supabase Storage وتغذية البنك</span>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
