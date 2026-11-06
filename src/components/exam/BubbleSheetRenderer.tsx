'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface BubbleSheetProps {
  exam: {
    title: string;
    subject: string;
    grade_level: string;
    models_count?: number;
  };
  modelName: string;
  totalQuestions: number;
  choicesCount?: number; // usually 4 (A, B, C, D)
  examId?: string;
}

export const BubbleSheetRenderer: React.FC<BubbleSheetProps> = ({
  exam,
  modelName,
  totalQuestions,
  choicesCount = 4,
  examId,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const choiceSymbols = ['أ', 'ب', 'ج', 'د', 'هـ'];

  // Encode exam verification payload into QR
  useEffect(() => {
    const payload = JSON.stringify({
      eid: examId || 'exam',
      model: modelName,
      qcount: totalQuestions,
      type: 'OMR_BUBBLE_SHEET',
    });

    QRCode.toDataURL(payload, { width: 90, margin: 1 })
      .then(url => setQrCodeUrl(url))
      .catch(e => console.error(e));
  }, [examId, modelName, totalQuestions]);

  // Divide questions into columns (e.g. 20 per column)
  const questionsPerColumn = 15;
  const columnsCount = Math.max(1, Math.ceil(totalQuestions / questionsPerColumn));
  const columns = Array.from({ length: columnsCount }, (_, colIdx) => {
    const start = colIdx * questionsPerColumn;
    const end = Math.min(start + questionsPerColumn, totalQuestions);
    return Array.from({ length: end - start }, (_, i) => start + i + 1);
  });

  return (
    <div
      dir="rtl"
      className="bg-white text-slate-950 p-8 max-w-4xl mx-auto border-4 border-slate-900 rounded-xl shadow-lg font-sans select-none print:shadow-none print:border-4 print:border-slate-900 print:m-0 print:p-6"
    >
      {/* 4 OMR Corner Alignment Markers for Camera Scanner detection */}
      <div className="relative">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
          {/* Top-Right Corner Marker */}
          <div className="w-8 h-8 bg-slate-950 flex items-center justify-center text-white text-[10px] font-black shrink-0">
            ⬛
          </div>

          <div className="text-center flex-1 px-4">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              ورقة الإجابة الإلكترونية الذكية (OMR Bubble Sheet)
            </h1>
            <p className="text-xs font-bold text-slate-600 mt-1">
              {exam.title} • {exam.subject} ({exam.grade_level})
            </p>
          </div>

          {/* Top-Left Corner Marker + QR Code */}
          <div className="flex items-center gap-2 shrink-0">
            {qrCodeUrl && (
              <img src={qrCodeUrl} alt="QR Sheet Code" className="w-14 h-14 border border-slate-300 p-0.5 rounded" />
            )}
            <div className="w-8 h-8 bg-slate-950 flex items-center justify-center text-white text-[10px] font-black">
              ⬛
            </div>
          </div>
        </div>

        {/* Student Data Box & Model Code Selection */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 text-xs font-bold border-2 border-slate-800 p-3 rounded-lg bg-slate-50/60">
          <div className="md:col-span-8 space-y-2">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-slate-800">اسم الطالب رباعي:</span>
              <span className="border-b border-dotted border-slate-800 flex-1 h-5"></span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-slate-800">رقم الجلوس:</span>
                <span className="border-b border-dotted border-slate-800 flex-1 h-5"></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-slate-800">الفصل / السنتر:</span>
                <span className="border-b border-dotted border-slate-800 flex-1 h-5"></span>
              </div>
            </div>
          </div>

          {/* Model Selection Bubble */}
          <div className="md:col-span-4 border-r-2 border-slate-300 pr-3 flex flex-col justify-center">
            <span className="text-[11px] text-slate-700 block mb-1">نموذج الامتحان المخصص:</span>
            <div className="flex items-center gap-3">
              {['أ', 'ب', 'ج', 'د'].map((m) => (
                <div key={m} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-bold text-slate-800">{m}</span>
                  <div
                    className={`w-6 h-6 rounded-full border-2 border-slate-900 flex items-center justify-center text-xs font-black ${
                      m === modelName ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                    }`}
                  >
                    {m === modelName ? '✓' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions Banner */}
        <div className="bg-slate-100 border border-slate-300 rounded p-2 mb-4 text-[11px] text-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-900">⚠️ تعليمات التظليل:</span>
            <span>ظلل دائرة واحدة فقط بالقلم الجاف أو الرصاص تظليلاً كاملاً داخل الإطار.</span>
          </div>
          <div className="flex items-center gap-3 font-mono font-bold">
            <span className="flex items-center gap-1 text-emerald-700">
              <span className="w-3.5 h-3.5 rounded-full bg-slate-900 inline-block"></span> صحيح
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <span className="w-3.5 h-3.5 rounded-full border border-slate-900 inline-flex items-center justify-center text-[8px]">✗</span> خطأ
            </span>
          </div>
        </div>

        {/* Bubble Grid Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
          {columns.map((colQuestions, cIndex) => (
            <div key={cIndex} className="border border-slate-300 rounded-lg p-2.5 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2 text-xs font-bold text-slate-600">
                <span>رقم</span>
                <div className="flex items-center gap-3 pl-1">
                  {choiceSymbols.slice(0, choicesCount).map((s) => (
                    <span key={s} className="w-5 text-center text-blue-950 font-black">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {colQuestions.map((qNum) => (
                  <div key={qNum} className="flex items-center justify-between py-0.5 hover:bg-slate-50 transition rounded">
                    <span className="w-6 text-xs font-bold text-slate-700 text-center">
                      {qNum}
                    </span>
                    <div className="flex items-center gap-3 pl-1">
                      {choiceSymbols.slice(0, choicesCount).map((sym) => (
                        <div
                          key={sym}
                          className="w-5 h-5 rounded-full border-2 border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-700 bg-white"
                        >
                          {sym}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Corner Markers and Footer */}
        <div className="flex items-center justify-between border-t-2 border-slate-900 pt-3 text-xs font-bold text-slate-500">
          <div className="w-8 h-8 bg-slate-950 flex items-center justify-center text-white text-[10px] font-black shrink-0">
            ⬛
          </div>
          <div className="text-center font-bold text-slate-800 text-xs">
            نظام التصحيح الإلكتروني الذكي OMR • منصة ExamForge
          </div>
          <div className="w-8 h-8 bg-slate-950 flex items-center justify-center text-white text-[10px] font-black shrink-0">
            ⬛
          </div>
        </div>
      </div>
    </div>
  );
};
