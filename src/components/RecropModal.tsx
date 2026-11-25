'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Crop, 
  Upload, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Check, 
  Loader2, 
  FileText, 
  AlertTriangle,
  Image as ImageIcon,
  Sparkles
} from 'lucide-react';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { Question } from '@/types/database';
import { updateQuestionImageAction, getSourcePdfUrlAction, removeQuestionImageAction } from '@/app/admin/question-bank/actions';
import { cachePdfFile, getCachedPdf } from '@/lib/utils/pdf-cache';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface RecropModalProps {
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
  onImageUpdated: (questionId: string, newImageUrl: string) => void;
  onImageRemoved: (questionId: string) => void;
}

export default function RecropModal({
  isOpen,
  question,
  onClose,
  onImageUpdated,
  onImageRemoved,
}: RecropModalProps) {
  const [activeTab, setActiveTab] = useState<'pdf' | 'upload'>('pdf');
  
  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.5);
  const [renderingPage, setRenderingPage] = useState(false);

  // Crop drag state
  const [isDragging, setIsDragging] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [croppedPreviewUrl, setCroppedPreviewUrl] = useState<string | null>(null);

  // Manual Upload / Paste state
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);

  // Action states
  const [isSaving, setIsSaving] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Refs
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Reset and load when question changes or modal opens
  useEffect(() => {
    if (!isOpen || !question) {
      setPdfDoc(null);
      setPdfError(null);
      setCropBox(null);
      setCroppedPreviewUrl(null);
      setUploadedBase64(null);
      setActionMsg(null);
      return;
    }

    // Set initial page from source_page or 1
    const initPage = question.source_page && question.source_page > 0 ? question.source_page : 1;
    setCurrentPage(initPage);
    setCropBox(null);
    setCroppedPreviewUrl(null);
    setUploadedBase64(null);
    setActionMsg(null);

    // Try to load PDF from cache or source
    loadPdfAuto(question.source_id);
  }, [isOpen, question]);

  // Load PDF automatically: checks local IndexedDB cache first, then cloud storage
  const loadPdfAuto = async (sourceId?: string | null) => {
    try {
      setLoadingPdf(true);
      setPdfError(null);

      // 1. Try local IndexedDB cache first (instant, zero network latency)
      const cached = await getCachedPdf(sourceId || undefined);
      if (cached) {
        const data = new Uint8Array(cached);
        const doc = await pdfjsLib.getDocument({ data }).promise;
        const targetPage = question?.source_page && question.source_page > 0
          ? Math.min(question.source_page, doc.numPages)
          : 1;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(targetPage);
        setLoadingPdf(false);
        setTimeout(() => {
          renderCurrentPage(targetPage);
        }, 80);
        return;
      }

      // 2. Try Supabase cloud signed URL if source_id is present
      if (sourceId) {
        const res = await getSourcePdfUrlAction(sourceId);
        if (res.success && res.url) {
          const response = await fetch(res.url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const doc = await pdfjsLib.getDocument({ data }).promise;
            const targetPage = question?.source_page && question.source_page > 0
              ? Math.min(question.source_page, doc.numPages)
              : 1;
            setPdfDoc(doc);
            setTotalPages(doc.numPages);
            setCurrentPage(targetPage);
            // Save to local cache for future questions
            cachePdfFile(sourceId, arrayBuffer);
            setLoadingPdf(false);
            setTimeout(() => {
              renderCurrentPage(targetPage);
            }, 80);
            return;
          }
        }
      }

      // 3. Fallback: Prompt teacher to pick book PDF once
      setPdfError('اختر ملف الـ PDF الخاص بالكتاب لقص السؤال مباشرة (يُحفظ في جهازك تلقائياً لقص باقي الأسئلة فوراً)');
    } catch (err: any) {
      console.warn('Could not auto-load source PDF:', err);
      setPdfError('اختر ملف الـ PDF الخاص بالكتاب لقص السؤال مباشرة (يُحفظ في جهازك تلقائياً لقص باقي الأسئلة فوراً)');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Load PDF from local file picker & cache in IndexedDB
  const handleLocalPdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoadingPdf(true);
      setPdfError(null);
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const doc = await pdfjsLib.getDocument({ data }).promise;

      const targetPage = question?.source_page && question.source_page > 0
        ? Math.min(question.source_page, doc.numPages)
        : 1;

      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(targetPage);

      // Cache locally in IndexedDB so all other questions load it instantly
      await cachePdfFile(question?.source_id || 'active_book', arrayBuffer);
      setLoadingPdf(false);
      setTimeout(() => {
        renderCurrentPage(targetPage);
      }, 80);
    } catch (err: any) {
      setPdfError('تعذر فتح ملف الـ PDF المختار: ' + err.message);
      setLoadingPdf(false);
    }
  };

  // 2. Render PDF Page on canvas whenever pdfDoc, currentPage, or scale changes
  const renderCurrentPage = useCallback(async (pageNumToRender?: number) => {
    if (!pdfDoc) return;
    const canvas = pageCanvasRef.current;
    if (!canvas) return;

    const pageNum = pageNumToRender ?? currentPage;
    if (pageNum < 1 || (totalPages > 0 && pageNum > totalPages)) return;

    try {
      setRenderingPage(true);
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      setCropBox(null);
      setCroppedPreviewUrl(null);
    } catch (err) {
      console.error('Error rendering page:', err);
    } finally {
      setRenderingPage(false);
    }
  }, [pdfDoc, currentPage, totalPages, scale]);

  useEffect(() => {
    if (pdfDoc) {
      renderCurrentPage();
    }
  }, [pdfDoc, currentPage, scale, renderCurrentPage]);

  // 3. Interactive Crop Events
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!overlayRef.current || !pageCanvasRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setCropStart({ x, y });
    setCropBox({ x, y, w: 0, h: 0 });
    setCroppedPreviewUrl(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !cropStart || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(currentX - cropStart.x);
    const h = Math.abs(currentY - cropStart.y);

    setCropBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    if (cropBox && cropBox.w > 15 && cropBox.h > 15 && pageCanvasRef.current) {
      generateCroppedPreview(cropBox);
    }
  };

  // Generate cropped preview from canvas
  const generateCroppedPreview = (box: { x: number; y: number; w: number; h: number }) => {
    const srcCanvas = pageCanvasRef.current;
    if (!srcCanvas) return;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = box.w;
    cropCanvas.height = box.h;
    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      srcCanvas,
      box.x,
      box.y,
      box.w,
      box.h,
      0,
      0,
      box.w,
      box.h
    );

    const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.92);
    setCroppedPreviewUrl(dataUrl);
  };

  // 4. Save and Update Question Image
  const handleSaveCrop = async () => {
    const finalImage = activeTab === 'pdf' ? croppedPreviewUrl : uploadedBase64;
    if (!finalImage || !question) {
      setActionMsg({ type: 'error', text: 'يرجى تحديد وقص صورة أولاً' });
      return;
    }

    try {
      setIsSaving(true);
      setActionMsg(null);

      const res = await updateQuestionImageAction(question.id, question.teacher_id, finalImage);
      if (!res.success || !res.url) {
        throw new Error(res.error || 'فشل تحديث صورة السؤال');
      }

      setActionMsg({ type: 'success', text: 'تم حفظ وقص الصورة واعتمادها بنجاح!' });
      onImageUpdated(question.id, res.url);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ الصورة' });
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Remove Image Completely
  const handleRemoveImage = async () => {
    if (!question) return;
    if (!confirm('هل أنت متأكد من حذف صورة السؤال تماماً؟ (استخدم هذا الخيار إذا كان السؤال نصياً فقط ولا يحتاج صورة)')) {
      return;
    }

    try {
      setIsSaving(true);
      const res = await removeQuestionImageAction(question.id);
      if (!res.success) throw new Error(res.error);

      onImageRemoved(question.id);
      onClose();
    } catch (err: any) {
      alert('خطأ: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // 6. Handle Direct File Upload / Clipboard Paste
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setUploadedBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Paste support
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              setUploadedBase64(reader.result as string);
              setActiveTab('upload');
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen || !question) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div 
        className="bg-white w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-2xl">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800">
                إعادة قص وتصحيح صورة السؤال
              </h2>
              <p className="text-xs text-slate-500">
                قص الصورة يدوياً مباشرة من صفحة الكتاب الأصلية أو رفع صورة بديلة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 text-slate-500 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Details Banner */}
        <div className="px-6 py-3 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <span className="text-[11px] font-bold text-amber-800 ml-2">نص السؤال:</span>
            <span className="text-xs font-semibold text-slate-700 line-clamp-1">{question.text}</span>
          </div>
          {question.image_urls && question.image_urls.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">الصورة الحالية ملخبطة أو زيادة؟</span>
              <button
                onClick={handleRemoveImage}
                disabled={isSaving}
                className="px-2.5 py-1 text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف الصورة نهائياً</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-white px-6 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`pb-3 px-2 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'pdf'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>قص تفاعلي من صفحة الـ PDF</span>
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-2 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>رفع صورة من الجهاز / لصق (Ctrl+V)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {actionMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                actionMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {actionMsg.type === 'success' ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              <span>{actionMsg.text}</span>
            </div>
          )}

          {activeTab === 'pdf' ? (
            <div className="space-y-4">
              {/* Question Preview & Direct Jump Banner */}
              {question && (
                <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-black text-blue-900 bg-blue-100 px-2 py-0.5 rounded-md">
                        السؤال الحالي:
                      </span>
                      {question.source_page && (
                        <span className="text-xs font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                          📖 صفحة السؤال في الكتاب: ص {question.source_page}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-semibold line-clamp-1">
                      {question.text}
                    </p>
                  </div>

                  {question.source_page && currentPage !== question.source_page && pdfDoc && (
                    <button
                      type="button"
                      onClick={() => {
                        const p = question.source_page!;
                        setCurrentPage(p);
                        renderCurrentPage(p);
                      }}
                      className="shrink-0 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5"
                    >
                      <span>🎯 انتقال لصفحة السؤال (ص {question.source_page})</span>
                    </button>
                  )}
                </div>
              )}

              {/* PDF Toolbar */}
              <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">الصفحة:</span>
                  <button
                    onClick={() => {
                      const nextP = Math.max(1, currentPage - 1);
                      setCurrentPage(nextP);
                      renderCurrentPage(nextP);
                    }}
                    disabled={currentPage <= 1 || renderingPage}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={totalPages || 999}
                    value={currentPage}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (val >= 1 && (!totalPages || val <= totalPages)) {
                        setCurrentPage(val);
                        renderCurrentPage(val);
                      }
                    }}
                    className="w-14 text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500 font-bold">
                    من {totalPages || '...'}
                  </span>

                  <button
                    onClick={() => {
                      const nextP = totalPages ? Math.min(totalPages, currentPage + 1) : currentPage + 1;
                      setCurrentPage(nextP);
                      renderCurrentPage(nextP);
                    }}
                    disabled={(totalPages > 0 && currentPage >= totalPages) || renderingPage}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">الزووم:</span>
                  <button
                    onClick={() => setScale((s) => Math.max(0.8, Number((s - 0.2).toFixed(1))))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                    title="تصغير"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700 min-w-[40px] text-center">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    onClick={() => setScale((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))))}
                    className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100"
                    title="تكبير"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>

                {/* Choose PDF from device if needed */}
                <div>
                  <button
                    onClick={() => pdfFileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5 text-blue-600" />
                    <span>تغيير / فتح PDF من جهازك</span>
                  </button>
                  <input
                    ref={pdfFileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleLocalPdfSelected}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div className="text-xs text-blue-700 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-blue-600" />
                <span>
                  <strong>طريقة القص:</strong> اضغط واسحب بالماوس فوق أي جزء في الصفحة لتحديده بالمستطيل، ثم اضغط &ldquo;حفظ واعتماد القص&rdquo;.
                </span>
              </div>

              {/* PDF Viewport with Crop Overlay */}
              {pdfError && !pdfDoc ? (
                <div 
                  onClick={() => pdfFileInputRef.current?.click()}
                  className="p-8 sm:p-10 text-center bg-blue-50/50 hover:bg-blue-50/80 rounded-3xl border-2 border-dashed border-blue-300 hover:border-blue-500 cursor-pointer transition space-y-3"
                >
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800">
                      اضغط هنا لفتح ملف الـ PDF للكتاب من جهازك
                    </h3>
                    {question?.source_page ? (
                      <p className="text-xs text-blue-700 font-bold bg-blue-100/80 px-3 py-1.5 rounded-xl inline-block mt-1">
                        🎯 سيتم فتح صفحة السؤال (صفحة {question.source_page}) فور اختيار الكتاب مباشرة!
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        اختر ملف الكتاب مرة واحدة فقط، وسيتم حفظه تلقائياً في متصفحك لقص أي سؤال آخر فوراً بدون تكرار الاختيار.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      pdfFileInputRef.current?.click();
                    }}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/20 transition inline-flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>📁 اختيار ملف الـ PDF</span>
                  </button>
                </div>
              ) : (
                <div className="relative border border-slate-300 rounded-2xl overflow-auto max-h-[500px] bg-slate-100 flex justify-center p-4 select-none min-h-[300px]">
                  {loadingPdf && (
                    <div className="absolute inset-0 bg-white/80 z-20 flex flex-col items-center justify-center gap-2 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <span className="text-xs font-bold">
                        {question?.source_page 
                          ? `جاري فتح صفحة السؤال (${question.source_page})...` 
                          : 'جاري تحميل صفحة الكتاب...'}
                      </span>
                    </div>
                  )}

                  <div className="relative inline-block shadow-lg">
                    {/* Rendered PDF Page */}
                    <canvas ref={pageCanvasRef} className="block bg-white rounded-lg" />

                    {/* Interactive Selection Overlay */}
                    <div
                      ref={overlayRef}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      className="absolute inset-0 cursor-crosshair z-10"
                    >
                      {cropBox && cropBox.w > 0 && cropBox.h > 0 && (
                        <div
                          style={{
                            left: `${cropBox.x}px`,
                            top: `${cropBox.y}px`,
                            width: `${cropBox.w}px`,
                            height: `${cropBox.h}px`,
                          }}
                          className="absolute border-2 border-emerald-500 bg-emerald-500/25 shadow-sm pointer-events-none rounded-xs"
                        >
                          <div className="absolute top-0 right-0 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-bl">
                            {Math.round(cropBox.w)} × {Math.round(cropBox.h)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Crop Preview Box */}
              {croppedPreviewUrl && (
                <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      معاينة الجزء المقصوص:
                    </span>
                    <button
                      onClick={() => {
                        setCropBox(null);
                        setCroppedPreviewUrl(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-800 underline font-bold"
                    >
                      إلغاء وإعادة القص
                    </button>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-emerald-200 inline-block shadow-xs max-w-full overflow-hidden">
                    <img
                      src={croppedPreviewUrl}
                      alt="معاينة القص"
                      className="max-h-48 w-auto rounded object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Upload / Paste Tab */
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 rounded-2xl text-center cursor-pointer transition space-y-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-700">
                  اضغط لاختيار صورة من جهازك (PNG, JPG) أو الصق مباشرة بـ <kbd className="bg-slate-200 px-1.5 py-0.5 rounded text-[11px]">Ctrl+V</kbd>
                </p>
                <p className="text-xs text-slate-400">
                  لو صورت السؤال بموبايلك أو عملت سكرين شوت، تقدر ترفعها أو تلصقها فوراً
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </div>

              {uploadedBase64 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700">الصورة المختارة:</span>
                    <button
                      onClick={() => setUploadedBase64(null)}
                      className="text-xs text-rose-600 hover:underline font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block shadow-xs max-w-full overflow-hidden">
                    <img
                      src={uploadedBase64}
                      alt="الصورة المرفوعة"
                      className="max-h-56 w-auto rounded object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            إلغاء
          </button>

          <button
            onClick={handleSaveCrop}
            disabled={isSaving || (activeTab === 'pdf' ? !croppedPreviewUrl : !uploadedBase64)}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-2 transition"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري حفظ واعتماد الصورة...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>حفظ واعتماد الصورة للسؤال</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
