'use client';

import { useState, useEffect } from 'react';
import { ExamPaperConfig, DEFAULT_PAPER_CONFIG } from '@/types/paper-config';
import {
  getPaperTemplateConfig,
  savePaperTemplateConfig,
  getTeachersListForAdmin,
} from './actions';
import { ExamPaperRenderer } from '@/components/exam/ExamPaperRenderer';
import {
  Palette,
  Layout,
  FileText,
  User,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  Sliders,
} from 'lucide-react';

interface TeacherItem {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
}

export default function AdminPaperTemplatesPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(''); // empty string = global default
  const [config, setConfig] = useState<ExamPaperConfig>(DEFAULT_PAPER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'layout' | 'header' | 'questions' | 'watermark' | 'footer'>('header');

  // Load teachers list
  useEffect(() => {
    async function init() {
      const res = await getTeachersListForAdmin();
      if (res.success && res.teachers) {
        setTeachers(res.teachers);
      }
      loadTemplate('');
    }
    init();
  }, []);

  async function loadTemplate(teacherId: string) {
    setLoading(true);
    try {
      const cfg = await getPaperTemplateConfig(teacherId || undefined);
      setConfig(cfg);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleTeacherSelect(tId: string) {
    setSelectedTeacherId(tId);
    loadTemplate(tId);
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);
    try {
      const res = await savePaperTemplateConfig(config, selectedTeacherId || undefined);
      if (res.success) {
        const teacherObj = teachers.find(t => t.id === selectedTeacherId);
        setToast({
          type: 'success',
          text: selectedTeacherId
            ? `تم حفظ التنسيق المخصص لحساب المعلم (${teacherObj?.full_name || 'المعلم'}) بنجاح!`
            : 'تم حفظ القالب العام الموحد لجميع الامتحانات بنجاح!',
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (confirm('هل أنت متأكد من استعادة الإعدادات الافتراضية للقالب؟')) {
      setConfig(DEFAULT_PAPER_CONFIG);
    }
  }

  // Mock exam data for live preview
  const previewExam = {
    title: 'امتحان نهاية الفصل الدراسي الأول',
    subject: 'الفيزياء',
    grade_level: 'الصف الثالث الثانوي',
    duration_minutes: 60,
    total_marks: 30,
    exam_date: new Date().toISOString(),
    instructions: 'أجب عن جميع الأسئلة، واستعن بالقوانين المرفقة إن لزم الأمر.',
  };

  const previewQuestions = [
    {
      id: 'q1',
      text: 'في الدائرة الكهربائية الموضحة بالشكل، إذا زادت قيمة المقاومة المتغيرة (S)، فإن قراءة الفولتميتر:',
      question_type: 'mcq',
      marks: 2,
      choices: [
        { id: 'c1', choice_code: 'أ', text: 'تزداد' },
        { id: 'c2', choice_code: 'ب', text: 'تقل' },
        { id: 'c3', choice_code: 'ج', text: 'تظل ثابتة' },
        { id: 'c4', choice_code: 'د', text: 'تنعدم' },
      ],
    },
    {
      id: 'q2',
      text: 'يتولد تيار كهربي مستحث يعاكس التغير المسبب له وفقاً لقاعدة لنز.',
      question_type: 'true_false',
      marks: 1,
    },
    {
      id: 'q3',
      text: 'علل: لا يمر تيار مستمر في الدائرة التي تحتوي على مكثف بعد تمام شحنه؟',
      question_type: 'essay',
      marks: 3,
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Sliders className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-black text-slate-800">
              تخصيص شكل ورقة الامتحان (Flexibility Paper Studio)
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            تحكم كامل ومرن في ترويسة الورقة، الهوامش، نمط الخط، أسلوب الأسئلة، والعلامة المائية، إما كقالب موحد أو مخصص لكل معلم.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ التنسيق الآن'}</span>
          </button>
        </div>
      </div>

      {/* Target Teacher Selector Bar */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="w-6 h-6 text-blue-300 shrink-0" />
          <div>
            <h3 className="font-bold text-sm">اختر الحساب المستهدف للتخصيص:</h3>
            <p className="text-xs text-blue-200">
              يمكنك عمل قالب عام للجميع أو اختيار مدرس بعينه لتخصيص ورقته باسمه ومدرسته وعلامته المائية.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-80">
          <select
            value={selectedTeacherId}
            onChange={(e) => handleTeacherSelect(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white text-slate-800 font-bold text-sm outline-none border-2 border-blue-400 focus:ring-2 focus:ring-white shadow"
          >
            <option value="">🌐 القالب العام الموحد (لجميع المدرسين)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                👤 حساب مخصص: {t.full_name} ({t.subjects.join('، ') || 'معلم'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Studio Grid: Controls on the Right (Arabic RTL), Live Preview on the Left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setActiveTab('header')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'header' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>الترويسة والبيانات</span>
            </button>
            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'layout' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>الإطار والخطوط</span>
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'questions' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>تنسيق الأسئلة</span>
            </button>
            <button
              onClick={() => setActiveTab('watermark')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'watermark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>العلامة المائية</span>
            </button>
            <button
              onClick={() => setActiveTab('footer')}
              className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                activeTab === 'footer' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>التذييل</span>
            </button>
          </div>

          {/* Tab Content Box */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-sm">
            {/* 1. HEADER TAB */}
            {activeTab === 'header' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                  <span>نمط الترويسة العليا (Header Style)</span>
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">شكل الترويسة:</label>
                  <select
                    value={config.headerStyle}
                    onChange={(e) => setConfig({ ...config, headerStyle: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="formal">رسمي وزاري (3 أعمدة: وزارة/مدرسة - عنوان ونموذج - معلومات وزمن)</option>
                    <option value="boxed">صندوق مؤطر (جدول منظم أنيق)</option>
                    <option value="modern-gradient">عصري حديث (شريط ملون مع اسم السنتر)</option>
                    <option value="standard">قياسي بسيط (أعلى الورقة مدمج)</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">السطر الأول (الدولة والوزارة):</label>
                    <input
                      type="text"
                      value={config.header.ministryLine}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          header: { ...config.header, ministryLine: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      placeholder="جمهورية مصر العربية"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">المديرية / المحافظة:</label>
                    <input
                      type="text"
                      value={config.header.directorate}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          header: { ...config.header, directorate: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      placeholder="مديرية التربية والتعليم"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الإدارة التعليمية:</label>
                    <input
                      type="text"
                      value={config.header.administration}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          header: { ...config.header, administration: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      placeholder="إدارة شرق التعليمية"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم المدرسة أو السنتر:</label>
                    <input
                      type="text"
                      value={config.header.schoolOrCenterName}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          header: { ...config.header, schoolOrCenterName: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-blue-900"
                      placeholder="أكاديمية النجاح / مدرسة الأوائل"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المعلم المطبوع بالورقة (اختياري):
                  </label>
                  <input
                    type="text"
                    value={config.header.teacherName}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        header: { ...config.header, teacherName: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    placeholder="أ. أحمد حجاج (خبير المادة)"
                  />
                </div>

                {/* Header Toggles */}
                <div className="border-t pt-3 space-y-2">
                  <span className="text-xs font-bold text-slate-800 block mb-1">عناصر الترويسة الظاهرة:</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.header.showDuration}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            header: { ...config.header, showDuration: e.target.checked },
                          })
                        }
                        className="rounded text-blue-600 w-4 h-4"
                      />
                      <span>عرض زمن الامتحان</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.header.showTotalMarks}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            header: { ...config.header, showTotalMarks: e.target.checked },
                          })
                        }
                        className="rounded text-blue-600 w-4 h-4"
                      />
                      <span>عرض الدرجة الكلية</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.header.showExamDate}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            header: { ...config.header, showExamDate: e.target.checked },
                          })
                        }
                        className="rounded text-blue-600 w-4 h-4"
                      />
                      <span>عرض تاريخ الامتحان</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.header.showStudentInfoBox}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            header: { ...config.header, showStudentInfoBox: e.target.checked },
                          })
                        }
                        className="rounded text-blue-600 w-4 h-4"
                      />
                      <span>صندوق بيانات الطالب (الاسم ورقم الجلوس)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 2. LAYOUT & FONTS TAB */}
            {activeTab === 'layout' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">تنسيق الصفحة والإطار العام</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">إطار الصفحة (Border):</label>
                    <select
                      value={config.pageBorder}
                      onChange={(e) => setConfig({ ...config, pageBorder: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="single">إطار مفرد كلاسيكي (رسمي)</option>
                      <option value="double">إطار مزدوج فاخر (Double)</option>
                      <option value="rounded">إطار ذو حواف منحنية (Rounded)</option>
                      <option value="none">بدون إطار خارجي</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">نوع الخط العربي:</label>
                    <select
                      value={config.fontFamily}
                      onChange={(e) => setConfig({ ...config, fontFamily: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="Tajawal">تجوال (Tajawal - حديث وواضح)</option>
                      <option value="Cairo">كايرو (Cairo - عريض وقوي)</option>
                      <option value="Amiri">أميري (Amiri - كلاسيكي عريق)</option>
                      <option value="Traditional Arabic">الخط العربي التقليدي</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تقسيم الأعمدة:</label>
                    <select
                      value={config.columns}
                      onChange={(e) => setConfig({ ...config, columns: Number(e.target.value) as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value={1}>عمود واحد كامل (واسع ومريح)</option>
                      <option value={2}>عمودين متجاورين (يوفر الورق بنسبة 40%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">حجم الخط الأساسي:</label>
                    <select
                      value={config.fontSize}
                      onChange={(e) => setConfig({ ...config, fontSize: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="sm">صغير ومدمج (مكثف)</option>
                      <option value="base">متوسط قياسي (موصى به)</option>
                      <option value="lg">كبير وواضح للمراحل المبكرة</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">لون التمييز الرئيسي (Theme Color):</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={config.themeColor}
                      onChange={(e) => setConfig({ ...config, themeColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300 p-0.5"
                    />
                    <span className="text-xs text-slate-600 font-mono font-bold">{config.themeColor}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. QUESTIONS TAB */}
            {activeTab === 'questions' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">خيارات ترقيم وتنسيق الأسئلة</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">أسلوب ترقيم السؤال:</label>
                    <select
                      value={config.questions.numberingStyle}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          questions: { ...config.questions, numberingStyle: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="numeric">أرقام بين قوسين: (1)، (2)</option>
                      <option value="q-number">رمز السؤال: س1: ، س2:</option>
                      <option value="arabic-alpha">حروف عربية: أ) ، ب)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">رموز بدائل الاختيارات:</label>
                    <select
                      value={config.questions.choicesBullet}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          questions: { ...config.questions, choicesBullet: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="arabic-letters">حروف عربية: (أ، ب، ج، د)</option>
                      <option value="english-letters">حروف إنجليزية: (A, B, C, D)</option>
                      <option value="circles">أرقام دائرية: (①, ②, ③, ④)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">توزيع خيارات MCQ:</label>
                    <select
                      value={config.questions.choicesLayout}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          questions: { ...config.questions, choicesLayout: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="auto">تلقائي ذكي (أفقي أو شبكي)</option>
                      <option value="grid-2">شبكة ثنائية (خيارين بالسطر)</option>
                      <option value="grid-4">سطر واحد (4 خيارات أفقياً)</option>
                      <option value="vertical">رأسي (كل خيار في سطر)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">التباعد بين الأسئلة:</label>
                    <select
                      value={config.questions.spacing}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          questions: { ...config.questions, spacing: e.target.value as any },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                    >
                      <option value="compact">مضغوط (Compact - توفير ورق)</option>
                      <option value="normal">عادي متوازن (Normal)</option>
                      <option value="spacious">متباعد مريح للعين (Spacious)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        أسطر إجابة الأسئلة المقالية:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={config.questions.essayLinesCount}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            questions: {
                              ...config.questions,
                              essayLinesCount: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">شكل أسطر الإجابة:</label>
                      <select
                        value={config.questions.essayLineStyle}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            questions: {
                              ...config.questions,
                              essayLineStyle: e.target.value as any,
                            },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                      >
                        <option value="dashed">متقطع (Dashed)</option>
                        <option value="dotted">منقط (Dotted)</option>
                        <option value="solid">خط متصل (Solid)</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.questions.showQuestionMarks}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          questions: {
                            ...config.questions,
                            showQuestionMarks: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>إظهار درجة السؤال بجواره [درجتين]</span>
                  </label>
                </div>
              </div>
            )}

            {/* 4. WATERMARK TAB */}
            {activeTab === 'watermark' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2 flex items-center justify-between">
                  <span>العلامة المائية في خلفية الامتحان</span>
                  <label className="flex items-center gap-2 text-xs font-bold text-blue-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.watermark.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          watermark: { ...config.watermark, enabled: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>تفعيل العلامة المائية</span>
                  </label>
                </h3>

                {config.watermark.enabled && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نص العلامة المائية (اسم المدرس أو السنتر):
                      </label>
                      <input
                        type="text"
                        value={config.watermark.text}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            watermark: { ...config.watermark, text: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-800"
                        placeholder="الأستاذ أحمد حجاج / ExamForge"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          درجة الشفافية ({Math.round(config.watermark.opacity * 100)}%):
                        </label>
                        <input
                          type="range"
                          min="0.03"
                          max="0.25"
                          step="0.01"
                          value={config.watermark.opacity}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              watermark: {
                                ...config.watermark,
                                opacity: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          زاوية الميل ({config.watermark.angle}°):
                        </label>
                        <input
                          type="range"
                          min="-45"
                          max="0"
                          step="5"
                          value={config.watermark.angle}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              watermark: {
                                ...config.watermark,
                                angle: parseInt(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. FOOTER TAB */}
            {activeTab === 'footer' && (
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">تذييل ورقة الامتحان (Footer)</h3>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عبارة التمنيات بالنجاح (أسفل الورقة):
                  </label>
                  <input
                    type="text"
                    value={config.footer.customFooterText}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        footer: { ...config.footer, customFooterText: e.target.value },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold"
                    placeholder="مع تمنياتنا لجميع الطلاب بالتوفيق والدرجات النهائية"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.footer.showPageNumber}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          footer: { ...config.footer, showPageNumber: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>إظهار رقم الصفحة</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.footer.showModelName}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          footer: { ...config.footer, showModelName: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>إظهار رمز النموذج (أ/ب/ج)</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 sticky top-4">
          <div className="bg-slate-800 text-white p-3 rounded-t-2xl flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <span>معاينة حية ومباشرة لشكل الورقة المطبوعة (A4 Live Preview)</span>
            </span>
            <span className="bg-slate-700 px-2.5 py-1 rounded-md text-[11px] text-slate-300 font-mono">
              {config.columns === 2 ? 'عمودين (Two Columns)' : 'عمود واحد (Full Width)'}
            </span>
          </div>

          <div className="bg-slate-200 p-4 sm:p-6 rounded-b-2xl border border-slate-300 max-h-[85vh] overflow-y-auto">
            <ExamPaperRenderer
              config={config}
              exam={previewExam}
              modelName="أ"
              questions={previewQuestions}
              isPreview={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
