'use client';

import React, { useEffect, useState, useMemo } from 'react';
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

  // Page Border Classes
  const borderClasses: Record<string, string> = {
    none: 'border-0',
    single: 'border-2 border-slate-900',
    double: 'border-4 border-double border-slate-900',
    rounded: 'border-2 border-slate-800 rounded-2xl',
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

  // Dynamic Auto Font Size calculation
  const effectiveFontSize = useMemo(() => {
    const qp = config.questionsPerPage || 0;
    if (config.autoScaleFont && qp > 0) {
      if (config.columns === 2) {
        if (qp <= 4) return '1rem';
        if (qp <= 6) return '0.9rem';
        if (qp <= 8) return '0.825rem';
        return '0.75rem';
      } else {
        if (qp <= 2) return '1.125rem';
        if (qp <= 4) return '1rem';
        if (qp <= 6) return '0.875rem';
        if (qp <= 8) return '0.8rem';
        return '0.75rem';
      }
    }
    // Manual font size fallback
    if (config.fontSize === 'xs') return '0.775rem';
    if (config.fontSize === 'sm') return '0.875rem';
    if (config.fontSize === 'lg') return '1.125rem';
    if (config.fontSize === 'xl') return '1.25rem';
    return '1rem';
  }, [config.fontSize, config.autoScaleFont, config.questionsPerPage, config.columns]);

  // Question Spacing Class
  const getQuestionSpacingClass = () => {
    const qp = config.questionsPerPage || 0;
    if (config.autoScaleFont && qp > 0) {
      if (qp <= 2) return 'space-y-6 mb-6';
      if (qp <= 4) return 'space-y-4 mb-4';
      if (qp <= 6) return 'space-y-3 mb-3';
      return 'space-y-2 mb-2';
    }
    const spacingClasses: Record<string, string> = {
      compact: 'space-y-2 mb-2',
      normal: 'space-y-4 mb-4',
      spacious: 'space-y-6 mb-6',
    };
    return spacingClasses[config.questions.spacing] || 'space-y-4 mb-4';
  };

  // Image max height scaling
  const getImageMaxHeightClass = () => {
    const qp = config.questionsPerPage || 0;
    if (qp >= 7) return 'max-h-24';
    if (qp >= 5) return 'max-h-32';
    if (qp >= 3) return 'max-h-40';
    return 'max-h-48';
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

  // Watermark Component
  const renderWatermark = () => {
    if (!config.watermark?.enabled) return null;
    return (
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden"
        style={{ opacity: config.watermark.opacity }}
      >
        {config.watermark.type === 'image' && config.watermark.imageUrl ? (
          <img
            src={config.watermark.imageUrl}
            alt="Watermark Background"
            className={
              config.watermark.size === 'cover'
                ? 'w-full h-full object-cover'
                : config.watermark.size === 'auto'
                ? 'max-w-[70%] max-h-[70%] object-contain'
                : 'max-w-[85%] max-h-[85%] object-contain'
            }
            style={{
              transform: config.watermark.angle ? `rotate(${config.watermark.angle}deg)` : undefined,
            }}
          />
        ) : config.watermark.text ? (
          <span
            className="text-6xl sm:text-8xl font-black text-slate-800 tracking-wider whitespace-nowrap"
            style={{ transform: `rotate(${config.watermark.angle || -30}deg)` }}
          >
            {config.watermark.text}
          </span>
        ) : null}
      </div>
    );
  };

  // Full Header for Page 1
  const renderFullHeader = () => (
    <div className="exam-paper-header relative z-10 border-b-2 border-slate-900 pb-3 mb-5 print:block">
      {config.headerStyle === 'formal' && (
        <div className="flex items-start justify-between gap-4 mb-2.5">
          <div className="text-right text-xs leading-relaxed font-bold w-1/3">
            <p>{config.header.ministryLine}</p>
            <p>{config.header.directorate}</p>
            <p>{config.header.administration}</p>
            {config.header.schoolOrCenterName && (
              <p className="text-blue-900 mt-0.5">{config.header.schoolOrCenterName}</p>
            )}
          </div>

          <div className="text-center w-1/3">
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 leading-tight">
              {exam.title}
            </h1>
            <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-0.5 bg-slate-100 border border-slate-400 rounded-full text-xs font-black">
              <span>نموذج:</span>
              <span className="text-blue-700 text-sm">{modelName}</span>
            </div>
          </div>

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

      {config.headerStyle === 'boxed' && (
        <div className="border-2 border-slate-900 p-2.5 rounded-lg mb-2.5 bg-slate-50/50">
          <div className="flex items-center justify-between text-xs font-bold border-b border-slate-300 pb-1.5 mb-1.5">
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

      {config.headerStyle === 'modern-gradient' && (
        <div className="text-center pb-3 mb-2.5 border-b-2 border-slate-200">
          <div
            className="inline-block px-3.5 py-0.5 rounded-full text-white text-xs font-bold mb-1.5 shadow-xs"
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

      {(config.headerStyle === 'standard' || config.headerStyle === 'minimal') && (
        <div className="text-center pb-2.5">
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
        <div className="mt-2.5 pt-2 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
          {config.header.studentFields.name && (
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
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
        <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-medium text-slate-700">
          <span className="font-bold text-slate-900 ml-1">📌 تعليمات:</span>
          {exam.instructions}
        </div>
      )}
    </div>
  );

  // Compact Header for Page 2+
  const renderCompactHeader = (pageNumber: number, totalPagesCount: number) => (
    <div className="exam-running-header relative z-10 flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-4 text-xs font-bold text-slate-800 print:block">
      <div className="flex items-center gap-2">
        <span className="font-black text-slate-950">{exam.title}</span>
        <span>•</span>
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-black text-blue-800">
          نموذج ({modelName})
        </span>
      </div>
      <div className="flex items-center gap-3 text-slate-600">
        <span>{exam.subject} — {exam.grade_level}</span>
        <span>•</span>
        <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          ورقة ({pageNumber} من {totalPagesCount})
        </span>
      </div>
    </div>
  );

  // Single Question Renderer
  const renderQuestionItem = (q: any, globalIndex: number) => {
    const isMcq = q.question_type === 'mcq' || q.question_type === 'multiple_choice' || (q.choices && q.choices.length > 0);
    const isTf = q.question_type === 'true_false' || q.question_type === 'صح أو خطأ';

    return (
      <article key={q.id} className="break-inside-avoid">
        {/* Question Text Row */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <span className="font-black text-blue-950 shrink-0">
            {formatQNum(globalIndex)}
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

        {/* Diagram / Image */}
        {q.image_urls && q.image_urls.length > 0 && (
          <div className="my-2 flex justify-center">
            <img
              src={q.image_urls[0]}
              alt="رسم توضيحي"
              className={`${getImageMaxHeightClass()} max-w-full object-contain rounded border border-slate-200 bg-white p-1`}
            />
          </div>
        )}

        {/* Choices for MCQ */}
        {isMcq && q.choices && q.choices.length > 0 && (
          <div className={`grid gap-1.5 pr-4 mt-1.5 ${getChoicesGrid()}`}>
            {q.choices.map((c: any, cIdx: number) => (
              <div key={c.id || cIdx} className="text-xs font-medium text-slate-800 flex items-start gap-1">
                <span className="font-bold text-blue-900 w-5 text-center shrink-0">
                  ({(choiceLetters[config.questions.choicesBullet] || choiceLetters['arabic-letters'])[cIdx] || c.choice_code})
                </span>
                <span className="leading-snug">{c.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* True / False Option Box */}
        {isTf && (
          <div className="flex justify-end pr-4 mt-1">
            <div className="w-8 h-8 rounded border-2 border-slate-400 flex items-center justify-center font-bold text-slate-300">
              ( )
            </div>
          </div>
        )}

        {/* Essay Answer Lines */}
        {!isMcq && !isTf && config.questions.essayLinesCount > 0 && (
          <div className="space-y-2 mt-2 pr-4">
            {Array.from({ 
              length: Math.max(1, (config.questionsPerPage && config.questionsPerPage >= 5 ? 2 : config.questions.essayLinesCount))
            }).map((_, lIdx) => (
              <div
                key={lIdx}
                className={`h-4 w-full ${
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
    );
  };

  // Footer for each page
  const renderFooter = (pageNumber: number, totalPagesCount: number, isLastPage: boolean) => (
    <footer className="relative z-10 mt-auto pt-3 border-t-2 border-slate-900">
      {/* Optional QR Code on Last Page */}
      {isLastPage && config.qrCode?.enabled && qrCodeDataUrl && (
        <div className="mb-2.5 p-2 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between gap-4">
          <div className="text-right">
            <span className="font-bold text-xs text-slate-800 block">🎬 {config.qrCode.title || 'فيديو الشرح ونموذج الإجابة:'}</span>
            <span className="text-[10px] text-slate-500 font-mono truncate max-w-sm block mt-0.5">{config.qrCode.url}</span>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <img src={qrCodeDataUrl} alt="QR Code" className="w-12 h-12 border border-slate-300 rounded p-0.5 bg-white" />
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
            <span>صفحة {pageNumber} من {totalPagesCount}</span>
          )}
        </div>
      </div>
    </footer>
  );

  // ─────────────────────────────────────────────────────────────
  // MODE A: PAGINATED SHEETS (when questionsPerPage > 0)
  // ─────────────────────────────────────────────────────────────
  if (config.questionsPerPage && config.questionsPerPage > 0) {
    const qPerPage = config.questionsPerPage;
    const pageChunks: Array<typeof questions> = [];

    for (let i = 0; i < questions.length; i += qPerPage) {
      pageChunks.push(questions.slice(i, i + qPerPage));
    }

    if (pageChunks.length === 0) {
      pageChunks.push([]);
    }

    const totalPages = pageChunks.length;

    return (
      <div className="exam-pages-container space-y-8 print:space-y-0">
        {pageChunks.map((chunk, pIdx) => {
          const pageNum = pIdx + 1;
          const isLast = pIdx === totalPages - 1;

          return (
            <div
              key={`page-${pIdx}`}
              dir="rtl"
              className={`exam-a4-page relative bg-white text-slate-900 mx-auto transition-all print:border-slate-900 print:shadow-none flex flex-col justify-between ${
                fontClasses[config.fontFamily] || 'font-sans'
              } ${borderClasses[config.pageBorder] || 'border'} ${
                isPreview
                  ? 'p-6 max-w-4xl shadow-lg rounded-xl text-sm min-h-[750px]'
                  : 'p-7 sm:p-9 max-w-5xl shadow-md min-h-[1080px] print:min-h-0 print:p-5 print:max-w-none print:shadow-none'
              }`}
              style={{
                fontSize: effectiveFontSize,
                pageBreakAfter: pIdx < totalPages - 1 ? 'always' : 'auto',
                breakAfter: pIdx < totalPages - 1 ? 'page' : 'auto',
              }}
            >
              {renderWatermark()}

              {/* Page Header: Full on Page 1, Compact on Page 2+ */}
              <div>
                {pIdx === 0 ? renderFullHeader() : renderCompactHeader(pageNum, totalPages)}

                {/* Questions Grid / Main */}
                <main
                  className={`relative z-10 ${
                    config.columns === 2 ? 'columns-1 md:columns-2 gap-8 [column-rule:1px_solid_#e2e8f0]' : ''
                  }`}
                >
                  <div className={getQuestionSpacingClass()}>
                    {chunk.map((q, qLocalIdx) => {
                      const globalIndex = pIdx * qPerPage + qLocalIdx;
                      return renderQuestionItem(q, globalIndex);
                    })}
                  </div>
                </main>
              </div>

              {/* Footer pushed to bottom */}
              {renderFooter(pageNum, totalPages, isLast)}
            </div>
          );
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MODE B: CONTINUOUS AUTO-FLOW (when questionsPerPage === 0)
  // ─────────────────────────────────────────────────────────────
  const mcqs = questions.filter(
    (q) => q.question_type === 'mcq' || q.question_type === 'multiple_choice' || (q.choices && q.choices.length > 0)
  );
  const tfs = questions.filter((q) => q.question_type === 'true_false' || q.question_type === 'صح أو خطأ');
  const essays = questions.filter((q) => !mcqs.includes(q) && !tfs.includes(q));

  return (
    <div
      dir="rtl"
      className={`exam-a4-page relative bg-white text-slate-900 mx-auto transition-all print:border-slate-900 print:shadow-none flex flex-col justify-between ${
        fontClasses[config.fontFamily] || 'font-sans'
      } ${borderClasses[config.pageBorder] || 'border'} ${
        isPreview
          ? 'p-6 max-w-4xl shadow-lg rounded-xl text-sm'
          : 'p-8 sm:p-10 max-w-5xl shadow-md min-h-[1100px] print:min-h-0 print:p-5 print:max-w-none print:shadow-none'
      }`}
      style={{
        fontSize: effectiveFontSize,
      }}
    >
      {renderWatermark()}

      <div>
        {renderFullHeader()}

        <main
          className={`relative z-10 ${
            config.columns === 2 ? 'columns-1 md:columns-2 gap-8 [column-rule:1px_solid_#e2e8f0]' : ''
          }`}
        >
          {/* MCQ Section */}
          {mcqs.length > 0 && (
            <section className="mb-6">
              <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between break-after-avoid">
                <span>السؤال الأول: اختر الإجابة الصحيحة من بين البدائل المعطاة</span>
                <span className="text-xs font-normal text-slate-500">
                  ({mcqs.length} أسئلة)
                </span>
              </h2>

              <div className={getQuestionSpacingClass()}>
                {mcqs.map((q, idx) => renderQuestionItem(q, idx))}
              </div>
            </section>
          )}

          {/* True / False Section */}
          {tfs.length > 0 && (
            <section className="mb-6">
              <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between break-after-avoid">
                <span>السؤال الثاني: ضع علامة (✓) أمام العبارة الصحيحة وعلامة (✗) أمام الخطأ</span>
                <span className="text-xs font-normal text-slate-500">
                  ({tfs.length} أسئلة)
                </span>
              </h2>

              <div className={getQuestionSpacingClass()}>
                {tfs.map((q, idx) => renderQuestionItem(q, mcqs.length + idx))}
              </div>
            </section>
          )}

          {/* Essay Section */}
          {essays.length > 0 && (
            <section className="mb-6">
              <h2 className="font-black text-sm text-slate-900 border-b-2 border-slate-800 pb-1 mb-3 flex items-center justify-between break-after-avoid">
                <span>الأسئلة المقالية: أجب عن الأسئلة الآتية موضحاً خطوات الحل</span>
                <span className="text-xs font-normal text-slate-500">
                  ({essays.length} أسئلة)
                </span>
              </h2>

              <div className={getQuestionSpacingClass()}>
                {essays.map((q, idx) => renderQuestionItem(q, mcqs.length + tfs.length + idx))}
              </div>
            </section>
          )}
        </main>
      </div>

      {renderFooter(1, 1, true)}
    </div>
  );
};
