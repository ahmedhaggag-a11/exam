'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Mail } from 'lucide-react';

interface TeacherProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  subjects: string[];
  grades: string[];
  created_at: string;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['الفيزياء']);
  const [selectedGrades, setSelectedGrades] = useState<string[]>(['الصف الثالث الثانوي']);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const availableSubjects = ['الفيزياء', 'الكيمياء', 'الأحياء', 'الرياضيات', 'اللغة العربية', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'التاريخ', 'الجغرافيا'];

  const fetchTeachers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'teacher')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTeachers(data as TeacherProfile[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'teacher',
          },
        },
      });

      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error('فشل الحصول على معرف الحساب التلقائي');

      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: fullName,
        role: 'teacher',
        subjects: selectedSubjects,
        grades: selectedGrades,
      });

      if (profileError) throw profileError;

      setMessage({ type: 'success', text: `تم إنشاء حساب المعلم (${fullName}) بنجاح!` });
      setFullName('');
      setEmail('');
      setPassword('');
      setModalOpen(false);
      fetchTeachers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء إنشاء حساب المعلم' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSubject = (sub: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة المعلمين والحسابات</h1>
          <p className="text-slate-500 text-sm mt-1">
            إنشاء حسابات المعلمين وتخصيص المواد الدراسية وفصل البيانات تماماً.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-blue-600/20 transition"
        >
          <UserPlus className="w-4 h-4" />
          <span>إنشاء حساب معلم جديد</span>
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold text-center ${
            message.type === 'success'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 font-bold text-sm text-slate-700">
          قائمة المعلمين المسجلين ({teachers.length})
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">جاري تحميل حسابات المعلمين...</div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            لا يوجد معلمون مسجلون حالياً. اضغط على زر "إنشاء حساب معلم جديد" للبدء.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {teachers.map((t) => (
              <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50/80 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                    {t.full_name?.charAt(0) || 'م'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{t.full_name}</h4>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                      {t.email}
                    </span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.subjects?.map((s, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  تاريخ التسجيل: {new Date(t.created_at).toLocaleDateString('ar-EG')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-slate-800 border-b border-slate-100 pb-3">
              إنشاء حساب معلم جديد
            </h3>
            <form onSubmit={handleCreateTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المعلم</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أ. أحمد حجاج"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@examforge.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">المواد المسموح للمعلم بالعمل عليها</label>
                <div className="flex flex-wrap gap-2">
                  {availableSubjects.map((sub) => {
                    const isSelected = selectedSubjects.includes(sub);
                    return (
                      <button
                        type="button"
                        key={sub}
                        onClick={() => toggleSubject(sub)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {sub}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'جاري الإنشاء...' : 'حفظ وإنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
