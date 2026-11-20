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
  Check,
  BookOpen,
  Sparkles,
} from 'lucide-react';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { PDFDocument } from 'pdf-lib';
import { 
  registerSourceRecord, 
  extractQuestionsFromChunkAction, 
  saveQuestionsBulk, 
  uploadImageFromBase64,
  analyzeBookStructureAction,
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
  // Smart structure fields
  label?: string;
  chapter?: string;
  lesson?: string;
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
  const [chunkSize, setChunkSize] = useState<number>(5);
  const [chunks, setChunks] = useState<ChunkInfo[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [totalExtractedQuestions, setTotalExtractedQuestions] = useState(0);

  // Smart structure analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [structureMode, setStructureMode] = useState<'smart' | 'fixed'>('fixed');
  const [bookSections, setBookSections] = useState<any[]>([]);

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

        // Auto-recommend chunk size based on file weight
        let activeChunkSize = chunkSize;
        if (f.size > 40 * 1024 * 1024) {
          activeChunkSize = 3;
          setChunkSize(3);
        }

        // Generate default fixed-size chunks (shown as fallback)
        const generatedChunks: ChunkInfo[] = [];
        let chunkIndex = 0;
        for (let i = 1; i <= pages; i += activeChunkSize) {
          generatedChunks.push({
            index: chunkIndex,
            startPage: i,
            endPage: Math.min(i + activeChunkSize - 1, pages),
            status: 'pending',
          });
          chunkIndex++;
        }
        setChunks(generatedChunks);
        setCurrentChunkIndex(0);
        setTotalExtractedQuestions(0);
        setStructureMode('fixed');
        setStatusMsg({
          type: 'success',
          text: `✅ تم تحميل المستند (${pages} صفحة). اضغط "تحليل هيكل الكتاب ذكياً" ليكتشف الفصول والدروس تلقائياً، أو ابدأ بالتقسيم الثابت مباشرة.`,
        });
      } catch (err: any) {
        console.error('Error reading PDF:', err);
        setStatusMsg({ type: 'error', text: 'تعذر قراءة ملف الـ PDF. تأكد من سلامة الملف.' });
      }
    }
  };

  // Smart structure analysis: slice the first 12 pages where the comprehensive TOC is
  // and send as a sub-PDF to Gemini Vision to extract the complete structure
  const handleAnalyzeStructure = async () => {
    if (!file || totalPages === 0) return;
    setIsAnalyzing(true);
    setStatusMsg({ type: 'success', text: '🔍 جاري قراءة فهرس وجدول محتويات الكتاب واكتشاف الفصول والدروس...' });

    try {
      const fullBuffer = await file.arrayBuffer();

      // Create a sub-PDF of the first 12 pages (or totalPages if less)
      const tocPageCount = Math.min(12, totalPages);
      const originalPdfDoc = await PDFDocument.load(fullBuffer);
      const subPdfDoc = await PDFDocument.create();

      const pageIndices: number[] = [];
      for (let p = 0; p < tocPageCount; p++) {
        pageIndices.push(p);
      }
      const copiedPages = await subPdfDoc.copyPages(originalPdfDoc, pageIndices);
      copiedPages.forEach((page) => subPdfDoc.addPage(page));

      const subPdfBytes = await subPdfDoc.save();
      let binary = '';
      for (let i = 0; i < subPdfBytes.byteLength; i++) {
        binary += String.fromCharCode(subPdfBytes[i]);
      }
      const pdfBase64 = btoa(binary);

      const result = await analyzeBookStructureAction(
        { pdfBase64 },
        totalPages
      );

      if (!result.success || !result.sections || result.sections.length === 0) {
        throw new Error(result.error || 'لم يتم اكتشاف أي هيكل');
      }

      // Convert sections into safe lightweight physical chunks (3-5 pages each)
      // Every physical chunk is mapped to its real educational Unit & Lesson!
      setBookSections(result.sections);

      const activeChunkSize = chunkSize > 0 ? chunkSize : 4;
      const mappedChunks: ChunkInfo[] = [];
      let cIdx = 0;
      for (let i = 1; i <= totalPages; i += activeChunkSize) {
        const start = i;
        const end = Math.min(i + activeChunkSize - 1, totalPages);
        const matchedSec = result.sections.find((s: any) => start >= s.startPage && start <= s.endPage)
          || result.sections.find((s: any) => end >= s.startPage && end <= s.endPage)
          || result.sections.find((s: any) => (start <= s.startPage && end >= s.endPage))
          || result.sections[0];

        const chName = matchedSec?.chapter || selectedSubject || 'الوحدة الأولى';
        const lesName = matchedSec?.lesson || 'الدرس الأول';

        mappedChunks.push({
          index: cIdx,
          startPage: start,
          endPage: end,
          status: 'pending',
          chapter: chName,
          lesson: lesName,
          label: `${chName} › ${lesName}`,
        });
        cIdx++;
      }

      setChunks(mappedChunks);
      setCurrentChunkIndex(0);
      setTotalExtractedQuestions(0);
      setStructureMode('smart');
      setStatusMsg({
        type: 'success',
        text: `✨ تم التعرف على هيكل الكتاب بالكامل (${result.sections.length} فصل ودرس)! وتم توزيع صفحات الكتاب الـ (${totalPages}) على (${mappedChunks.length} دفعة معالجة سريعة وخفيفة كل منها ${activeChunkSize} صفحات فقط) لضمان التحميل السلس والأمان التام.`,
      });
    } catch (err: any) {
      console.error('Structure analysis failed:', err);
      setStatusMsg({
        type: 'error',
        text: `تعذر تحليل هيكل الكتاب: ${err.message}. يمكنك الاستمرار بالتقسيم الثابت.`,
      });
    } finally {
      setIsAnalyzing(false);
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

      // 2. Prepare chunk payload (PDF slice or rendered compressed JPEG images)
      const fullBuffer = await file.arrayBuffer();
      let chunkPayload: { pdfBase64?: string; imagesBase64?: string[] } = {};

      try {
        const originalPdfDoc = await PDFDocument.load(fullBuffer);
        const subPdfDoc = await PDFDocument.create();

        const pageIndices: number[] = [];
        for (let p = chunk.startPage - 1; p < chunk.endPage; p++) {
          pageIndices.push(p);
        }

        const copiedPages = await subPdfDoc.copyPages(originalPdfDoc, pageIndices);
        copiedPages.forEach((page) => subPdfDoc.addPage(page));

        const chunkPdfBytes = await subPdfDoc.save();

        // If sliced PDF is smaller than 3MB, send directly as PDF
        if (chunkPdfBytes.byteLength < 3.2 * 1024 * 1024) {
          let binary = '';
          for (let i = 0; i < chunkPdfBytes.byteLength; i++) {
            binary += String.fromCharCode(chunkPdfBytes[i]);
          }
          chunkPayload = { pdfBase64: btoa(binary) };
        } else {
          // If sliced PDF is heavy (> 3.2MB) from high-res scans, render to compressed JPEGs (~200KB per page)
          console.info(`Chunk ${chunkIdx + 1} is ${(chunkPdfBytes.byteLength / (1024 * 1024)).toFixed(1)}MB; rendering to lightweight JPEGs for Vercel.`);
          const pdfJsDoc = await pdfjsLib.getDocument({ data: fullBuffer }).promise;
          const images: string[] = [];
          for (let p = chunk.startPage; p <= chunk.endPage; p++) {
            const page = await pdfJsDoc.getPage(p);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            images.push(dataUrl.split(',')[1]);
          }
          chunkPayload = { imagesBase64: images };
        }
      } catch (sliceErr) {
        console.warn('PDF-lib slice failed or heavy, rendering pages via canvas:', sliceErr);
        const pdfJsDoc = await pdfjsLib.getDocument({ data: fullBuffer }).promise;
        const images: string[] = [];
        for (let p = chunk.startPage; p <= chunk.endPage; p++) {
          const page = await pdfJsDoc.getPage(p);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          images.push(dataUrl.split(',')[1]);
        }
        chunkPayload = { imagesBase64: images };
      }

      // 3. Send lightweight chunk to Gemini Multimodal
      const chunkLabel = chunk.label || `ص ${chunk.startPage} - ${chunk.endPage}`;
      const extractRes = await extractQuestionsFromChunkAction(
        chunkPayload,
        selectedSubject,
        sourceName || file.name,
        chunkLabel,
        chunk.chapter,
        chunk.lesson
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
      const nextIdx = chunkIdx + 1;
      setCurrentChunkIndex(nextIdx);

      const msg = extractedQs.length > 0 
        ? `تم بنجاح استخراج وحفظ الجزء (${chunkIdx + 1}) بواقع ${extractedQs.length} سؤال!`
        : `اكتمل فحص الجزء (${chunkIdx + 1}) - صفحات شرح بدون أسئلة. تم التخطي بنجاح!`;

      if (autoPlay && nextIdx < chunks.length) {
        setStatusMsg({
          type: 'success',
          text: `${msg} جاري الانتقال للجزء التالي (${nextIdx + 1}/${chunks.length}) تلقائياً...`,
        });
        // Wait 1.5 seconds and trigger next chunk automatically
        setTimeout(() => {
          processChunk(nextIdx);
        }, 1500);
      } else {
        setStatusMsg({
          type: 'success',
          text: nextIdx >= chunks.length 
            ? `🎉 مبروك! اكتمل استخراج جميع أجزاء الكتاب بنجاح وحفظ ${totalExtractedQuestions + extractedQs.length} سؤال في بنك المعلم!`
            : msg,
        });
      }
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
                    const start = i;
                    const end = Math.min(i + newSize - 1, totalPages);
                    const matchedSec = bookSections.length > 0 
                      ? (bookSections.find((s: any) => start >= s.startPage && start <= s.endPage) || bookSections[0])
                      : null;

                    const chName = matchedSec?.chapter || selectedSubject || 'الوحدة الأولى';
                    const lesName = matchedSec?.lesson || 'الدرس الأول';

                    gen.push({
                      index: idx,
                      startPage: start,
                      endPage: end,
                      status: 'pending',
                      chapter: chName,
                      lesson: lesName,
                      label: matchedSec ? `${chName} › ${lesName}` : `ص ${start} - ${end}`,
                    });
                    idx++;
                  }
                  setChunks(gen);
                  setCurrentChunkIndex(0);
                }
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value={2}>صفحتين (أقصى أمان وسرعة للكتب المصورة والضخمة جداً 100MB+)</option>
              <option value={3}>3 صفحات (موصى به - متوازن وفائق الدقة للكتب الكبيرة)</option>
              <option value={5}>5 صفحات (للكتب العادية والمتوسطة)</option>
              <option value={10}>10 صفحات (للكتب الخفيفة والصغيرة)</option>
              <option value={15}>15 صفحة (للمذكرات والنصوص الرقمية الخفيفة)</option>
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

        {/* Smart Analysis Button */}
        {file && totalPages > 0 && !chunks.some(c => c.status === 'completed') && (
          <div className="border border-violet-200 bg-violet-50 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="font-bold text-violet-800 text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  تحليل هيكل الكتاب ذكياً (موصى به)
                </p>
                <p className="text-xs text-violet-600 mt-0.5">
                  Gemini يقرأ فهرس الكتاب ويكتشف الفصول والدروس تلقائياً، مع تقسيم المعالجة لقطع خفيفة وسريعة لتفادي أي ثقل.
                </p>
                {structureMode === 'smart' && (
                  <p className="text-xs text-emerald-600 font-bold mt-1">
                    ✅ تم التحليل بنجاح — تم ربط كل دفعة معالجة بوحدتها ودرسها الحقيقي
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={isAnalyzing || isProcessing}
                onClick={handleAnalyzeStructure}
                className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition"
              >
                {isAnalyzing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>جاري التحليل...</span></>
                ) : (
                  <><BookOpen className="w-4 h-4" /><span>{structureMode === 'smart' ? 'إعادة تحليل الفهرس' : 'تحليل هيكل الكتاب ذكياً'}</span></>
                )}
              </button>
            </div>

            {bookSections.length > 0 && (
              <div className="pt-3 border-t border-violet-200/70">
                <span className="text-xs font-bold text-violet-900 block mb-1.5">
                  📚 الفصول والدروس المكتشفة ({bookSections.length} وحدة ودرس):
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {bookSections.map((sec, i) => (
                    <span key={i} className="bg-white border border-violet-200 px-2.5 py-1 rounded-lg text-xs text-violet-800 font-semibold shadow-2xs">
                      {sec.chapter} › {sec.lesson} <span className="opacity-60 text-[10px]">(ص {sec.startPage}-{sec.endPage})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-Chunking Execution Board */}
      {chunks.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>
                  {structureMode === 'smart' ? `هيكل الكتاب (${chunks.length} قسم بالفصول والدروس)` : `خطة أجزاء الكتاب (${chunks.length} جزء)`}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي الأسئلة المستخرجة حتى الآن: <strong className="text-emerald-600 font-bold">{totalExtractedQuestions} سؤال</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 select-none hover:bg-slate-100 transition">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(e) => setAutoPlay(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>متابعة تلقائية للأجزاء التالية (Auto)</span>
              </label>

              {currentChunkIndex < chunks.length ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => processChunk(currentChunkIndex)}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري معالجة الجزء {currentChunkIndex + 1}...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>
                          {chunks[currentChunkIndex]?.status === 'error' ? 'إعادة محاولة' : 'ابدأ استخراج'}{' '}
                          {chunks[currentChunkIndex]?.label
                            ? chunks[currentChunkIndex].label
                            : `الجزء ${currentChunkIndex + 1} (ص ${chunks[currentChunkIndex]?.startPage} - ${chunks[currentChunkIndex]?.endPage})`}
                        </span>
                      </>
                    )}
                  </button>

                  {chunks[currentChunkIndex]?.status === 'error' && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        const nextIdx = currentChunkIndex + 1;
                        if (nextIdx < chunks.length) {
                          setCurrentChunkIndex(nextIdx);
                          if (autoPlay) {
                            setTimeout(() => processChunk(nextIdx), 500);
                          }
                        }
                      }}
                      className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition"
                    >
                      تخطي للجزء التالي ⏭️
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200 text-sm">
                  <Check className="w-4 h-4" />
                  <span>اكتمل استخراج جميع أجزاء الكتاب بنجاح!</span>
                </div>
              )}
            </div>
          </div>

          {/* Chunks List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto p-1">
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
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-bold text-xs ${
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
                    <div className="min-w-0">
                      {/* Smart label: show chapter/lesson name if available */}
                      {c.label ? (
                        <>
                          <span className="font-bold text-sm block truncate" title={c.label}>{c.label}</span>
                          <span className="text-xs opacity-60 block">ص {c.startPage} – {c.endPage}</span>
                        </>
                      ) : (
                        <span className="font-bold text-sm block">الصفحات: {c.startPage} إلى {c.endPage}</span>
                      )}
                      <span className="text-xs opacity-75">
                        {c.status === 'completed' && `✅ تم استخراج ${c.questionsCount || 0} سؤال`}
                        {c.status === 'processing' && 'جاري التحليل واستخراج الصور...'}
                        {c.status === 'error' && `❌ ${c.error || 'فشل الاستخراج'}`}
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
