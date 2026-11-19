'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ExamPaperConfig, DEFAULT_PAPER_CONFIG } from '@/types/paper-config';
import {
  getPaperTemplateConfig,
  savePaperTemplateConfig,
} from '@/app/admin/paper-templates/actions';
import { ExamPaperRenderer } from '@/components/exam/ExamPaperRenderer';
import {
  Palette,
  Layout,
  FileText,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  Sliders,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

export default function TeacherPaperTemplatePage() {
  const [config, setConfig] = useState<ExamPaperConfig>(DEFAULT_PAPER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'header' | 'layout' | 'questions' | 'watermark' | 'footer'>('header');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [teacherName, setTeacherName] = useState<string>('');

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      // Load teacher profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, subjects')
        .eq('id', user.id)
        .single();

      if (profile?.full_name) {
        setTeacherName(profile.full_name);
      }

      try {
        const savedCfg = await getPaperTemplateConfig(user.id);
        if (profile?.full_name && !savedCfg.header.teacherName) {
          savedCfg.header.teacherName = profile.full_name;
        }
        setConfig(savedCfg);
      } catch (err) {
        console.warn('Could not load custom config, using default', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supabase]);

  async function handleSave() {
    if (!currentUserId) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await savePaperTemplateConfig(config, currentUserId);
      if (res.success) {
        setToast({
          type: 'success',
          text: 'تم حفظ شكل وتنسيق ورقة الامتحان الخاص بك بنجاح! سيتم اعتماده تلقائياً في جميع امتحاناتك المطبوعة.',
        });
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setToast({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ القالب' });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (confirm('هل أنت متأكد من استعادة التنسيق الافتراضي للورقة؟')) {
      setConfig(DEFAULT_PAPER_CONFIG);
    }
  }

  // Mock exam data for live preview
  const previewExam = {
    title: 'امتحان نهاية الفصل الدراسي الأول',
    subject: 'الفيزياء للثانوية العامة',
    grade_level: 'الصف الثالث الثانوي',
    duration_minutes: 60,
    total_marks: 60,
    instructions: 'أجب عن جميع الأسئلة الآتية مع توضيح خطوات الحل والتظليل في ورقة الإجابة.',
  };

  const previewQuestions = [
    {
      id: 'prev-1',
      text: 'في الدائرة الكهربية الموضحة، إذا كانت قراءة الفولتميتر 12V، فما قيمة شدة التيار المار في المقاومة R؟',
      question_type: 'mcq',
      marks: 2,
      chapter: 'الفصل الأول: التيار الكهربي وقانون أوم',
      choices: [
        { id: 'c1', choice_code: 'أ', text: '2 أمبير', is_correct: false },
        { id: 'c2', choice_code: 'ب', text: '4 أمبير (الإجابة الصحيحة)', is_correct: true },
        { id: 'c3', choice_code: 'ج', text: '6 أمبير', is_correct: false },
        { id: 'c4', choice_code: 'د', text: '8 أمبير', is_correct: false },
      ],
    },
    {
      id: 'prev-2',
      text: 'علل: تقل القوة الدافعة الكهربية المستحثة المتولدة في ملف عند إدخال قلب من الحديد المطاوع به عند خروج القلب.',
      question_type: 'essay',
      marks: 4,
      chapter: 'الفصل الثالث: الحث الكهرومغناطيسي',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-700 rounded-2xl shadow-xs">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800">
              تخصيص شكل ورقة الامتحان 📄🎨
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              خصّص شكل الهيدر، اللوجو، الأعمدة، الألوان، العلامة المائية، وكود الـ QR الخاص بك لكل ورقة امتحان تطبعها.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-600/20 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ شكل الورقة الآن'}</span>
          </button>
        </div>
      </div>

      {toast && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 shadow-xs animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : 'bg-red-50 text-red-800 border border-red-300'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Main Studio Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold overflow-x-auto">
            <button
              onClick={() => setActiveTab('header')}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'header'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>الترويسة (الهيدر)</span>
            </button>

            <button
              onClick={() => setActiveTab('layout')}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'layout'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>الأعمدة والإطار</span>
            </button>

            <button
              onClick={() => setActiveTab('watermark')}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'watermark'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>العلامة المائية</span>
            </button>

            <button
              onClick={() => setActiveTab('footer')}
              className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 whitespace-nowrap ${
                activeTab === 'footer'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>الفوتر و QR</span>
            </button>
          </div>

          {/* TAB 1: HEADER CONTROLS */}
          {activeTab === 'header' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">نمط الترويسة العليا:</label>
                <select
                  value={config.headerStyle}
                  onChange={(e) => setConfig({ ...config, headerStyle: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="formal">رسمي وزاري (3 أعمدة: وزارة/مدرسة - عنوان ونموذج - معلومات وزمن)</option>
                  <option value="boxed">صندوق مؤطر (جدول منظم أنيق)</option>
                  <option value="modern-gradient">عصري حديث (شريط ملون مع اسم السنتر)</option>
                  <option value="standard">قياسي بسيط (أعلى الورقة مدمج)</option>
                  <option value="minimal">مينيمال مختصر</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم المعلم المطبوع بالورقة:
                </label>
                <input
                  type="text"
                  value={config.header.teacherName || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      header: { ...config.header, teacherName: e.target.value },
                    })
                  }
                  placeholder={teacherName || 'أ. أحمد حجاج (خبير المادة)'}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المدرسة أو السنتر:</label>
                <input
                  type="text"
                  value={config.header.schoolOrCenterName || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      header: { ...config.header, schoolOrCenterName: e.target.value },
                    })
                  }
                  placeholder="أكاديمية المتفوقين / سنتر الأوائل"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السطر الأول (الدولة والوزارة):</label>
                <input
                  type="text"
                  value={config.header.ministryLine || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      header: { ...config.header, ministryLine: e.target.value },
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  placeholder="جمهورية مصر العربية - وزارة التربية والتعليم"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رابط صورة اللوجو (Logo URL):</label>
                <input
                  type="url"
                  value={config.header.logoUrl || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      header: { ...config.header, logoUrl: e.target.value },
                    })
                  }
                  placeholder="https://.../my-logo.png"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500"
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
                      checked={config.header.showStudentInfoBox}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          header: { ...config.header, showStudentInfoBox: e.target.checked },
                        })
                      }
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>صندوق بيانات الطالب (الاسم والجلوس)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LAYOUT & COLUMNS */}
          {activeTab === 'layout' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">تقسيم الأعمدة:</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, columns: 1 })}
                    className={`p-3 rounded-2xl border text-center transition ${
                      config.columns === 1
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-sm font-black block">عمود واحد (صف كامل)</span>
                    <span className="text-[11px] text-slate-400">مناسب للمسائل الطويلة والشرح المفصل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, columns: 2 })}
                    className={`p-3 rounded-2xl border text-center transition ${
                      config.columns === 2
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="text-sm font-black block">عمودان (صفين في الورقة) ✂️</span>
                    <span className="text-[11px] text-slate-400">توفير 40% إلى 50% من الورق أثناء الطباعة بالسنتر</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">إطار الصفحة (Border):</label>
                  <select
                    value={config.pageBorder}
                    onChange={(e) => setConfig({ ...config, pageBorder: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="single">إطار مفرد كلاسيكي (رسمي)</option>
                    <option value="double">إطار مزدوج فاخر (Double)</option>
                    <option value="rounded">إطار ذو حواف منحنية (Rounded)</option>
                    <option value="none">بدون إطار خارجي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حجم الخط الأساسي:</label>
                  <select
                    value={config.fontSize}
                    onChange={(e) => setConfig({ ...config, fontSize: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
                  >
                    <option value="sm">صغير ومدمج (مكثف)</option>
                    <option value="base">متوسط قياسي (موصى به)</option>
                    <option value="lg">كبير وواضح للمراحل المبكرة</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">لون العناوين والأطر الرئيسية:</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.themeColor || '#1e3a8a'}
                    onChange={(e) => setConfig({ ...config, themeColor: e.target.value })}
                    className="w-10 h-10 rounded-xl cursor-pointer border border-slate-300 p-0.5"
                  />
                  <span className="text-xs font-mono text-slate-600 font-bold">
                    {config.themeColor || '#1e3a8a'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WATERMARK & BACKGROUND */}
          {activeTab === 'watermark' && (
            <div className="space-y-6">
              {/* Background Image Upload */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">🖼️ صورة خلفية للامتحان (خاصة بك)</span>
                    <span className="text-[11px] text-slate-400">
                      ارفع صورة شعار أو تصميم خلفية لتظهر خفيفة في جميع صفحات الامتحان.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.backgroundImage?.enabled ?? false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        backgroundImage: {
                          enabled: e.target.checked,
                          url: config.backgroundImage?.url || '',
                          opacity: config.backgroundImage?.opacity ?? 0.07,
                          size: config.backgroundImage?.size ?? 'cover',
                        },
                      })
                    }
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                {config.backgroundImage?.enabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">اختر صورة الخلفية من جهازك:</label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div className="flex-1 px-4 py-3 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl bg-white text-center text-xs font-semibold text-slate-500 hover:text-blue-600 transition cursor-pointer">
                          {config.backgroundImage?.url ? '✅ تم اختيار صورة — اضغط لتغييرها' : '📂 اضغط هنا لرفع صورة الخلفية (PNG / JPG)'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                setConfig({
                                  ...config,
                                  backgroundImage: {
                                    enabled: true,
                                    url: ev.target?.result as string,
                                    opacity: config.backgroundImage?.opacity ?? 0.07,
                                    size: config.backgroundImage?.size ?? 'cover',
                                  },
                                });
                              };
                              reader.readAsDataURL(f);
                            }}
                          />
                        </div>
                        {config.backgroundImage?.url && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfig({
                                ...config,
                                backgroundImage: { ...config.backgroundImage!, url: '' },
                              })
                            }
                            className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl border border-red-200 transition"
                          >
                            حذف
                          </button>
                        )}
                      </label>
                      {config.backgroundImage?.url && (
                        <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 max-h-24">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={config.backgroundImage.url} alt="خلفية الامتحان" className="w-full object-cover max-h-24" />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          الشفافية: {Math.round((config.backgroundImage?.opacity ?? 0.07) * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.02"
                          max="0.30"
                          step="0.01"
                          value={config.backgroundImage?.opacity ?? 0.07}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              backgroundImage: {
                                ...config.backgroundImage!,
                                opacity: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="w-full accent-blue-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">طريقة العرض:</label>
                        <select
                          value={config.backgroundImage?.size ?? 'cover'}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              backgroundImage: {
                                ...config.backgroundImage!,
                                size: e.target.value as 'cover' | 'contain' | 'repeat',
                              },
                            })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold"
                        >
                          <option value="cover">تغطية كاملة (Cover)</option>
                          <option value="contain">ملاءمة كاملة (Contain)</option>
                          <option value="repeat">تكرار (Repeat)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Watermark Text */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">تفعيل العلامة المائية النصية</span>
                  <input
                    type="checkbox"
                    checked={config.watermark?.enabled ?? false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        watermark: {
                          ...config.watermark,
                          enabled: e.target.checked,
                          text: config.watermark?.text || teacherName || 'الفيزياء',
                          opacity: config.watermark?.opacity ?? 0.07,
                        },
                      })
                    }
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                {config.watermark?.enabled && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نص العلامة المائية:</label>
                      <input
                        type="text"
                        value={config.watermark.text || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            watermark: { ...config.watermark, text: e.target.value },
                          })
                        }
                        placeholder="الأستاذ أحمد حجاج"
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        درجة الشفافية: {Math.round((config.watermark.opacity || 0.07) * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.02"
                        max="0.25"
                        step="0.01"
                        value={config.watermark.opacity ?? 0.07}
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
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: FOOTER & QR */}
          {activeTab === 'footer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نص التذييل (الفوتر في أسفل الورقة):</label>
                <input
                  type="text"
                  value={config.footer?.customFooterText || ''}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      footer: { ...config.footer, customFooterText: e.target.value },
                    })
                  }
                  placeholder="مع تمنياتنا لكم بالنجاح والتفوق • أ. أحمد حجاج"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">كود QR الذكي الدائم على الورقة</span>
                    <span className="text-[11px] text-slate-400">
                      يظهر كود QR بأسفل الورقة يمسحه الطالب بالهاتف لمشاهدة فيديو الشرح أو الحل.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.qrCode?.enabled ?? false}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        qrCode: {
                          enabled: e.target.checked,
                          url: config.qrCode?.url || '',
                          title: config.qrCode?.title || 'امسح الكود لمشاهدة فيديو شرح وحل الامتحان',
                        },
                      })
                    }
                    className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                  />
                </div>

                {config.qrCode?.enabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        الرابط التلقائي (YouTube / Drive / منصة):
                      </label>
                      <input
                        type="url"
                        value={config.qrCode.url || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            qrCode: { ...config.qrCode!, url: e.target.value },
                          })
                        }
                        placeholder="https://youtu.be/..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        عنوان كود الـ QR:
                      </label>
                      <input
                        type="text"
                        value={config.qrCode.title || ''}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            qrCode: { ...config.qrCode!, title: e.target.value },
                          })
                        }
                        placeholder="امسح الكود لمشاهدة فيديو شرح وحل الامتحان"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 bg-slate-200 p-4 sm:p-6 rounded-3xl border border-slate-300 shadow-inner sticky top-20 max-h-[88vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-blue-700" />
              <span>معاينة حية تفاعلية لورقة الامتحان (Live A4 Preview)</span>
            </span>
            <span className="text-[11px] text-slate-500 bg-white/80 px-2 py-0.5 rounded-full font-bold">
              تتحدث فوراً مع كل تعديل
            </span>
          </div>

          <div className="transform scale-[0.92] sm:scale-100 origin-top">
            <ExamPaperRenderer
              config={config}
              exam={previewExam}
              modelName="أ"
              questions={previewQuestions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
