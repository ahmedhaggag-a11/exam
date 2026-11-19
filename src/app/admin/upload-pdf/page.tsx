'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Play, 
  Layers, 
  ChevronLeft,
  Check
} from 'lucide-react';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { PDFDocument } from 'pdf-lib';
import { 
  registerSourceRecord, 
  extractQuestionsFromChunkAction, 
  saveQuestionsBulk, 
  uploadImageFromBase64 
} from './actions';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  subjects: string[];
  grades: string[];
}

interface ChunkInfo {
  index: number;
  startPage: number;
  endPage: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  questionsCount?: number;
  error?: string;
}

export default function AdminUploadPDFPage() {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('الفيزياء');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('الترم الأول');
  const [sourceName, setSourceName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [sourceRecordId, setSourceRecordId] = useState<string | null>(null);

  // Chunking config
  const [chunkSize, setChunkSize] = useState<number>(5); // Default 5 pages: completely safe for huge 130MB+ scanned books
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalExtractedQuestions, setTotalExtractedQuestions] = useState(0);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadTeachers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, subjects, grades')
        .eq('role', 'teacher');
      if (data && data.length > 0) {
        setTeachers(data);
        setSelectedTeacherId(data[0].id);
        if (data[0].subjects && data[0].subjects.length > 0) {
          setSelectedSubject(data[0].subjects[0]);
        }
        if (data[0].grades && data[0].grades.length > 0) {
          setSelectedGrade(data[0].grades[0]);
        }
      }
    }
    loadTeachers();
  }, [supabase]);

  // Handle PDF file selection & inspect page count
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      if (!sourceName) {
        setSourceName(f.name.replace(/\.[^/.]+$/, ''));
      }

      try {
        setStatusMsg({ type: 'success', text: 'جاري فحص صفحات المستند...' });
        const arrayBuffer = await f.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = pdfDoc.numPages;
        setTotalPages(pages);

        // Generate chunks
        const generatedChunks: ChunkInfo[] = [];
        let chunkIndex = 0;
        for (let i = 1; i <= pages; i += chunkSize) {
          generatedChunks.push({
            index: chunkIndex,
            startPage: i,
            endPage: Math.min(i + chunkSize - 1, pages),
            status: 'pending',
          });
          chunkIndex++;
        }
        setChunks(generatedChunks);
        setCurrentChunkIndex(0);
        setTotalExtractedQuestions(0);
        setStatusMsg({
          type: 'success',
          text: `تم تحميل المستند بنجاح! إجمالي الصفحات: ${pages} صفحة تم تقسيمها تلقائياً إلى ${generatedChunks.length} جزء (كل جزء ${chunkSize} صفحات لضمان الأمان والسرعة للكتب الثقيلة).`,
        });
      } catch (err: any) {
        console.error('Error reading PDF:', err);
        setStatusMsg({ type: 'error', text: 'تعذر قراءة ملف الـ PDF. تأكد من سلامة الملف.' });
      }
    }
  };

  const cropImageFromPdf = async (pdfDoc: any, pageNumber: number, box: number[]): Promise<string | null> => {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context, viewport }).promise;

      const [ymin, xmin, ymax, xmax] = box;
      const cropX = (xmin / 1000) * canvas.width;
      const cropY = (ymin / 1000) * canvas.height;
      const cropW = ((xmax - xmin) / 1000) * canvas.width;
      const cropH = ((ymax - ymin) / 1000) * canvas.height;

      const padding = 10;
      const finalX = Math.max(0, cropX - padding);
      const finalY = Math.max(0, cropY - padding);
      const finalW = Math.min(canvas.width - finalX, cropW + (padding * 2));
      const finalH = Math.min(canvas.height - finalY, cropH + (padding * 2));

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = finalW;
      cropCanvas.height = finalH;
      const cropCtx = cropCanvas.getContext('2d');
      
      cropCtx?.drawImage(
        canvas,
        finalX, finalY, finalW, finalH,
        0, 0, finalW, finalH
      );

      return cropCanvas.toDataURL('image/png');
    } catch (e) {
      console.error('Error cropping image from PDF:', e);
      return null;
    }
  };

  // Process a specific chunk
  const processChunk = async (chunkIdx: number) => {
    if (!file || !selectedTeacherId) return;
    const chunk = chunks[chunkIdx];
    if (!chunk) return;

    setIsProcessing(true);
    setStatusMsg({
      type: 'success',
      text: `جاري استخراج الأسئلة من الجزء رقم (${chunkIdx + 1}/${chunks.length}) [الصفحات من ${chunk.startPage} إلى ${chunk.endPage}]...`,
    });

    // Update chunk status to processing
    setChunks((prev) =>
      prev.map((c, i) => (i === chunkIdx ? { ...c, status: 'processing' } : c))
    );

    try {
      // 1. Ensure source record exists
      let activeSourceId = sourceRecordId;
      if (!activeSourceId) {
        const srcRes = await registerSourceRecord(
          selectedTeacherId,
          sourceName || file.name,
          file.name,
          file.size,
          selectedSubject,
          selectedGrade
        );
        if (!srcRes.success || !srcRes.sourceData) {
          throw new Error(srcRes.error || 'تعذر إنشاء سجل للمصدر');
        }
        activeSourceId = srcRes.sourceData.id;
        setSourceRecordId(activeSourceId);
      }

      // 2. Slice pages using pdf-lib in browser
      const fullBuffer = await file.arrayBuffer();
      const originalPdfDoc = await PDFDocument.load(fullBuffer);
      const subPdfDoc = await PDFDocument.create();

      // Zero-based page indices
      const pageIndices: number[] = [];
      for (let p = chunk.startPage - 1; p < chunk.endPage; p++) {
        pageIndices.push(p);
      }

      const copiedPages = await subPdfDoc.copyPages(originalPdfDoc, pageIndices);
      copiedPages.forEach((page) => subPdfDoc.addPage(page));

      const chunkPdfBytes = await subPdfDoc.save();
      
      // Convert chunk bytes to base64
      let binary = '';
      for (let i = 0; i < chunkPdfBytes.byteLength; i++) {
        binary += String.fromCharCode(chunkPdfBytes[i]);
      }
      const chunkBase64 = btoa(binary);

      // 3. Send lightweight chunk to Gemini
      const chunkLabel = `الجزء ${chunkIdx + 1} (ص ${chunk.startPage} - ${chunk.endPage})`;
      const extractRes = await extractQuestionsFromChunkAction(
        chunkBase64,
        selectedSubject,
        sourceName || file.name,
        chunkLabel
      );

      if (!extractRes || extractRes.success === false) {
        throw new Error(extractRes?.error || 'تعذر معالجة الجزء على السيرفر');
      }

      const extractedQs = Array.isArray(extractRes.questions) ? extractRes.questions : [];

      // 4. Crop images if any
      const questionsWithImages = extractedQs.filter(
        (q: any) => q.has_image && q.image_page_number && q.image_box
      );

      if (questionsWithImages.length > 0) {
        const pdfJsDoc = await pdfjsLib.getDocument({ data: fullBuffer }).promise;
        for (let i = 0; i < extractedQs.length; i++) {
          const q = extractedQs[i];
          if (q.has_image && q.image_page_number && q.image_box) {
            // Absolute page number in the original book
            const absPageNum = chunk.startPage + (q.image_page_number - 1);
            const pageNum = Math.min(Math.max(1, absPageNum), pdfJsDoc.numPages);
            const base64Img = await cropImageFromPdf(pdfJsDoc, pageNum, q.image_box);
            if (base64Img) {
              const url = await uploadImageFromBase64(base64Img, selectedTeacherId);
              if (url) q.final_image_url = url;
            }
          }
        }
      }

      // 5. Save chunk questions to DB
      if (extractedQs.length > 0) {
        const saveRes = await saveQuestionsBulk(
          selectedTeacherId,
          activeSourceId!,
          selectedSubject,
          selectedGrade,
          selectedTerm,
          extractedQs
        );
        if (!saveRes.success) throw new Error(saveRes.error);
      }

      // Update chunk state
      setChunks((prev) =>
        prev.map((c, i) =>
          i === chunkIdx
            ? { ...c, status: 'completed', questionsCount: extractedQs.length }
            : c
        )
      );

      setTotalExtractedQuestions((prev) => prev + extractedQs.length);
      setCurrentChunkIndex(chunkIdx + 1);

      setStatusMsg({
        type: 'success',
        text: extractedQs.length > 0 
          ? `تم بنجاح استخراج وحفظ الجزء (${chunkIdx + 1}) بواقع ${extractedQs.length} سؤال!`
          : `اكتمل فحص الجزء (${chunkIdx + 1}) - صفحات شرح بدون أسئلة. تم التخطي بنجاح!`,
      });
    } catch (err: any) {
      console.error(err);
      setChunks((prev) =>
        prev.map((c, i) => (i === chunkIdx ? { ...c, status: 'error', error: err.message } : c))
      );
      setStatusMsg({
        type: 'error',
        text: `حدث خطأ في الجزء (${chunkIdx + 1}): ${err.message}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          رفع الكتب والمذكرات الكبيرة واستخراج بنك الأسئلة بالتقسيم الآلي
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          يدعم الكتب حتى 300+ صفحة؛ يتم تقسيم الكتاب تلقائياً إلى أجزاء ومعالجتها جزءاً تلو الآخر بدقة تامة.
        </p>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 ${
            statusMsg.type === 'success'
              ? isProcessing 
                ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          {statusMsg.type === 'success' ? (
             isProcessing ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" /> : <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Basic Settings */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">اختر المعلم المستهدف</label>
          <select
            disabled={isProcessing || chunks.some(c => c.status === 'completed')}
            value={selectedTeacherId}
            onChange={(e) => {
              setSelectedTeacherId(e.target.value);
              const t = teachers.find((x) => x.id === e.target.value);
              if (t && t.subjects && t.subjects.length > 0) setSelectedSubject(t.subjects[0]);
              if (t && t.grades && t.grades.length > 0) setSelectedGrade(t.grades[0]);
            }}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.email})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">المادة الدراسية</label>
            <input
              type="text"
              disabled={isProcessing}
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">السنة الدراسية</label>
            <select
              disabled={isProcessing}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {(teachers.find(t => t.id === selectedTeacherId)?.grades || []).map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
              {(teachers.find(t => t.id === selectedTeacherId)?.grades || []).length === 0 && (
                <>
                  <option value="الصف الأول الثانوي">الصف الأول الثانوي</option>
                  <option value="الصف الثاني الثانوي">الصف الثاني الثانوي</option>
                  <option value="الصف الثالث الثانوي">الصف الثالث الثانوي</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">الترم الدراسي</label>
            <select
              disabled={isProcessing}
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="الترم الأول">الترم الأول</option>
              <option value="الترم الثاني">الترم الثاني</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">عنوان المصدر / اسم الكتاب</label>
            <input
              type="text"
              disabled={isProcessing}
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="مثال: كتاب التفوق فيزياء 2026"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              حجم الجزء بالصفحات (للكتب الثقيلة والمصورة عالية الدقة)
            </label>
            <select
              disabled={isProcessing || chunks.some(c => c.status === 'completed')}
              value={chunkSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                setChunkSize(newSize);
                if (totalPages > 0) {
                  const gen: ChunkInfo[] = [];
                  let idx = 0;
                  for (let i = 1; i <= totalPages; i += newSize) {
                    gen.push({
                      index: idx,
                      startPage: i,
                      endPage: Math.min(i + newSize - 1, totalPages),
                      status: 'pending',
                    });
                    idx++;
                  }
                  setChunks(gen);
                  setCurrentChunkIndex(0);
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={3}>3 صفحات (أقصى أمان للكتب الممسوحة ضوئياً بجودة فائقة 100MB+)</option>
              <option value={5}>5 صفحات (موصى به لكتب الشرح والمذكرات الكبيرة)</option>
              <option value={10}>10 صفحات (للكتب العادية والصغيرة)</option>
              <option value={15}>15 صفحة (للمذكرات الخفيفة والنصوص الرقمية)</option>
            </select>
          </div>
        </div>

        {/* File Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">اختر ملف PDF (حتى 300+ صفحة)</label>
          <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-6 text-center bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".pdf"
              disabled={isProcessing || chunks.some(c => c.status === 'completed')}
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <span className="text-sm font-bold text-slate-700 block">
              {file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : 'اضغط هنا لاختيار الكتاب أو الملف'}
            </span>
            {totalPages > 0 && (
              <span className="text-xs font-semibold text-blue-600 block mt-1">
                ✓ تم التعرف على {totalPages} صفحة
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Auto-Chunking Execution Board */}
      {chunks.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>خطة أجزاء الكتاب ({chunks.length} جزء)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الأسئلة المستخرجة حتى الآن: <strong className="text-emerald-600 font-bold">{totalExtractedQuestions} سؤال</strong>
              </p>
            </div>

            {currentChunkIndex < chunks.length ? (
              <button
                type="button"
                onClick={() => processChunk(currentChunkIndex)}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري استخراج الجزء {currentChunkIndex + 1}...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>
                      {chunks[currentChunkIndex]?.status === 'error' ? 'إعادة محاولة' : 'ابدأ استخراج'} الجزء {currentChunkIndex + 1} (ص {chunks[currentChunkIndex]?.startPage} - {chunks[currentChunkIndex]?.endPage})
                    </span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 text-sm">
                <Check className="w-4 h-4" />
                <span>اكتمل استخراج جميع أجزاء الكتاب بنجاح!</span>
              </div>
            )}
          </div>

          {/* Chunks List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1">
            {chunks.map((c) => {
              const isCurrent = c.index === currentChunkIndex;
              return (
                <div
                  key={c.index}
                  className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                    c.status === 'completed'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : c.status === 'processing'
                      ? 'bg-blue-50/70 border-blue-300 text-blue-900 ring-2 ring-blue-500/30'
                      : c.status === 'error'
                      ? 'bg-red-50/70 border-red-200 text-red-900'
                      : isCurrent
                      ? 'bg-white border-blue-400 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        c.status === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : c.status === 'processing'
                          ? 'bg-blue-600 text-white'
                          : c.status === 'error'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {c.index + 1}
                    </div>
                    <div>
                      <span className="font-bold text-sm block">
                        الصفحات: {c.startPage} إلى {c.endPage}
                      </span>
                      <span className="text-xs opacity-75">
                        {c.status === 'completed' && `تم استخراج ${c.questionsCount || 0} سؤال`}
                        {c.status === 'processing' && 'جاري التحليل واستخراج الصور...'}
                        {c.status === 'error' && 'فشل الاستخراج، يمكنك الإعادة'}
                        {c.status === 'pending' && 'في الانتظار'}
                      </span>
                    </div>
                  </div>

                  <div>
                    {c.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    )}
                    {c.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {c.status === 'error' && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => processChunk(c.index)}
                        className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg font-bold hover:bg-red-500"
                      >
                        إعادة
                      </button>
                    )}
                    {c.status === 'pending' && (
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => processChunk(c.index)}
                        className="text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 transition"
                      >
                        استخراج
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
