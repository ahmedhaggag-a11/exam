'use client';

import { useEffect, useState, useRef } from 'react';
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
  Image as ImageIcon,
  Plus,
  Trash2,
  X,
  ListOrdered,
  RefreshCw,
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
  getSignedPdfUploadUrlAction,
  updateSourceStoragePathAction,
  uploadBookPagesAction,
} from './actions';
import { cachePdfFile } from '@/lib/utils/pdf-cache';

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

  // Dedicated Index (TOC) file & manual management
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [indexPreviewUrl, setIndexPreviewUrl] = useState<string | null>(null);
  const [isAnalyzingIndex, setIsAnalyzingIndex] = useState(false);
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [newLessonChapter, setNewLessonChapter] = useState('');
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonStartPage, setNewLessonStartPage] = useState('');
  const [newLessonEndPage, setNewLessonEndPage] = useState('');

  // Reusable PDF.js document ref (keeps parsed PDF open in memory across all chunks)
  const loadedPdfDocRef = useRef<any>(null);

  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const supabase = createClient();

  // Helper to map and rebuild chunks with confirmed sections
  // ✅ Core Fix: If sections have realistic page ranges, build ONE chunk PER LESSON
  //    so each lesson's questions are NEVER mixed with another lesson's pages.
  //    Fallback to fixed-size chunking only if no page info is available.
  const rebuildChunksWithSections = (sections: any[], pages: number, activeChunkSize: number) => {
    if (pages <= 0) return;
    const mappedChunks: ChunkInfo[] = [];

    const hasRealisticPages = sections.some(
      (s: any) => (s.endPage || 0) >= 1 && (s.endPage || 0) >= (s.startPage || 1)
    );

    if (hasRealisticPages) {
      // 🎯 LESSON-BASED chunking: 1 chunk per lesson, pages are exact lesson boundaries
      let cIdx = 0;
      for (const sec of sections) {
        const start = Math.max(1, sec.startPage || 1);
        const end = Math.min(pages, sec.endPage || pages);
        if (start > end) continue;

        // If a lesson spans many pages (>8), split internally to stay under Gemini limits
        const MAX_PAGES_PER_CALL = 8;
        for (let p = start; p <= end; p += MAX_PAGES_PER_CALL) {
          const chunkEnd = Math.min(p + MAX_PAGES_PER_CALL - 1, end);
          mappedChunks.push({
            index: cIdx,
            startPage: p,
            endPage: chunkEnd,
            status: 'pending',
            chapter: sec.chapter,
            lesson: sec.lesson,
            label: `${sec.chapter} › ${sec.lesson}`,
          });
          cIdx++;
        }
      }
    } else {
      // 📄 PROPORTIONAL fallback: no page ranges known — distribute proportionally
      let cIdx = 0;
      for (let i = 1; i <= pages; i += activeChunkSize) {
        const start = i;
        const end = Math.min(i + activeChunkSize - 1, pages);
        const secIdx = Math.min(
          Math.floor(((start - 1) / pages) * sections.length),
          sections.length - 1
        );
        const matchedSec = sections[secIdx];
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
    }

    setChunks(mappedChunks);
    setCurrentChunkIndex(0);
    setTotalExtractedQuestions(0);
    setStructureMode('smart');
  };

  useEffect(() => {
    async function loadTeachers() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, subjects, grades')
        .eq('role', 'teacher');
      if (data && data.length > 0) {
        setTeachers(data);
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
        const data = new Uint8Array(arrayBuffer);
        const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        loadedPdfDocRef.current = pdfDoc;
        const pages = pdfDoc.numPages;
        setTotalPages(pages);

        // Cache PDF in IndexedDB for seamless question re-cropping across the app
        cachePdfFile('last_active_pdf', arrayBuffer);

        // Auto-recommend chunk size based on file weight
        let activeChunkSize = chunkSize;
        if (f.size > 40 * 1024 * 1024) {
          activeChunkSize = 3;
          setChunkSize(3);
        }

        // If index/sections were already uploaded/analyzed, rebuild chunks immediately!
        if (bookSections.length > 0) {
          rebuildChunksWithSections(bookSections, pages, activeChunkSize);
          setStatusMsg({
            type: 'success',
            text: `✅ تم تحميل الكتاب (${pages} صفحة)، وتم تطبيق هيكل الفهرس المعتمد (${bookSections.length} درس) بنجاح!`,
          });
        } else {
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
            text: `✅ تم تحميل المستند (${pages} صفحة). يمكنك تحليل الفهرس من قسم الفهرسة أدناه لمطابقة الأسئلة تلقائياً.`,
          });
        }
      } catch (err: any) {
        console.error('Error reading PDF:', err);
        setStatusMsg({ type: 'error', text: 'تعذر قراءة ملف الـ PDF. تأكد من سلامة الملف.' });
      }
    }
  };

  // Dedicated Index file picker & analysis
  const handleIndexFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setIndexFile(f);
      if (f.type.startsWith('image/')) {
        setIndexPreviewUrl(URL.createObjectURL(f));
      } else {
        setIndexPreviewUrl(null);
      }
    }
  };

  const handleAnalyzeIndexFile = async () => {
    if (!indexFile) return;
    setIsAnalyzingIndex(true);
    setStatusMsg({ type: 'success', text: '🔍 جاري قراءة وتحليل صورة/ملف الفهرس بالذكاء الاصطناعي بدقة فائقة...' });

    try {
      let payload: { pdfBase64?: string; imagesBase64?: string[]; isStandaloneIndex?: boolean } = {
        isStandaloneIndex: true,
      };

      if (indexFile.type === 'application/pdf') {
        const arrayBuffer = await indexFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        payload.pdfBase64 = btoa(binary);
      } else {
        const arrayBuffer = await indexFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const mime = indexFile.type || 'image/jpeg';
        const b64 = `data:${mime};base64,${btoa(binary)}`;
        payload.imagesBase64 = [b64];
      }

      const result = await analyzeBookStructureAction(payload, totalPages);
      if (!result.success || !result.sections || result.sections.length === 0) {
        throw new Error(result.error || 'لم يتم العثور على أي فصول أو دروس في الفهرس');
      }

      setBookSections(result.sections);
      if (totalPages > 0) {
        rebuildChunksWithSections(result.sections, totalPages, chunkSize);
      }

      setStatusMsg({
        type: 'success',
        text: `✨ رائع جداً! تم استخراج (${result.sections.length}) درساً من الفهرس بالكامل، وتم اعتمادها لربط جميع أسئلة الكتاب بدقة تامة!`,
      });
    } catch (err: any) {
      console.error('Index analysis failed:', err);
      setStatusMsg({
        type: 'error',
        text: `تعذر تحليل الفهرس: ${err.message}`,
      });
    } finally {
      setIsAnalyzingIndex(false);
    }
  };

  const handleAddManualLesson = () => {
    if (!newLessonName.trim()) return;
    const ch = newLessonChapter.trim() || 'الوحدة الأولى';
    const les = newLessonName.trim();
    const start = parseInt(newLessonStartPage) || 1;
    const end = parseInt(newLessonEndPage) || (totalPages > 0 ? totalPages : start + 15);
    const updated = [
      ...bookSections,
      {
        chapter: ch,
        lesson: les,
        label: `${ch} › ${les}`,
        startPage: start,
        endPage: end,
      }
    ];
    setBookSections(updated);
    if (totalPages > 0) {
      rebuildChunksWithSections(updated, totalPages, chunkSize);
    }
    setNewLessonName('');
    setNewLessonStartPage('');
    setNewLessonEndPage('');
    setShowAddLessonModal(false);
  };

  const handleUpdateSectionPages = (idx: number, start: number, end: number) => {
    const updated = bookSections.map((s, i) => i === idx ? { ...s, startPage: Math.max(1, start), endPage: Math.max(start, end) } : s);
    setBookSections(updated);
    if (totalPages > 0) {
      rebuildChunksWithSections(updated, totalPages, chunkSize);
    }
  };

  const handleRemoveSection = (idx: number) => {
    const updated = bookSections.filter((_, i) => i !== idx);
    setBookSections(updated);
    if (totalPages > 0) {
      rebuildChunksWithSections(updated, totalPages, chunkSize);
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

      // ✅ Build lesson-based chunks using rebuildChunksWithSections (same logic, 1 chunk per lesson)
      setBookSections(result.sections);
      rebuildChunksWithSections(result.sections, totalPages, chunkSize > 0 ? chunkSize : 4);
      setStatusMsg({
        type: 'success',
        text: `✨ تم التعرف على هيكل الكتاب بالكامل (${result.sections.length} درس)! وتم توزيع الصفحات على دفعات مطابقة لحدود كل درس بدقة تامة.`,
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

      // Intelligent generous margins (especially vertical padding for top/bottom circuit wires and labels)
      const padY = Math.max(35, Math.round(cropH * 0.06));
      const padX = Math.max(25, Math.round(cropW * 0.04));
      const finalX = Math.max(0, cropX - padX);
      const finalY = Math.max(0, cropY - padY);
      const finalW = Math.min(canvas.width - finalX, cropW + (padX * 2));
      const finalH = Math.min(canvas.height - finalY, cropH + (padY * 2));

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

  // Upload source PDF in background to Supabase Storage and cache locally
  const uploadSourcePdfInBackground = async (sourceId: string, pdfFile: File) => {
    try {
      // 1. Cache in browser IndexedDB under sourceId for immediate access
      const buf = await pdfFile.arrayBuffer();
      await cachePdfFile(sourceId, buf);

      // 2. Upload to Supabase Storage via signed URL
      const signedRes = await getSignedPdfUploadUrlAction(sourceId, pdfFile.name);
      if (signedRes.success && signedRes.path && signedRes.token) {
        const { error: upErr } = await supabase.storage
          .from('pdfs')
          .uploadToSignedUrl(signedRes.path, signedRes.token, pdfFile, {
            contentType: 'application/pdf',
          });

        if (!upErr) {
          await updateSourceStoragePathAction(sourceId, signedRes.path);
          console.log(`[ExamForge] Book PDF successfully uploaded to storage: ${signedRes.path}`);
        } else {
          console.warn('[ExamForge] uploadToSignedUrl error:', upErr);
        }
      }
    } catch (err) {
      console.warn('[ExamForge] Error uploading source PDF in background:', err);
    }
  };

  // Process a specific chunk with automatic retry & non-stopping auto-play
  const processChunk = async (chunkIdx: number, retryCount = 0) => {
    if (!file || !selectedTeacherId) return;
    const chunk = chunks[chunkIdx];
    if (!chunk) return;

    setIsProcessing(true);
    setStatusMsg({
      type: 'success',
      text: retryCount > 0
        ? `جاري إعادة محاولة استخراج الجزء رقم (${chunkIdx + 1}/${chunks.length}) [محاولة ${retryCount + 1} من 3]...`
        : `جاري استخراج الأسئلة من الجزء رقم (${chunkIdx + 1}/${chunks.length}) [الصفحات من ${chunk.startPage} إلى ${chunk.endPage}]...`,
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
        if (!srcRes || !srcRes.success || !srcRes.sourceData) {
          throw new Error(srcRes?.error || 'تعذر إنشاء سجل للمصدر');
        }
        activeSourceId = srcRes.sourceData.id;
        setSourceRecordId(activeSourceId);

        // Upload original PDF book to Supabase Storage in background & cache locally
        if (activeSourceId) {
          uploadSourcePdfInBackground(activeSourceId, file);
        }
      }

      // 2. Prepare chunk payload using the loaded PDF.js document directly
      let doc = loadedPdfDocRef.current;
      if (!doc) {
        const fullBuffer = await file.arrayBuffer();
        doc = await pdfjsLib.getDocument({ data: new Uint8Array(fullBuffer) }).promise;
        loadedPdfDocRef.current = doc;
      }

      let chunkPayload: { pdfBase64?: string; imagesBase64?: string[] } = {};
      const images: string[] = [];
      const pageUploads: Array<{ pageNumber: number; base64: string }> = [];
      for (let p = chunk.startPage; p <= chunk.endPage; p++) {
        const page = await doc.getPage(p);
        const originalViewport = page.getViewport({ scale: 1.0 });
        // Scale optimized so image width is around 1200-1400px (fast, lightweight, highly readable for Gemini)
        const scale = Math.min(1.3, 1400 / (originalViewport.width || 1000));
        const viewport = page.getViewport({ scale: Math.max(scale, 1.0) });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const b64 = canvas.toDataURL('image/jpeg', 0.70).split(',')[1];
        images.push(b64);
        pageUploads.push({ pageNumber: p, base64: b64 });
      }
      chunkPayload = { imagesBase64: images };

      // Save each rendered page image to cloud storage in small batches of 2 pages so payload stays tiny
      if (activeSourceId && pageUploads.length > 0) {
        for (let b = 0; b < pageUploads.length; b += 2) {
          const batch = pageUploads.slice(b, b + 2);
          uploadBookPagesAction(activeSourceId, batch).catch((err) =>
            console.warn('[ExamForge] Background page image upload error:', err)
          );
        }
      }

      // 3. Send lightweight chunk to Gemini Multimodal
      const chunkLabel = chunk.label || `ص ${chunk.startPage} - ${chunk.endPage}`;
      const extractRes = await extractQuestionsFromChunkAction(
        chunkPayload,
        selectedSubject,
        sourceName || file.name,
        chunkLabel,
        chunk.chapter,
        chunk.lesson,
        bookSections
      );

      if (!extractRes || extractRes.success === false) {
        throw new Error(extractRes?.error || 'تعذر معالجة الجزء على السيرفر');
      }

      const extractedQs = Array.isArray(extractRes.questions) ? extractRes.questions : [];

      // 4. Crop images if any & record exact source_page for EVERY question
      if (doc) {
        for (let i = 0; i < extractedQs.length; i++) {
          const q = extractedQs[i];
          const absPageNum = q.image_page_number
            ? (chunk.startPage + q.image_page_number - 1)
            : chunk.startPage;
          q.source_page = Math.min(Math.max(1, absPageNum), doc.numPages);

          if (q.has_image && q.image_page_number && q.image_box) {
            const pageNum = q.source_page;
            const base64Img = await cropImageFromPdf(doc, pageNum, q.image_box);
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
        if (!saveRes || !saveRes.success) {
          throw new Error(saveRes?.error || 'تعذر حفظ الأسئلة المستخرجة على السيرفر');
        }
      }

      // Update chunk state
      setChunks((prev) =>
        prev.map((c, i) =>
          i === chunkIdx
            ? { ...c, status: 'completed', questionsCount: extractedQs.length, error: undefined }
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
        setTimeout(() => {
          processChunk(nextIdx, 0);
        }, 1200);
      } else {
        setIsProcessing(false);
        setStatusMsg({
          type: 'success',
          text: nextIdx >= chunks.length 
            ? `🎉 مبروك! اكتمل استخراج جميع أجزاء الكتاب بنجاح وحفظ ${totalExtractedQuestions + extractedQs.length} سؤال في بنك المعلم!`
            : msg,
        });
      }
    } catch (err: any) {
      console.error(`Error in chunk ${chunkIdx + 1}:`, err);

      // 🔁 Auto-retry up to 2 times for transient network/server glitches
      if (retryCount < 2) {
        setStatusMsg({
          type: 'error',
          text: `تعذر مؤقتاً معالجة الجزء (${chunkIdx + 1}) [${err.message || 'خطأ مؤقت'}]. جاري إعادة المحاولة تلقائياً (محاولة ${retryCount + 2} من 3)...`,
        });
        setTimeout(() => {
          processChunk(chunkIdx, retryCount + 1);
        }, 2500);
        return;
      }

      // If all retries exhausted, mark this chunk as error
      setChunks((prev) =>
        prev.map((c, i) => (i === chunkIdx ? { ...c, status: 'error', error: err.message } : c))
      );

      const nextIdx = chunkIdx + 1;
      setCurrentChunkIndex(nextIdx);

      // 🚀 IMPORTANT: Never stall! If autoPlay is enabled, auto-advance to next chunk so remaining chunks continue!
      if (autoPlay && nextIdx < chunks.length) {
        setStatusMsg({
          type: 'error',
          text: `⚠️ تعذر إكمال الجزء (${chunkIdx + 1}) بعد 3 محاولات. جاري المتابعة التلقائية للجزء التالي (${nextIdx + 1}/${chunks.length}) حتى لا يتوقف استخراج باقي الكتاب...`,
        });
        setTimeout(() => {
          processChunk(nextIdx, 0);
        }, 2000);
      } else {
        setIsProcessing(false);
        setStatusMsg({
          type: 'error',
          text: nextIdx >= chunks.length
            ? `اكتمل استخراج أجزاء الكتاب مع تعذر الجزء (${chunkIdx + 1}). يمكنك إعادة محاولته بنقرة واحدة.`
            : `حدث خطأ في الجزء (${chunkIdx + 1}): ${err.message}`,
        });
      }
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
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">اختر المعلم المستهدف لهذا الكتاب</label>
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
            <option value="">-- اختر المعلم الذي سينزل له هذا الكتاب فقط --</option>
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

        {/* ========================================================================= */}
        {/* 📋 Dedicated Table of Contents (TOC) Section - فهرسة الكتاب والدروس */}
        {/* ========================================================================= */}
        <div className="border border-indigo-200 bg-indigo-50/50 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <ListOrdered className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2">
                  <span>فهرس الكتاب والدروس المعتمدة</span>
                  <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    موصى به لدقة 100%
                  </span>
                </h3>
                <p className="text-xs text-indigo-700/80 mt-0.5">
                  ارفع صورة الفهرس أو صفحة الفهرس (مثل صورة من الهاتف) ليقوم الذكاء الاصطناعي باستخراج وتأكيد جميع الدروس بدقة متناهية.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowAddLessonModal(!showAddLessonModal)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة درس يدوياً</span>
              </button>
            </div>
          </div>

          {/* Upload index image or file */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-8">
              <div className="border border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl p-3 bg-white text-center cursor-pointer relative transition">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={isAnalyzingIndex || isProcessing}
                  onChange={handleIndexFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex items-center justify-center gap-3">
                  {indexPreviewUrl ? (
                    <img src={indexPreviewUrl} alt="Index Preview" className="w-12 h-12 object-cover rounded-lg border border-indigo-200" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-indigo-400 shrink-0" />
                  )}
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800 block">
                      {indexFile ? indexFile.name : 'اضغط لاختيار صورة الفهرس (PNG, JPG) أو ملف PDF للفهرس'}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      {indexFile ? `${(indexFile.size / 1024).toFixed(0)} KB` : 'يدعم صور الهاتف والاسكانر وصفحات الفهرس'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="sm:col-span-4">
              <button
                type="button"
                disabled={!indexFile || isAnalyzingIndex || isProcessing}
                onClick={handleAnalyzeIndexFile}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                {isAnalyzingIndex ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري قراءة الفهرس...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تحليل الفهرس ذكياً</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Manual Add Lesson Form Modal / Inline */}
          {showAddLessonModal && (
            <div className="p-3 bg-white border border-indigo-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">إضافة درس جديد إلى الفهرس المعتمد</span>
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">اسم الوحدة / الفصل</label>
                  <input
                    type="text"
                    value={newLessonChapter}
                    onChange={(e) => setNewLessonChapter(e.target.value)}
                    placeholder="مثال: الوحدة الأولى: النظام البيئي المائي"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">اسم الدرس</label>
                  <input
                    type="text"
                    value={newLessonName}
                    onChange={(e) => setNewLessonName(e.target.value)}
                    placeholder="مثال: الغلاف المائي على كوكب الأرض"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="flex items-center gap-2 sm:col-span-2 pt-1 border-t border-slate-100">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">من صفحة</label>
                    <input
                      type="number"
                      min={1}
                      value={newLessonStartPage}
                      onChange={(e) => setNewLessonStartPage(e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">إلى صفحة</label>
                    <input
                      type="number"
                      min={1}
                      value={newLessonEndPage}
                      onChange={(e) => setNewLessonEndPage(e.target.value)}
                      placeholder={totalPages > 0 ? String(totalPages) : "20"}
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddManualLesson}
                  className="px-3 py-1 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700"
                >
                  حفظ وإضافة
                </button>
              </div>
            </div>
          )}

          {/* List of Extracted / Confirmed Lessons */}
          {bookSections.length > 0 && (
            <div className="pt-2 border-t border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>الدروس المعتمدة في هذا الكتاب ({bookSections.length} درس):</span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  جاهز لمطابقة الأسئلة تلقائياً
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                {bookSections.map((sec, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg text-xs text-indigo-900 font-medium shadow-2xs group"
                  >
                    <span className="font-bold text-indigo-600 text-[11px]">{i + 1}.</span>
                    <span className="font-semibold text-indigo-950">{sec.chapter}</span>
                    <span className="text-slate-400">›</span>
                    <span>{sec.lesson}</span>
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded font-mono">
                      ص {sec.startPage || 1} - {sec.endPage || totalPages || 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSection(i)}
                      className="opacity-40 group-hover:opacity-100 hover:text-red-600 text-slate-400 mr-1 transition"
                      title="حذف هذا الدرس"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* File Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">اختر ملف PDF لكتاب المادة (حتى 300+ صفحة)</label>
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

              {/* Failed chunks retry button if any */}
              {chunks.some(c => c.status === 'error') && !isProcessing && (
                <button
                  type="button"
                  onClick={() => {
                    const firstFailedIdx = chunks.findIndex(c => c.status === 'error');
                    if (firstFailedIdx !== -1) {
                      setCurrentChunkIndex(firstFailedIdx);
                      processChunk(firstFailedIdx, 0);
                    }
                  }}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
                  title="إعادة محاولة الأجزاء التي تعثرت أثناء المعالجة"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>إعادة المتعثر ({chunks.filter(c => c.status === 'error').length})</span>
                </button>
              )}

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
