'use client';

import React, { useEffect, useState } from 'react';
import { ExamPaperConfig } from '@/types/paper-config';
import QRCode from 'qrcode';

interface PaperRendererProps {
  config: ExamPaperConfig;
  exam: {
    title: string;
    subject: string;
    grade_level: string;
    duration_minutes: number;
    total_marks: number;
    exam_date?: string | null;
    instructions?: string | null;
  };
  modelName: string;
  questions: Array<{
    id: string;
    text: string;
    question_type: string;
    marks?: number;
    chapter?: string | null;
    image_urls?: string[] | null;
    choices?: Array<{
      id: string;
      choice_code: string;
      text: string;
      is_correct?: boolean;
    }>;
  }>;
  isPreview?: boolean;
}

export const ExamPaperRenderer: React.FC<PaperRendererProps> = ({
  config,
  exam,
  modelName,
  questions,
  isPreview = false,
}) => {
  const mcqs = questions.filter(q => q.question_type === 'mcq');
  const tfs = questions.filter(q => q.question_type === 'true_false');
  const essays = questions.filter(q => q.question_type === 'essay');

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  useEffect(() => {
    if (config.qrCode?.enabled && config.qrCode.url) {
      QRCode.toDataURL(config.qrCode.url, {
        width: 120,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [config.qrCode?.enabled, config.qrCode?.url]);

  // Page Border Class
  const borderClasses: Record<string, string> = {
    none: 'border-0',
    single: 'border-2 border-slate-900',
    double: 'border-4 border-double border-slate-900',
    rounded: 'border-2 border-slate-800 rounded-2xl',
  };

  const spacingClasses: Record<string, string> = {
    compact: 'space-y-2 mb-2',
    normal: 'space-y-4 mb-4',
    spacious: 'space-y-6 mb-6',
  };

  const fontClasses: Record<string, string> = {
    Tajawal: 'font-sans',
    Cairo: 'font-sans',
    Amiri: 'font-serif',
    'Traditional Arabic': 'font-serif',
  };

  const choiceLetters: Record<string, string[]> = {
    'arabic-letters': ['أ', 'ب', 'ج', 'د', 'هـ', 'و'],
    'english-letters': ['A', 'B', 'C', 'D', 'E', 'F'],
    circles: ['①', '②', '③', '④', '⑤', '⑥'],
  };

  const getChoicesGrid = () => {
    if (config.questions.choicesLayout === 'grid-4') return 'grid-cols-4';
    if (config.questions.choicesLayout === 'grid-2') return 'grid-cols-2';
    if (config.questions.choicesLayout === 'vertical') return 'grid-cols-1';
    return config.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-4';
  };

  const formatQNum = (index: number) => {
    if (config.questions.numberingStyle === 'q-number') return `س${index + 1}:`;
    if (config.questions.numberingStyle === 'arabic-alpha') return `${choiceLetters['arabic-letters'][index] || index + 1}) `;
    return `(${index + 1})`;
  };

  return (
    <div
      dir="rtl"
      className={`relative bg-white text-slate-900 mx-auto transition-all print:border-slate-900 print:shadow-none ${
        fontClasses[config.fontFamily] || 'font-sans'
      } ${borderClasses[config.pageBorder] || 'border'} ${
        isPreview
          ? 'p-6 max-w-4xl shadow-lg rounded-xl text-sm'
          : 'p-8 sm:p-10 max-w-5xl shadow-md min-h-[1100px]'
      }`}
      style={{
        fontSize: config.fontSize === 'sm' ? '0.875rem' : config.fontSize === 'lg' ? '1.125rem' : '1rem',
      }}
    >
      {/* WATERMARK */}
      {config.watermark.enabled && config.watermark.text && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
          style={{ opacity: config.watermark.opacity }}
        >
          <span
            className="text-6xl sm:text-8xl font-black text-slate-800 tracking-wider whitespace-nowrap"
            style={{ transform: `rotate(${config.watermark.angle}deg)` }}
          >
            {config.watermark.text}
          </span>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className="relative z-10 border-b-2 border-slate-900 pb-4 mb-6">
        {/* Style: Formal 3-column Ministry */}
        {config.headerStyle === 'formal' && (
          <div className="flex items-start justify-between gap-4 mb-3">
            {/* Right: Ministry & Admin */}
            <div className="text-right text-xs leading-relaxed font-bold w-1/3">
              <p>{config.header.ministryLine}</p>
              <p>{config.header.directorate}</p>
              <p>{config.header.administration}</p>
              {config.header.schoolOrCenterName && (
                <p className="text-blue-900 mt-0.5">{config.header.schoolOrCenterName}</p>
              )}
            </div>

            {/* Center: Title & Model */}
            <div className="text-center w-1/3">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 leading-tight">
                {exam.title}
              </h1>
              <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-0.5 bg-slate-100 border border-slate-400 rounded-full text-xs font-black">
                <span>نموذج:</span>
                <span className="text-blue-700 text-sm">{modelName}</span>
              </div>
            </div>

            {/* Left: Exam Info & Teacher */}
            <div className="text-left text-xs leading-relaxed font-bold w-1/3">
              <p>المادة: <span className="font-black text-slate-900">{exam.subject}</span></p>
              <p>الصف: <span className="text-slate-800">{exam.grade_level}</span></p>
              {config.header.showDuration && (
                <p>الزمن: <span className="text-slate-800">{exam.duration_minutes} دقيقة</span></p>
              )}
              {config.header.showTotalMarks && (
                <p>الدرجة الكلية: <span className="text-slate-800">{exam.total_marks} درجة</span></p>
              )}
              {config.header.teacherName && (
                <p className="mt-1 text-blue-900">إعداد: {config.header.teacherName}</p>
              )}
            </div>
          </div>
        )}

        {/* Style: Boxed Header */}
        {config.headerStyle === 'boxed' && (
          <div className="border-2 border-slate-900 p-3 rounded-lg mb-3 bg-slate-50/50">
            <div className="flex items-center justify-between text-xs font-bold border-b border-slate-300 pb-2 mb-2">
              <div>{config.header.schoolOrCenterName || config.header.ministryLine}</div>
              <div className="text-base font-black text-slate-900">{exam.title} ({modelName})</div>
              <div>المادة: {exam.subject} ({exam.grade_level})</div>
            </div>
            <div className="flex justify-between text-xs font-medium text-slate-700">
              {config.header.showDuration && <span>الزمن: {exam.duration_minutes} دقيقة</span>}
              {config.header.showTotalMarks && <span>الدرجة: {exam.total_marks} درجة</span>}
              {config.header.teacherName && <span>مدرس المادة: {config.header.teacherName}</span>}
              {exam.exam_date && config.header.showExamDate && (
                <span>التاريخ: {new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>
              )}
            </div>
          </div>
        )}

        {/* Style: Modern Gradient Header */}
        {config.headerStyle === 'modern-gradient' && (
          <div className="text-center pb-4 mb-3 border-b-2 border-slate-200">
            <div
              className="inline-block px-4 py-1 rounded-full text-white text-xs font-bold mb-2 shadow-sm"
              style={{ backgroundColor: config.themeColor || '#1e3a8a' }}
            >
              {config.header.schoolOrCenterName || 'ExamForge Smart Testing'}
            </div>
            <h1 className="text-2xl font-black text-slate-900">{exam.title}</h1>
            <p className="text-xs font-bold text-slate-600 mt-1">
              {exam.subject} • {exam.grade_level} • نموذج ({modelName})
              {config.header.teacherName ? ` • إشراف: ${config.header.teacherName}` : ''}
            </p>
          </div>
        )}

        {/* Style: Standard / Minimal Header */}
        {(config.headerStyle === 'standard' || config.headerStyle === 'minimal') && (
          <div className="text-center pb-3">
            <h1 className="text-2xl font-bold text-slate-900">{exam.title}</h1>
            <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-600 mt-1">
              <span>المادة: {exam.subject}</span>
              <span>•</span>
              <span>الصف: {exam.grade_level}</span>
              <span>•</span>
              <span>نموذج: ({modelName})</span>
              {config.header.showDuration && (
                <>
                  <span>•</span>
                  <span>الزمن: {exam.duration_minutes} دقيقة</span>
                </>
              )}
              {config.header.teacherName && (
                <>
                  <span>•</span>
                  <span className="text-blue-900">{config.header.teacherName}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Student Info Box */}
        {config.header.showStudentInfoBox && (
          <div className="mt-3 pt-2.5 border-t border-slate-300 flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
            {config.header.studentFields.name && (
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <span>اسم الطالب:</span>
                <span className="border-b border-dotted border-slate-800 flex-1 h-4"></span>
              </div>
            )}
            {config.header.studentFields.seatNumber && (
              <div className="flex items-center gap-2">
                <span>رقم الجلوس:</span>
                <span className="border-b border-dotted border-slate-800 w-24 h-4"></span>
              </div>
            )}
            {config.header.studentFields.groupOrClass && (
              <div className="flex items-center gap-2">
                <span>المجموعة / الفصل:</span>
                <span className="border-b border-dotted border-slate-800 w-24 h-4"></span>
              </div>
            )}
            {config.header.studentFields.date && exam.exam_date && (
              <div className="flex items-center gap-2 text-slate-600">
                <span>التاريخ:</span>
                <span>{new Date(exam.exam_date).toLocaleDateString('ar-EG')}</span>
              </div>
            )}
          </div>
        )}

        {/* Exam Instructions */}
        {exam.instructions && (
          <div className="mt-2.5 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700">
            <span className="font-bold text-slate-900 ml-1">📌 ملاحظات وتعليمات:</span>
            {exam.instructions}
          </div>
        )}
      </header>

      {/* QUESTIONS BODY */}
      <main
        className={`relative z-10 ${
          config.columns === 2 ? 'columns-1 md:columns-2 gap-8 [column-rule:1px_solid_#e2e8f0]' : ''
        }`}
      >
        {/* 1. MCQ Section */}
        {mcqs.length > 0 && (
          <section className="mb-6 break-inside-avoid-page">
            <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between">
              <span>السؤال الأول: اختر الإجابة الصحيحة من بين البدائل المعطاة</span>
              <span className="text-xs font-normal text-slate-500">
                ({mcqs.length} أسئلة)
              </span>
            </h2>

            <div className={spacingClasses[config.questions.spacing] || 'space-y-4'}>
              {mcqs.map((q, idx) => (
                <article key={q.id} className="break-inside-avoid">
                  <div className="flex items-start gap-1.5 mb-1.5">
                    <span className="font-black text-blue-950 shrink-0">
                      {formatQNum(idx)}
                    </span>
                    <p className="font-bold text-slate-900 leading-relaxed flex-1">
                      {q.text}
                    </p>
                    {config.questions.showQuestionMarks && q.marks && (
                      <span className="text-xs font-semibold text-slate-500 shrink-0 mr-2">
                        [{q.marks} {q.marks === 1 ? 'درجة' : 'درجات'}]
                      </span>
                    )}
                  </div>

                  {/* Question Diagram / Image */}
                  {q.image_urls && q.image_urls.length > 0 && (
                    <div className="my-2 flex justify-center">
                      <img
                        src={q.image_urls[0]}
                        alt="رسم بياني توضيحي"
                        className="max-h-44 max-w-full object-contain rounded border border-slate-200 bg-white p-1"
                      />
                    </div>
                  )}

                  {/* Choices Grid */}
                  {q.choices && q.choices.length > 0 && (
                    <div className={`grid gap-1.5 pr-5 mt-1.5 ${getChoicesGrid()}`}>
                      {q.choices.map((c, cIdx) => (
                        <div key={c.id || cIdx} className="text-xs font-medium text-slate-800 flex items-start gap-1">
                          <span className="font-bold text-blue-900 w-5 text-center">
                            ({(choiceLetters[config.questions.choicesBullet] || choiceLetters['arabic-letters'])[cIdx] || c.choice_code})
                          </span>
                          <span className="leading-snug">{c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 2. True / False Section */}
        {tfs.length > 0 && (
          <section className="mb-6 break-inside-avoid-page">
            <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between">
              <span>السؤال الثاني: ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام الخطأ</span>
              <span className="text-xs font-normal text-slate-500">
                ({tfs.length} أسئلة)
              </span>
            </h2>

            <div className={spacingClasses[config.questions.spacing] || 'space-y-4'}>
              {tfs.map((q, idx) => (
                <article key={q.id} className="break-inside-avoid">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-1.5 flex-1">
                      <span className="font-black text-blue-950 shrink-0">
                        {formatQNum(mcqs.length + idx)}
                      </span>
                      <p className="font-bold text-slate-900 leading-relaxed">
                        {q.text}
                      </p>
                    </div>
                    <div className="w-8 h-8 rounded border-2 border-slate-400 shrink-0 flex items-center justify-center font-bold text-slate-300">
                      ( )
                    </div>
                  </div>

                  {q.image_urls && q.image_urls.length > 0 && (
                    <div className="my-2 flex justify-center">
                      <img
                        src={q.image_urls[0]}
                        alt="رسم بياني"
                        className="max-h-40 max-w-full object-contain rounded border border-slate-200 p-1"
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* 3. Essay Section */}
        {essays.length > 0 && (
          <section className="mb-6 break-inside-avoid-page">
            <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between">
              <span>الأسئلة المقالية: أجب عن الأسئلة الآتية موضحاً خطوات الحل</span>
              <span className="text-xs font-normal text-slate-500">
                ({essays.length} أسئلة)
              </span>
            </h2>

            <div className={spacingClasses[config.questions.spacing] || 'space-y-6'}>
              {essays.map((q, idx) => (
                <article key={q.id} className="break-inside-avoid mb-4">
                  <div className="flex items-start gap-1.5 mb-2">
                    <span className="font-black text-blue-950 shrink-0">
                      {formatQNum(mcqs.length + tfs.length + idx)}
                    </span>
                    <p className="font-bold text-slate-900 leading-relaxed flex-1">
                      {q.text}
                    </p>
                    {config.questions.showQuestionMarks && q.marks && (
                      <span className="text-xs font-semibold text-slate-500 shrink-0 mr-2">
                        [{q.marks} درجات]
                      </span>
                    )}
                  </div>

                  {q.image_urls && q.image_urls.length > 0 && (
                    <div className="my-2 flex justify-center">
                      <img
                        src={q.image_urls[0]}
                        alt="مسألة بالرسم"
                        className="max-h-48 max-w-full object-contain rounded border border-slate-200 p-1"
                      />
                    </div>
                  )}

                  {/* Answer Lines */}
                  {config.questions.essayLinesCount > 0 && (
                    <div className="space-y-3 mt-3 pr-4">
                      {Array.from({ length: config.questions.essayLinesCount }).map((_, lIdx) => (
                        <div
                          key={lIdx}
                          className={`h-5 w-full ${
                            config.questions.essayLineStyle === 'solid'
                              ? 'border-b border-slate-400'
                              : config.questions.essayLineStyle === 'dotted'
                              ? 'border-b border-dotted border-slate-400'
                              : 'border-b border-dashed border-slate-400'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 mt-8 pt-3 border-t-2 border-slate-900">
        {/* Optional QR Code Box in footer */}
        {config.qrCode?.enabled && qrCodeDataUrl && (
          <div className="mb-3 p-2 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between gap-4">
            <div className="text-right">
              <span className="font-bold text-xs text-slate-800 block">🎬 {config.qrCode.title || 'فيديو الشرح ونموذج الإجابة:'}</span>
              <span className="text-[10px] text-slate-500 font-mono truncate max-w-sm block mt-0.5">{config.qrCode.url}</span>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <img src={qrCodeDataUrl} alt="QR Code" className="w-14 h-14 border border-slate-300 rounded p-0.5 bg-white" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
          <div>
            {config.footer.showModelName && (
              <span>نموذج: <strong className="text-slate-900">{modelName}</strong></span>
            )}
          </div>
          <div className="text-center font-black text-slate-800">
            {config.footer.customFooterText || 'مع تمنياتنا بالتوفيق والنجاح'}
          </div>
          <div className="text-left">
            {config.footer.showPageNumber && (
              <span>ExamForge • صفحة 1</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
