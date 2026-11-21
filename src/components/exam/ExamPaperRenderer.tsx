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

  const qp = config.questionsPerPage || 0;
  const totalQs = questions.length;
  // Calculate effective count for density & scaling (when qp === 0, all questions fit or auto-split)
  const effectiveQp = qp > 0 ? qp : totalQs;
  const isHighDensity = effectiveQp >= 5;
  const isUltraDensity = effectiveQp >= 7;

  // Dynamic Auto Font Size calculation
  const effectiveFontSize = useMemo(() => {
    if (config.autoScaleFont) {
      const count = qp > 0 ? qp : questions.length;
      if (config.columns === 2) {
        if (count <= 4) return '0.95rem';
        if (count <= 6) return '0.85rem';
        if (count <= 8) return '0.78rem';
        if (count <= 10) return '0.72rem';
        if (count <= 12) return '0.675rem';
        return '0.64rem';
      } else {
        if (count <= 2) return '1.1rem';
        if (count <= 3) return '1rem';
        if (count <= 4) return '0.925rem';
        if (count <= 5) return '0.825rem';
        if (count <= 6) return '0.775rem';
        if (count <= 8) return '0.72rem';
        if (count <= 10) return '0.66rem';
        if (count <= 12) return '0.62rem';
        return '0.6rem';
      }
    }
    // Manual font size fallback
    if (config.fontSize === 'xs') return '0.725rem';
    if (config.fontSize === 'sm') return '0.825rem';
    if (config.fontSize === 'lg') return '1.1rem';
    if (config.fontSize === 'xl') return '1.25rem';
    return '0.95rem';
  }, [config.fontSize, config.autoScaleFont, qp, questions.length, config.columns]);

  // Question Spacing Class
  const getQuestionSpacingClass = () => {
    const count = qp > 0 ? qp : questions.length;
    if (config.autoScaleFont) {
      if (count <= 2) return 'space-y-4 mb-3';
      if (count <= 4) return 'space-y-2.5 mb-2';
      if (count <= 6) return 'space-y-1.5 mb-1.5';
      if (count <= 8) return 'space-y-1 mb-1';
      return 'space-y-0.5 mb-0.5';
    }
    const spacingClasses: Record<string, string> = {
      compact: 'space-y-0.5 mb-0.5',
      normal: 'space-y-1 mb-1',
      spacious: 'space-y-3 mb-3',
    };
    return spacingClasses[config.questions.spacing] || 'space-y-1 mb-1';
  };

  // Image max height scaling
  const getImageMaxHeightClass = () => {
    const count = qp > 0 ? qp : questions.length;
    if (count >= 10) return 'max-h-14 sm:max-h-16';
    if (count >= 8) return 'max-h-16 sm:max-h-20';
    if (count >= 6) return 'max-h-20 sm:max-h-24';
    if (count >= 4) return 'max-h-28 sm:max-h-32';
    return 'max-h-40 sm:max-h-44';
  };

  const getChoicesGrid = () => {
    if (config.questions.choicesLayout === 'grid-4') return 'grid-cols-4';
    if (config.questions.choicesLayout === 'grid-2') return 'grid-cols-2';
    if (config.questions.choicesLayout === 'vertical') return 'grid-cols-1';
    return config.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : isHighDensity ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2';
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
    <div className={`exam-paper-header relative z-10 border-b-2 border-slate-900 ${isHighDensity ? 'pb-1.5 mb-2.5' : 'pb-2.5 mb-4'} print:block`}>
      {config.headerStyle === 'formal' && (
        <div className={`flex items-start justify-between gap-3 ${isHighDensity ? 'mb-1 text-[11px]' : 'mb-2 text-xs'}`}>
          <div className="text-right leading-tight font-bold w-1/3">
            <p>{config.header.ministryLine}</p>
            <p>{config.header.directorate} {config.header.administration ? `• ${config.header.administration}` : ''}</p>
            {config.header.schoolOrCenterName && (
              <p className="text-blue-900 mt-0.5">{config.header.schoolOrCenterName}</p>
            )}
          </div>

          <div className="text-center w-1/3">
            <h1 className={`font-black text-slate-950 leading-tight ${isHighDensity ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>
              {exam.title}
            </h1>
            <div className="inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 bg-slate-100 border border-slate-400 rounded-full text-[11px] font-black">
              <span>نموذج:</span>
              <span className="text-blue-700 font-bold">{modelName}</span>
            </div>
          </div>

          <div className="text-left leading-tight font-bold w-1/3">
            <p>المادة: <span className="font-black text-slate-900">{exam.subject}</span></p>
            <p>الصف: <span className="text-slate-800">{exam.grade_level}</span></p>
            {config.header.showDuration && (
              <p>الزمن: <span className="text-slate-800">{exam.duration_minutes} دقيقة</span></p>
            )}
            {config.header.teacherName && (
              <p className="text-blue-900 mt-0.5">إعداد: {config.header.teacherName}</p>
            )}
          </div>
        </div>
      )}

      {config.headerStyle === 'boxed' && (
        <div className={`border-2 border-slate-900 rounded-lg bg-slate-50/50 ${isHighDensity ? 'p-1.5 mb-1.5 text-[11px]' : 'p-2.5 mb-2.5 text-xs'}`}>
          <div className="flex items-center justify-between font-bold border-b border-slate-300 pb-1 mb-1">
            <div>{config.header.schoolOrCenterName || config.header.ministryLine}</div>
            <div className="font-black text-slate-900 text-sm">{exam.title} ({modelName})</div>
            <div>المادة: {exam.subject} ({exam.grade_level})</div>
          </div>
          <div className="flex justify-between font-medium text-slate-700 text-[11px]">
            {config.header.showDuration && <span>الزمن: {exam.duration_minutes} دقيقة</span>}
            {config.header.showTotalMarks && <span>الدرجة: {exam.total_marks} درجة</span>}
            {config.header.teacherName && <span>مدرس المادة: {config.header.teacherName}</span>}
          </div>
        </div>
      )}

      {config.headerStyle === 'modern-gradient' && (
        <div className={`text-center border-b-2 border-slate-200 ${isHighDensity ? 'pb-1.5 mb-1.5' : 'pb-2.5 mb-2.5'}`}>
          <div
            className="inline-block px-3 py-0.5 rounded-full text-white text-[11px] font-bold mb-1 shadow-xs"
            style={{ backgroundColor: config.themeColor || '#1e3a8a' }}
          >
            {config.header.schoolOrCenterName || 'ExamForge Smart Testing'}
          </div>
          <h1 className={`font-black text-slate-900 ${isHighDensity ? 'text-lg' : 'text-2xl'}`}>{exam.title}</h1>
          <p className="text-[11px] font-bold text-slate-600 mt-0.5">
            {exam.subject} • {exam.grade_level} • نموذج ({modelName})
            {config.header.teacherName ? ` • إشراف: ${config.header.teacherName}` : ''}
          </p>
        </div>
      )}

      {(config.headerStyle === 'standard' || config.headerStyle === 'minimal') && (
        <div className={`text-center ${isHighDensity ? 'pb-1.5' : 'pb-2.5'}`}>
          <h1 className={`font-bold text-slate-900 ${isHighDensity ? 'text-lg' : 'text-2xl'}`}>{exam.title}</h1>
          <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-600 mt-0.5">
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
          </div>
        </div>
      )}

      {/* Student Info Box */}
      {config.header.showStudentInfoBox && (
        <div className={`pt-1.5 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs font-bold ${isHighDensity ? 'mt-1 text-[11px]' : 'mt-2'}`}>
          {config.header.studentFields.name && (
            <div className="flex items-center gap-1.5 flex-1 min-w-[180px]">
              <span>اسم الطالب:</span>
              <span className="border-b border-dotted border-slate-800 flex-1 h-3.5"></span>
            </div>
          )}
          {config.header.studentFields.seatNumber && (
            <div className="flex items-center gap-1.5">
              <span>رقم الجلوس:</span>
              <span className="border-b border-dotted border-slate-800 w-20 h-3.5"></span>
            </div>
          )}
          {config.header.studentFields.groupOrClass && (
            <div className="flex items-center gap-1.5">
              <span>الفصل:</span>
              <span className="border-b border-dotted border-slate-800 w-16 h-3.5"></span>
            </div>
          )}
        </div>
      )}

      {/* Exam Instructions */}
      {exam.instructions && (
        <div className={`p-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 ${isHighDensity ? 'mt-1 text-[10px]' : 'mt-1.5 text-xs'}`}>
          <span className="font-bold text-slate-900 ml-1">📌 تعليمات:</span>
          {exam.instructions}
        </div>
      )}
    </div>
  );

  // Compact Header for Page 2+
  const renderCompactHeader = (pageNumber: number, totalPagesCount: number) => (
    <div className="exam-running-header relative z-10 flex items-center justify-between border-b-2 border-slate-800 pb-1.5 mb-2.5 text-xs font-bold text-slate-800 print:block">
      <div className="flex items-center gap-2">
        <span className="font-black text-slate-950">{exam.title}</span>
        <span>•</span>
        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-black text-blue-800 text-[11px]">
          نموذج ({modelName})
        </span>
      </div>
      <div className="flex items-center gap-3 text-slate-600 text-[11px]">
        <span>{exam.subject} — {exam.grade_level}</span>
        <span>•</span>
        <span className="font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          ورقة ({pageNumber} من {totalPagesCount})
        </span>
      </div>
    </div>
  );

  // Single Question Renderer (supports Side-by-Side Diagram Layout)
  const renderQuestionItem = (q: any, globalIndex: number) => {
    const isMcq = q.question_type === 'mcq' || q.question_type === 'multiple_choice' || (q.choices && q.choices.length > 0);
    const isTf = q.question_type === 'true_false' || q.question_type === 'صح أو خطأ';
    const hasImage = q.image_urls && q.image_urls.length > 0;
    const useInlineImage = config.imagePosition === 'below' ? false : (hasImage && (isHighDensity || config.imagePosition === 'inline' || isMcq));

    return (
      <article key={q.id} className="break-inside-avoid">
        {useInlineImage ? (
          /* SIDE-BY-SIDE LAYOUT: Text & Choices on Right, Diagram on Left (Massive Space Saver!) */
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1.5 mb-0.5">
                <span className="font-black text-blue-950 shrink-0">
                  {formatQNum(globalIndex)}
                </span>
                <p className="font-bold text-slate-900 leading-snug flex-1">
                  {q.text}
                </p>
                {config.questions.showQuestionMarks && q.marks && (
                  <span className="text-[10px] font-semibold text-slate-500 shrink-0 mr-1">
                    [{q.marks} {q.marks === 1 ? 'درجة' : 'درجات'}]
                  </span>
                )}
              </div>

              {/* Choices */}
              {isMcq && q.choices && q.choices.length > 0 && (
                <div className={`grid gap-0.5 pr-2 mt-0.5 ${getChoicesGrid()}`}>
                  {q.choices.map((c: any, cIdx: number) => (
                    <div key={c.id || cIdx} className="text-xs font-medium text-slate-800 flex items-start gap-1">
                      <span className="font-bold text-blue-900 w-4 text-center shrink-0">
                        ({(choiceLetters[config.questions.choicesBullet] || choiceLetters['arabic-letters'])[cIdx] || c.choice_code})
                      </span>
                      <span className="leading-tight">{c.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* True/False box */}
              {isTf && (
                <div className="flex justify-end pr-3 mt-1">
                  <div className="w-6 h-6 rounded border border-slate-400 flex items-center justify-center font-bold text-slate-300 text-xs">
                    ( )
                  </div>
                </div>
              )}
            </div>

            {/* Diagram Image vertically centered */}
            <div className="shrink-0 flex items-center justify-center p-0.5 border border-slate-200 rounded bg-white shadow-2xs self-center">
              <img
                src={q.image_urls![0]}
                alt="رسم بياني"
                className={`${getImageMaxHeightClass()} max-w-[110px] sm:max-w-[140px] object-contain mx-auto`}
              />
            </div>
          </div>
        ) : (
          /* STANDARD VERTICAL LAYOUT */
          <div>
            <div className="flex items-start gap-1.5 mb-1">
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

            {hasImage && (
              <div className="my-1.5 flex justify-center">
                <img
                  src={q.image_urls![0]}
                  alt="رسم توضيحي"
                  className={`${getImageMaxHeightClass()} max-w-full object-contain rounded border border-slate-200 bg-white p-1`}
                />
              </div>
            )}

            {isMcq && q.choices && q.choices.length > 0 && (
              <div className={`grid gap-1.5 pr-4 mt-1 ${getChoicesGrid()}`}>
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

            {isTf && (
              <div className="flex justify-end pr-4 mt-1">
                <div className="w-7 h-7 rounded border-2 border-slate-400 flex items-center justify-center font-bold text-slate-300">
                  ( )
                </div>
              </div>
            )}

            {!isMcq && !isTf && config.questions.essayLinesCount > 0 && (
              <div className="space-y-1.5 mt-1.5 pr-4">
                {Array.from({ 
                  length: Math.max(1, isHighDensity ? 1 : config.questions.essayLinesCount)
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
          </div>
        )}
      </article>
    );
  };

  // Footer for each page
  const renderFooter = (pageNumber: number, totalPagesCount: number, isLastPage: boolean) => (
    <footer className="relative z-10 mt-auto pt-2 border-t-2 border-slate-900">
      {/* Optional QR Code on Last Page */}
      {isLastPage && config.qrCode?.enabled && qrCodeDataUrl && (
        <div className="mb-2 p-1.5 bg-slate-50 border border-slate-300 rounded-lg flex items-center justify-between gap-3">
          <div className="text-right">
            <span className="font-bold text-[11px] text-slate-800 block">🎬 {config.qrCode.title || 'فيديو الشرح ونموذج الإجابة:'}</span>
            <span className="text-[10px] text-slate-500 font-mono truncate max-w-sm block">{config.qrCode.url}</span>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <img src={qrCodeDataUrl} alt="QR Code" className="w-10 h-10 border border-slate-300 rounded p-0.5 bg-white" />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
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
  // BALANCED SMART PAGINATION (Calculates optimal page count)
  // ─────────────────────────────────────────────────────────────
  let effectiveChunkSize: number;

  if (qp > 0) {
    // User explicitly chose a fixed number of questions per page
    effectiveChunkSize = qp;
  } else {
    // AUTO MODE (Smart Balanced Distribution):
    if (config.columns === 2) {
      if (totalQs <= 14) {
        effectiveChunkSize = totalQs;
      } else {
        const targetPages = Math.ceil(totalQs / 14);
        effectiveChunkSize = Math.ceil(totalQs / targetPages);
      }
    } else {
      // 1 column:
      if (totalQs <= 10) {
        // Up to 10 questions -> fit all on 1 page!
        effectiveChunkSize = totalQs;
      } else if (totalQs <= 20) {
        // 11 to 20 questions -> balanced on 2 pages! (e.g. 18 -> 9 & 9)
        effectiveChunkSize = Math.ceil(totalQs / 2);
      } else if (totalQs <= 30) {
        // 21 to 30 questions -> balanced on 3 pages!
        effectiveChunkSize = Math.ceil(totalQs / 3);
      } else {
        const targetPages = Math.ceil(totalQs / 10);
        effectiveChunkSize = Math.ceil(totalQs / targetPages);
      }
    }
  }

  const pageChunks: Array<typeof questions> = [];
  for (let i = 0; i < totalQs; i += effectiveChunkSize) {
    pageChunks.push(questions.slice(i, i + effectiveChunkSize));
  }
  if (pageChunks.length === 0) pageChunks.push([]);
  const totalPages = pageChunks.length;

  return (
    <div className="exam-pages-container space-y-8 print:space-y-0 print:m-0 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page-wrapper {
            page-break-after: always !important;
            break-after: page !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .exam-pages-container {
            margin: 0 !important;
            padding: 0 !important;
          }
          .exam-a4-page {
            width: 200mm !important;
            max-width: 200mm !important;
            height: 287mm !important;
            max-height: 287mm !important;
            min-height: 287mm !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            margin: 5mm auto !important;
            padding: 4mm 6mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: always !important;
            break-after: page !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .exam-a4-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />

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
                ? 'p-5 max-w-4xl shadow-lg rounded-xl text-sm min-h-[720px]'
                : 'p-5 sm:p-6 max-w-[210mm] w-full shadow-xl rounded-md min-h-[297mm] max-h-[297mm] overflow-hidden'
            }`}
            style={{
              fontSize: effectiveFontSize,
              pageBreakAfter: pIdx < totalPages - 1 ? 'always' : 'auto',
              breakAfter: pIdx < totalPages - 1 ? 'page' : 'auto',
            }}
          >
            {renderWatermark()}

            {/* Page Content: Header + Questions */}
            <div className="flex-1 flex flex-col min-h-0">
              {pIdx === 0 ? renderFullHeader() : renderCompactHeader(pageNum, totalPages)}

              {/* Questions Grid / Main */}
              <main
                className={`relative z-10 flex-1 ${
                  config.columns === 2 ? 'columns-1 md:columns-2 gap-6 [column-rule:1px_solid_#e2e8f0]' : ''
                }`}
              >
                <div className={getQuestionSpacingClass()}>
                  {chunk.map((q, qLocalIdx) => {
                    const globalIndex = pIdx * effectiveChunkSize + qLocalIdx;
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
};
