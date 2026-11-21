'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  FolderSync, 
  ArrowRightLeft, 
  Check, 
  Loader2, 
  AlertCircle, 
  Sparkles, 
  BookOpen, 
  Bookmark, 
  GraduationCap, 
  Layers,
  HelpCircle
} from 'lucide-react';
import { Question } from '@/types/database';
import { moveQuestionLessonAction } from '@/app/admin/question-bank/actions';

interface MoveQuestionModalProps {
  isOpen: boolean;
  question: Question | null;
  allQuestions: Question[];
  onClose: () => void;
  onQuestionMoved: (
    questionId: string, 
    updatedData: {
      chapter: string;
      lesson?: string | null;
      grade_level?: string | null;
      term?: string | null;
    }
  ) => void;
}

export default function MoveQuestionModal({
  isOpen,
  question,
  allQuestions,
  onClose,
  onQuestionMoved,
}: MoveQuestionModalProps) {
  // Form state
  const [selectedChapter, setSelectedChapter] = useState('');
  const [isCustomChapter, setIsCustomChapter] = useState(false);
  const [customChapterName, setCustomChapterName] = useState('');

  const [selectedLesson, setSelectedLesson] = useState('');
  const [isCustomLesson, setIsCustomLesson] = useState(false);
  const [customLessonName, setCustomLessonName] = useState('');

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');

  // Quick picker select value (format: "chapter:::lesson")
  const [quickPickerValue, setQuickPickerValue] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Group all questions by chapter -> lessons mapping
  const bankHierarchy = useMemo(() => {
    const map: Record<string, { lessons: Set<string>; grades: Set<string>; terms: Set<string> }> = {};

    allQuestions.forEach((q) => {
      const ch = (q.chapter || '').trim();
      if (!ch) return;

      if (!map[ch]) {
        map[ch] = {
          lessons: new Set(),
          grades: new Set(),
          terms: new Set(),
        };
      }

      if (q.lesson && q.lesson.trim()) {
        map[ch].lessons.add(q.lesson.trim());
      }
      if (q.grade_level && q.grade_level.trim()) {
        map[ch].grades.add(q.grade_level.trim());
      }
      if ((q as any).term && (q as any).term.trim()) {
        map[ch].terms.add((q as any).term.trim());
      }
    });

    return map;
  }, [allQuestions]);

  const existingChapters = useMemo(() => {
    return Object.keys(bankHierarchy).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [bankHierarchy]);

  // Lessons for currently selected chapter
  const availableLessonsForSelectedChapter = useMemo(() => {
    const activeChap = isCustomChapter ? customChapterName.trim() : selectedChapter;
    if (!activeChap || !bankHierarchy[activeChap]) return [];
    return Array.from(bankHierarchy[activeChap].lessons).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [selectedChapter, isCustomChapter, customChapterName, bankHierarchy]);

  // Available grades list
  const availableGrades = useMemo(() => {
    const defaultGrades = ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'];
    const fromQ = allQuestions
      .map((q) => q.grade_level)
      .filter((g): g is string => !!g && g.trim() !== '');
    return Array.from(new Set([...defaultGrades, ...fromQ]));
  }, [allQuestions]);

  // Reset form when question changes or modal opens
  useEffect(() => {
    if (!isOpen || !question) {
      setSelectedChapter('');
      setIsCustomChapter(false);
      setCustomChapterName('');
      setSelectedLesson('');
      setIsCustomLesson(false);
      setCustomLessonName('');
      setSelectedGrade('');
      setSelectedTerm('');
      setQuickPickerValue('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSaving(false);
      return;
    }

    const currentChap = (question.chapter || '').trim();
    const currentLes = (question.lesson || '').trim();
    const currentG = question.grade_level || 'الصف الثالث الثانوي';
    const currentT = (question as any).term || '';

    setSelectedChapter(currentChap);
    setIsCustomChapter(false);
    setCustomChapterName('');

    setSelectedLesson(currentLes);
    setIsCustomLesson(false);
    setCustomLessonName('');

    setSelectedGrade(currentG);
    setSelectedTerm(currentT);

    if (currentChap && currentLes) {
      setQuickPickerValue(`${currentChap}:::${currentLes}`);
    } else {
      setQuickPickerValue('');
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSaving(false);
  }, [isOpen, question]);

  // Handle Quick Picker change
  const handleQuickPickerChange = (val: string) => {
    setQuickPickerValue(val);
    if (!val) return;

    const [chap, les] = val.split(':::');
    if (chap) {
      setSelectedChapter(chap);
      setIsCustomChapter(false);
      setCustomChapterName('');

      // Auto-set grade/term if available for this chapter
      const info = bankHierarchy[chap];
      if (info) {
        if (info.grades.size === 1) {
          setSelectedGrade(Array.from(info.grades)[0]);
        }
        if (info.terms.size === 1) {
          setSelectedTerm(Array.from(info.terms)[0]);
        }
      }
    }

    if (les) {
      setSelectedLesson(les);
      setIsCustomLesson(false);
      setCustomLessonName('');
    }
  };

  // Handle Chapter Dropdown Change
  const handleChapterChange = (val: string) => {
    if (val === '__NEW__') {
      setIsCustomChapter(true);
      setSelectedChapter('');
      setSelectedLesson('');
      setQuickPickerValue('');
    } else {
      setIsCustomChapter(false);
      setSelectedChapter(val);
      setSelectedLesson(''); // reset lesson so user selects one from the new chapter
      setQuickPickerValue('');

      // Auto-set grade/term if this chapter is specific
      const info = bankHierarchy[val];
      if (info) {
        if (info.grades.size === 1) {
          setSelectedGrade(Array.from(info.grades)[0]);
        }
        if (info.terms.size === 1) {
          setSelectedTerm(Array.from(info.terms)[0]);
        }
      }
    }
  };

  // Handle Lesson Dropdown Change
  const handleLessonChange = (val: string) => {
    if (val === '__NEW__') {
      setIsCustomLesson(true);
      setSelectedLesson('');
      setQuickPickerValue('');
    } else {
      setIsCustomLesson(false);
      setSelectedLesson(val);
      const activeChap = isCustomChapter ? customChapterName.trim() : selectedChapter;
      if (activeChap && val) {
        setQuickPickerValue(`${activeChap}:::${val}`);
      }
    }
  };

  // Submit Move Action
  const handleSave = async () => {
    if (!question) return;

    const finalChapter = isCustomChapter ? customChapterName.trim() : selectedChapter.trim();
    const finalLesson = isCustomLesson ? customLessonName.trim() : selectedLesson.trim();

    if (!finalChapter) {
      setErrorMsg('برجاء اختيار أو كتابة اسم الفصل / الباب');
      return;
    }

    if (!finalLesson) {
      setErrorMsg('برجاء اختيار أو كتابة اسم الدرس المستهدف');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      const res = await moveQuestionLessonAction(question.id, {
        chapter: finalChapter,
        lesson: finalLesson,
        grade_level: selectedGrade || null,
        term: selectedTerm || null,
      });

      if (!res.success) {
        throw new Error(res.error || 'فشل نقل السؤال');
      }

      setSuccessMsg(`تم نقل السؤال بنجاح إلى: ${finalLesson}`);

      onQuestionMoved(question.id, {
        chapter: finalChapter,
        lesson: finalLesson,
        grade_level: selectedGrade || null,
        term: selectedTerm || null,
      });

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !question) return null;

  const currentFinalChapter = isCustomChapter ? customChapterName : selectedChapter;
  const currentFinalLesson = isCustomLesson ? customLessonName : selectedLesson;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">نقل السؤال إلى درس آخر</h3>
              <p className="text-xs text-amber-900/70 font-semibold">
                تعديل وتصحيح مكان السؤال في بنك الأسئلة بسهولة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Question Preview Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="font-bold text-slate-500">معاينة نص السؤال:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                  {question.question_type === 'mcq'
                    ? 'اختيار من متعدد'
                    : question.question_type === 'true_false'
                    ? 'صح أو خطأ'
                    : 'مقالي'}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 font-bold">
                  {question.grade_level || 'الصف الثالث الثانوي'}
                </span>
              </div>
            </div>
            <p className="font-bold text-slate-800 text-sm leading-relaxed line-clamp-3">
              {question.text}
            </p>

            {/* Current Chapter & Lesson */}
            <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-500 font-semibold">المكان الحالي:</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-100/70 text-amber-900 font-bold border border-amber-200">
                📁 {question.chapter || 'غير محدد'}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-100/70 text-emerald-900 font-bold border border-emerald-200">
                🔖 {question.lesson || 'بدون درس محدد'}
              </span>
            </div>
          </div>

          {/* Quick Picker from Question Bank */}
          <div className="space-y-1.5 p-3.5 bg-blue-50/60 border border-blue-200/70 rounded-2xl">
            <label className="text-xs font-black text-blue-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>اختيار سريع من الدروس المتاحة في بنك أسئلتك:</span>
            </label>
            <p className="text-[11px] text-blue-700 font-semibold">
              اختر الدرس المستهدف مباشرة وسيتم ضبط الفصل والدرس تلقائياً:
            </p>
            <select
              value={quickPickerValue}
              onChange={(e) => handleQuickPickerChange(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-xs mt-1"
            >
              <option value="">-- اضغط هنا للاختيار من الدروس المتاحة --</option>
              {existingChapters.map((chap) => {
                const lessons = Array.from(bankHierarchy[chap]?.lessons || []).sort((a, b) => a.localeCompare(b, 'ar'));
                if (lessons.length === 0) {
                  return (
                    <option key={chap} value={`${chap}:::`}>
                      📁 {chap} (بدون دروس فرعية)
                    </option>
                  );
                }
                return (
                  <optgroup key={chap} label={`📁 فصل: ${chap}`}>
                    {lessons.map((les) => (
                      <option key={`${chap}:::${les}`} value={`${chap}:::${les}`}>
                        🔖 {les}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-slate-200"></div>
            <span className="shrink mx-3 text-xs font-bold text-slate-400">أو تخصيص الفصل والدرس يدوياً</span>
            <div className="grow border-t border-slate-200"></div>
          </div>

          {/* Target Chapter Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                <span>الفصل / الباب المستهدف:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCustomChapter(!isCustomChapter);
                  if (!isCustomChapter) {
                    setCustomChapterName(selectedChapter);
                  }
                }}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-bold transition"
              >
                {isCustomChapter ? '⬅️ العودة للاختيار من القائمة' : '➕ كتابة اسم فصل جديد'}
              </button>
            </label>

            {isCustomChapter ? (
              <input
                type="text"
                value={customChapterName}
                onChange={(e) => setCustomChapterName(e.target.value)}
                placeholder="اكتب اسم الفصل الجديد (مثال: الفصل الخامس: ازدواجية الموجة والجسيم)..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                autoFocus
              />
            ) : (
              <select
                value={selectedChapter}
                onChange={(e) => handleChapterChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- اختر الفصل / الباب --</option>
                {existingChapters.map((ch) => (
                  <option key={ch} value={ch}>
                    📁 {ch}
                  </option>
                ))}
                <option value="__NEW__" className="text-blue-600 font-bold">
                  ➕ + كتابة اسم فصل جديد...
                </option>
              </select>
            )}
          </div>

          {/* Target Lesson Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
                <span>الدرس المستهدف:</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCustomLesson(!isCustomLesson);
                  if (!isCustomLesson) {
                    setCustomLessonName(selectedLesson);
                  }
                }}
                className="text-[11px] text-emerald-600 hover:text-emerald-800 font-bold transition"
              >
                {isCustomLesson ? '⬅️ العودة للاختيار من القائمة' : '➕ كتابة اسم درس جديد'}
              </button>
            </label>

            {isCustomLesson ? (
              <input
                type="text"
                value={customLessonName}
                onChange={(e) => setCustomLessonName(e.target.value)}
                placeholder="اكتب اسم الدرس المستهدف (مثال: تطبيقات الليزر / الهولوجرام)..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                autoFocus
              />
            ) : (
              <select
                value={selectedLesson}
                onChange={(e) => handleLessonChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">-- اختر الدرس المستهدف --</option>
                {availableLessonsForSelectedChapter.map((les) => (
                  <option key={les} value={les}>
                    🔖 {les}
                  </option>
                ))}
                <option value="__NEW__" className="text-emerald-600 font-bold">
                  ➕ + كتابة اسم درس جديد لهذا الفصل...
                </option>
              </select>
            )}
            {availableLessonsForSelectedChapter.length === 0 && !isCustomLesson && selectedChapter && (
              <p className="text-[11px] text-amber-700 font-semibold">
                💡 هذا الفصل لا يحتوي على دروس مسجلة بعد، اضغط على &quot;➕ كتابة اسم درس جديد&quot; لإضافة درس له.
              </p>
            )}
          </div>

          {/* Target Grade and Term Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span>السنة الدراسية:</span>
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {availableGrades.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-600" />
                <span>الترم:</span>
              </label>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-cyan-500 outline-none"
              >
                <option value="">غير محدد</option>
                <option value="الترم الأول">الترم الأول</option>
                <option value="الترم الثاني">الترم الثاني</option>
              </select>
            </div>
          </div>

          {/* New Destination Confirmation Summary */}
          {currentFinalChapter && currentFinalLesson && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-bold">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                سيتم نقل السؤال إلى: <span className="underline decoration-emerald-500">{currentFinalChapter}</span> ➔ <span className="underline decoration-emerald-500">{currentFinalLesson}</span>
              </span>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700 font-bold">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-5 py-2.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري نقل السؤال...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>نقل وتحديث السؤال</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
