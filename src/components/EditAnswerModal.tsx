'use client';

import { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Edit3, 
  HelpCircle,
  Sparkles,
  BookOpen
} from 'lucide-react';
import { Question, QuestionChoice } from '@/types/database';
import { updateQuestionAnswerAction } from '@/app/admin/question-bank/actions';

interface EditAnswerModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onAnswerUpdated: (updatedQuestion: Question) => void;
}

const ARABIC_CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح'];

export default function EditAnswerModal({
  isOpen,
  question,
  onClose,
  onAnswerUpdated,
}: EditAnswerModalProps) {
  const [questionText, setQuestionText] = useState('');
  
  // MCQ state
  const [choices, setChoices] = useState<QuestionChoice[]>([]);
  
  // Essay state
  const [essayAnswer, setEssayAnswer] = useState('');
  
  // True/False state
  const [tfAnswer, setTfAnswer] = useState<'صح' | 'خطأ'>('صح');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize modal state whenever opened with a question
  useEffect(() => {
    if (!question || !isOpen) return;

    setErrorMsg(null);
    setQuestionText(question.text || '');

    // Initialize MCQ choices
    if (question.question_type === 'mcq') {
      if (question.choices && question.choices.length > 0) {
        const sorted = [...question.choices].sort(
          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
        );
        // Ensure at least one is correct
        const hasCorrect = sorted.some((c) => c.is_correct);
        if (!hasCorrect && sorted.length > 0) {
          sorted[0].is_correct = true;
        }
        setChoices(sorted);
      } else {
        // Fallback: 4 default empty choices
        setChoices([
          { choice_code: 'أ', text: '', is_correct: true, order_index: 0 },
          { choice_code: 'ب', text: '', is_correct: false, order_index: 1 },
          { choice_code: 'ج', text: '', is_correct: false, order_index: 2 },
          { choice_code: 'د', text: '', is_correct: false, order_index: 3 },
        ]);
      }
    }

    // Initialize Essay
    if (question.question_type === 'essay') {
      setEssayAnswer(question.model_answer || '');
    }

    // Initialize True/False
    if (question.question_type === 'true_false') {
      const correctChoice = question.choices?.find((c) => c.is_correct);
      const isAnsFalse = 
        question.model_answer?.trim() === 'خطأ' || 
        correctChoice?.text?.trim() === 'خطأ' ||
        correctChoice?.text?.includes('خطأ');

      setTfAnswer(isAnsFalse ? 'خطأ' : 'صح');
    }
  }, [question, isOpen]);

  if (!isOpen || !question) return null;

  // MCQ handlers
  const handleSelectCorrectChoice = (index: number) => {
    setChoices((prev) =>
      prev.map((c, i) => ({
        ...c,
        is_correct: i === index,
      }))
    );
  };

  const handleChoiceTextChange = (index: number, text: string) => {
    setChoices((prev) =>
      prev.map((c, i) => (i === index ? { ...c, text } : c))
    );
  };

  const handleAddChoice = () => {
    if (choices.length >= 8) return;
    const nextIdx = choices.length;
    const nextCode = ARABIC_CHOICE_LETTERS[nextIdx] || `${nextIdx + 1}`;
    setChoices((prev) => [
      ...prev,
      {
        choice_code: nextCode,
        text: '',
        is_correct: false,
        order_index: nextIdx,
      },
    ]);
  };

  const handleRemoveChoice = (index: number) => {
    if (choices.length <= 2) {
      setErrorMsg('يجب أن يحتوي السؤال على خيارين على الأقل');
      return;
    }
    const filtered = choices.filter((_, i) => i !== index);
    // Re-assign codes and order_index
    const reindexed = filtered.map((c, i) => ({
      ...c,
      choice_code: ARABIC_CHOICE_LETTERS[i] || `${i + 1}`,
      order_index: i,
    }));
    // If the removed choice was the correct one, make the first one correct
    if (!reindexed.some((c) => c.is_correct) && reindexed.length > 0) {
      reindexed[0].is_correct = true;
    }
    setChoices(reindexed);
  };

  const handleSave = async () => {
    setErrorMsg(null);

    // Validation
    if (!questionText.trim()) {
      setErrorMsg('يرجى إدخال نص السؤال');
      return;
    }

    if (question.question_type === 'mcq') {
      if (choices.length < 2) {
        setErrorMsg('يجب توفير خيارين على الأقل');
        return;
      }
      for (let i = 0; i < choices.length; i++) {
        if (!choices[i].text.trim()) {
          setErrorMsg(`يرجى كتابة نص الخيار (${choices[i].choice_code})`);
          return;
        }
      }
      if (!choices.some((c) => c.is_correct)) {
        setErrorMsg('يرجى تحديد الخيار الصحيح بالنقر عليه');
        return;
      }
    }

    setIsSaving(true);
    try {
      const res = await updateQuestionAnswerAction({
        questionId: question.id,
        questionText: questionText.trim(),
        questionType: question.question_type,
        modelAnswer: question.question_type === 'essay' ? essayAnswer.trim() : undefined,
        trueFalseAnswer: question.question_type === 'true_false' ? tfAnswer : undefined,
        choices: question.question_type === 'mcq' ? choices : undefined,
      });

      if (!res.success) {
        throw new Error(res.error || 'فشل في حفظ التعديلات');
      }

      if (res.question) {
        onAnswerUpdated(res.question);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-l from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-800 text-lg">تعديل إجابة السؤال والخيارات</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {question.question_type === 'mcq'
                    ? 'اختيار من متعدد'
                    : question.question_type === 'essay'
                    ? 'سؤال مقالي'
                    : 'صح أو خطأ'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {question.chapter} {question.lesson ? `• ${question.lesson}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSaving}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Question Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              <span>نص السؤال</span>
            </label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed transition resize-none"
              placeholder="نص السؤال..."
            />
          </div>

          {/* Conditional Input based on question type */}

          {/* 1. MCQ (اختيار من متعدد) */}
          {question.question_type === 'mcq' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>خيارات الإجابة (اختر الإجابة الصحيحة وعدل النصوص):</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    اضغط على الدائرة لاختيار الإجابة الصحيحة، ويمكنك كتابة نص كل اختيار في الحقل الخاص به.
                  </p>
                </div>

                {choices.length < 8 && (
                  <button
                    type="button"
                    onClick={handleAddChoice}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة خيار</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 pt-1">
                {choices.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border transition ${
                      c.is_correct
                        ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Select Correct Radio Button */}
                    <button
                      type="button"
                      onClick={() => handleSelectCorrectChoice(idx)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition shrink-0 ${
                        c.is_correct
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                      title={c.is_correct ? 'هذه هي الإجابة الصحيحة' : 'اضغط لجعل هذا الخيار هو الصحيح'}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          c.is_correct
                            ? 'border-white bg-white'
                            : 'border-slate-400 bg-white'
                        }`}
                      >
                        {c.is_correct && (
                          <div className="w-2 h-2 rounded-full bg-emerald-600" />
                        )}
                      </div>
                      <span>({c.choice_code})</span>
                      <span className="hidden sm:inline">
                        {c.is_correct ? 'صحيح' : 'تحديد'}
                      </span>
                    </button>

                    {/* Choice Text Input */}
                    <input
                      type="text"
                      value={c.text}
                      onChange={(e) => handleChoiceTextChange(idx, e.target.value)}
                      placeholder={`أدخل نص الاختيار (${c.choice_code})...`}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold outline-none transition ${
                        c.is_correct
                          ? 'bg-white text-emerald-950 border border-emerald-300 focus:ring-2 focus:ring-emerald-500'
                          : 'bg-slate-50 text-slate-800 border border-slate-200 focus:ring-2 focus:ring-blue-500'
                      }`}
                    />

                    {/* Delete Choice Button */}
                    {choices.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveChoice(idx)}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition shrink-0"
                        title="حذف هذا الخيار"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Essay (مقالي) */}
          {question.question_type === 'essay' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>الإجابة النموذجية للسؤال المقالي:</span>
              </label>
              <textarea
                value={essayAnswer}
                onChange={(e) => setEssayAnswer(e.target.value)}
                rows={5}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed transition resize-none"
                placeholder="اكتب نص الإجابة النموذجية أو عناصر الحل التي ستظهر في نموذج الإجابة للمعلم..."
              />
              <p className="text-[11px] text-slate-400">
                💡 هذه الإجابة تُعرض في نموذج إجابة المعلم وتساعد في التصحيح السريع.
              </p>
            </div>
          )}

          {/* 3. True / False (صح أو خطأ) */}
          {question.question_type === 'true_false' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
                <span>حدد الإجابة الصحيحة للعبارة (صح أم خطأ):</span>
              </label>

              <div className="grid grid-cols-2 gap-4 pt-1">
                {/* Option 1: صح */}
                <button
                  type="button"
                  onClick={() => setTfAnswer('صح')}
                  className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition cursor-pointer ${
                    tfAnswer === 'صح'
                      ? 'bg-emerald-50/80 border-emerald-500 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-emerald-300 hover:bg-emerald-50/30'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${
                      tfAnswer === 'صح'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <span className="font-black text-base">عبارة صحيحة (صواب / صح)</span>
                  {tfAnswer === 'صح' && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      ✓ الإجابة المحددة
                    </span>
                  )}
                </button>

                {/* Option 2: خطأ */}
                <button
                  type="button"
                  onClick={() => setTfAnswer('خطأ')}
                  className={`p-5 rounded-2xl border-2 flex flex-col items-center justify-center gap-2.5 transition cursor-pointer ${
                    tfAnswer === 'خطأ'
                      ? 'bg-rose-50/80 border-rose-500 text-rose-800 shadow-sm ring-2 ring-rose-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-rose-300 hover:bg-rose-50/30'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${
                      tfAnswer === 'خطأ'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <X className="w-6 h-6 stroke-[3]" />
                  </div>
                  <span className="font-black text-base">عبارة خاطئة (خطأ)</span>
                  {tfAnswer === 'خطأ' && (
                    <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
                      ✗ الإجابة المحددة
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100 transition disabled:opacity-50"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
