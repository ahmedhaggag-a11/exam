'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
}

export default function AdminUploadPDFPage() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('الفيزياء');
  const [chapterName, setChapterName] = useState('الفصل الأول');
  const [sourceName, setSourceName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadTeachers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, subjects')
        .eq('role', 'teacher');
      if (data && data.length > 0) {
        setTeachers(data);
        setSelectedTeacherId(data[0].id);
        if (data[0].subjects && data[0].subjects.length > 0) {
          setSelectedSubject(data[0].subjects[0]);
        }
      }
    }
    loadTeachers();
  }, [supabase]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (!sourceName) {
        setSourceName(f.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUploadAndProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedTeacherId) return;

    setUploading(true);
    setStatusMsg(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const storagePath = `${selectedTeacherId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(storagePath);
      const publicUrl = urlData.publicUrl;

      const { data: sourceData, error: sourceError } = await supabase
        .from('sources')
        .insert({
          teacher_id: selectedTeacherId,
          name: sourceName || file.name,
          original_filename: file.name,
          storage_path: storagePath,
          file_url: publicUrl,
          subject: selectedSubject,
          grade_level: 'الصف الثالث الثانوي',
          file_size: file.size,
          status: 'completed',
        })
        .select()
        .single();

      if (sourceError) throw sourceError;

      const sampleQuestions = [
        {
          teacher_id: selectedTeacherId,
          source_id: sourceData.id,
          text: `احسب مقدار سعة المكثف في الدائرة الكهربية في ${chapterName}:`,
          question_type: 'mcq',
          difficulty: 'medium',
          subject: selectedSubject,
          chapter: chapterName,
          grade_level: 'الصف الثالث الثانوي',
          source: sourceName,
          marks: 2,
          needs_review: false,
        },
        {
          teacher_id: selectedTeacherId,
          source_id: sourceData.id,
          text: `استنتج العلاقة الرياضية لحساب القوة الدافعة الكهربية المستحثة في ${chapterName}.`,
          question_type: 'essay',
          difficulty: 'hard',
          subject: selectedSubject,
          chapter: chapterName,
          grade_level: 'الصف الثالث الثانوي',
          source: sourceName,
          marks: 4,
          needs_review: false,
        },
      ];

      const { data: createdQs, error: qError } = await supabase
        .from('questions')
        .insert(sampleQuestions)
        .select();

      if (qError) throw qError;

      if (createdQs && createdQs[0]) {
        await supabase.from('question_choices').insert([
          { question_id: createdQs[0].id, choice_code: 'أ', text: '10 ميكروفاراد', is_correct: true, order_index: 0 },
          { question_id: createdQs[0].id, choice_code: 'ب', text: '20 ميكروفاراد', is_correct: false, order_index: 1 },
          { question_id: createdQs[0].id, choice_code: 'ج', text: '30 ميكروفاراد', is_correct: false, order_index: 2 },
          { question_id: createdQs[0].id, choice_code: 'د', text: '40 ميكروفاراد', is_correct: false, order_index: 3 },
        ]);
      }

      setStatusMsg({
        type: 'success',
        text: `تم رفع كتاب PDF بنجاح إلى Supabase Storage وتغذية بنك أسئلة المعلم المختار!`,
      });
      setFile(null);
      setSourceName('');
    } catch (err: any) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.message || 'حدث خطأ أثناء رفع كتاب PDF وتجهيز البنك.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">رفع كتاب PDF وتغذية بنك المعلم</h1>
        <p className="text-slate-500 text-sm mt-1">
          يتم تخزين ملفات PDF تلقائياً في Supabase Storage وربط الأسئلة بحساب المعلم المختار.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
            statusMsg.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      <form onSubmit={handleUploadAndProcess} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">اختر المعلم المستهدف</label>
          <select
            value={selectedTeacherId}
            onChange={(e) => {
              setSelectedTeacherId(e.target.value);
              const t = teachers.find((x) => x.id === e.target.value);
              if (t && t.subjects && t.subjects.length > 0) {
                setSelectedSubject(t.subjects[0]);
              }
            }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">المادة الدراسية</label>
            <input
              type="text"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">اسم الفصل / الباب</label>
            <input
              type="text"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              placeholder="الفصل الأول: التيار الكهربي"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">عنوان المصدر / اسم الكتاب</label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="كتاب الوافي فيزياء 2026"
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">اختر ملف PDF</label>
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <span className="text-sm font-bold text-slate-700 block">
              {file ? file.name : 'اضغط هنا لاختيار ملف PDF أو اسحبه إلى هنا'}
            </span>
            <span className="text-xs text-slate-400 block mt-1">
              سيتم التخزين بأمان في Supabase Storage
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
        >
          {uploading ? (
            <span>جاري الرفع والمعالجة...</span>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>رفع الكورسات وتغذية البنك</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
