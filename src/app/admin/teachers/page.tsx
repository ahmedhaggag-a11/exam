'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Mail, Edit2 } from 'lucide-react';

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
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subjectsText, setSubjectsText] = useState('الفيزياء');
  const [gradesText, setGradesText] = useState('الصف الثالث الثانوي');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  const quickSubjects = ['الفيزياء', 'الكيمياء', 'الأحياء', 'الرياضيات', 'اللغة العربية', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'التاريخ', 'الجغرافيا'];
  const quickGrades = ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'];

  function parseList(text: string): string[] {
    return text
      .split(/[,،\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function toggleItemInText(currentText: string, item: string): string {
    const list = parseList(currentText);
    if (list.includes(item)) {
      return list.filter((x) => x !== item).join('، ');
    } else {
      return [...list, item].join('، ');
    }
  }

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

  const openCreateModal = () => {
    setEditingTeacher(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setSubjectsText('الفيزياء');
    setGradesText('الصف الثالث الثانوي');
    setModalOpen(true);
  };

  const openEditModal = (t: TeacherProfile) => {
    setEditingTeacher(t);
    setFullName(t.full_name || '');
    setEmail(t.email || '');
    setPassword('');
    setSubjectsText((t.subjects || []).join('، '));
    setGradesText((t.grades || []).join('، '));
    setModalOpen(true);
  };

  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const parsedSubjects = parseList(subjectsText);
    const parsedGrades = parseList(gradesText);

    if (parsedSubjects.length === 0) {
      setMessage({ type: 'error', text: 'يرجى كتابة مادة واحدة على الأقل في حقل المواد' });
      setSubmitting(false);
      return;
    }

    if (parsedGrades.length === 0) {
      setMessage({ type: 'error', text: 'يرجى كتابة سنة دراسية واحدة على الأقل في حقل السنوات الدراسية' });
      setSubmitting(false);
      return;
    }

    try {
      const { createTeacherAccount, updateTeacherAccount } = await import('./actions');

      if (editingTeacher) {
        const result = await updateTeacherAccount({
          id: editingTeacher.id,
          fullName,
          subjects: parsedSubjects,
          grades: parsedGrades,
          password: password.trim() ? password : undefined,
        });

        if (!result.success) throw new Error(result.error);
        setMessage({ type: 'success', text: `تم تحديث بيانات المعلم (${fullName}) بنجاح!` });
      } else {
        const result = await createTeacherAccount({
          email,
          password,
          fullName,
          subjects: parsedSubjects,
          grades: parsedGrades,
        });

        if (!result.success) throw new Error(result.error);
        setMessage({ type: 'success', text: `تم إنشاء حساب المعلم (${fullName}) بنجاح! يمكنه تسجيل الدخول فوراً.` });
      }

      setModalOpen(false);
      fetchTeachers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ بيانات المعلم' });
    } finally {
      setSubmitting(false);
    }
  };

  const currentParsedGrades = parseList(gradesText);
  const currentParsedSubjects = parseList(subjectsText);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة المعلمين والحسابات</h1>
          <p className="text-slate-500 text-sm mt-1">
            إنشاء حسابات المعلمين وتخصيص المواد والصفوف الدراسية وإدارتها بنصوص مخصصة.
          </p>
        </div>
        <button
          onClick={openCreateModal}
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
              <div key={t.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
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
                      {t.grades?.map((g, i) => (
                        <span key={i} className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          🎓 {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <span className="text-xs text-slate-400">
                    {new Date(t.created_at).toLocaleDateString('ar-EG')}
                  </span>
                  <button
                    onClick={() => openEditModal(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 transition border border-slate-200"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <h3 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3">
              {editingTeacher ? `تعديل بيانات المعلم: ${editingTeacher.full_name}` : 'إنشاء حساب معلم جديد'}
            </h3>

            <form onSubmit={handleSaveTeacher} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المعلم</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="أ. أحمد حجاج"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  required
                  disabled={!!editingTeacher}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@examforge.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {editingTeacher ? 'كلمة المرور الجديدة (اتركها فارغة إذا لم ترغب في التغيير)' : 'كلمة المرور'}
                </label>
                <input
                  type="password"
                  required={!editingTeacher}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingTeacher ? '••••••••' : 'كلمة المرور لا تقل عن 6 أحرف'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* ─── Text Input for Grades ─── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  السنوات الدراسية التي يدرسها المعلم (نص)
                </label>
                <input
                  type="text"
                  value={gradesText}
                  onChange={(e) => setGradesText(e.target.value)}
                  placeholder="مثال: الصف الأول الثانوي، الصف الثاني الثانوي (افصل بينها بفاصلة)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-bold text-slate-400">إضافة سريعة:</span>
                  {quickGrades.map((grade) => {
                    const isSelected = currentParsedGrades.includes(grade);
                    return (
                      <button
                        type="button"
                        key={grade}
                        onClick={() => setGradesText(toggleItemInText(gradesText, grade))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🎓 {grade}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── Text Input for Subjects ─── */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المواد المسموح للمعلم بالعمل عليها (نص)
                </label>
                <input
                  type="text"
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  placeholder="مثال: الفيزياء، الكيمياء، الرياضيات (افصل بينها بفاصلة)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-blue-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] font-bold text-slate-400">إضافة سريعة:</span>
                  {quickSubjects.map((sub) => {
                    const isSelected = currentParsedSubjects.includes(sub);
                    return (
                      <button
                        type="button"
                        key={sub}
                        onClick={() => setSubjectsText(toggleItemInText(subjectsText, sub))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
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
                  className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black shadow-md shadow-blue-600/20 transition disabled:opacity-50"
                >
                  {submitting ? 'جاري الحفظ...' : editingTeacher ? 'حفظ التعديلات' : 'حفظ وإنشاء الحساب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
