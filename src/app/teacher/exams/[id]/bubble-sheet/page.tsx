'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BubbleSheetRenderer } from '@/components/exam/BubbleSheetRenderer';
import { Printer, ArrowRight, Camera } from 'lucide-react';
import Link from 'next/link';

export default function ExamBubbleSheetPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [exam, setExam] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: examData } = await supabase
        .from('exams')
        .select('*')
        .eq('id', id)
        .single();

      if (examData) {
        setExam(examData);
        const { data: modelsData } = await supabase
          .from('exam_models')
          .select('*')
          .eq('exam_id', id)
          .order('model_code');
        setModels(modelsData || []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="p-12 text-center text-red-600 font-bold">
        ❌ الامتحان غير موجود
      </div>
    );
  }

  const activeModels = models.length > 0 ? models : [{ id: 'def', model_name: 'أ' }];

  return (
    <>
      <nav className="no-print fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 z-50 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/exams"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>رجوع للامتحانات</span>
          </Link>
          <h1 className="font-black text-slate-800 text-sm hidden sm:block truncate max-w-sm">
            طباعة أوراق البابل شيت: {exam.title}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/teacher/exams/${id}/scanner`}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <Camera className="w-4 h-4" />
            <span>فتح كاميرا التصحيح الفوري 📱</span>
          </Link>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة أوراق البابل شيت 🖨️</span>
          </button>
        </div>
      </nav>

      <div className="pt-20 pb-16 bg-slate-100 min-h-screen space-y-8 no-print-bg">
        {activeModels.map((model) => (
          <div key={model.id} className="print-page-wrapper">
            <BubbleSheetRenderer
              exam={{
                title: exam.title,
                subject: exam.subject,
                grade_level: exam.grade_level,
                models_count: exam.models_count,
              }}
              modelName={model.model_name}
              totalQuestions={exam.total_questions || 20}
              choicesCount={4}
              examId={exam.id}
            />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .no-print-bg {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body {
            padding: 0 !important;
            background: white !important;
          }
          .print-page-wrapper {
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-page-wrapper:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
        }
      `}</style>
    </>
  );
}
