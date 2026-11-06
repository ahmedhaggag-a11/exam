'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { processBubbleSheetImage, ScanAIResponse } from './actions';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Upload,
  Sparkles,
  Award,
  Image as ImageIcon,
  Check,
  X
} from 'lucide-react';
import Link from 'next/link';

interface QuestionAnswer {
  qNum: number;
  correctCode: string;
}

export default function ExamScannerPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exam, setExam] = useState<any>(null);
  const [modelAnswers, setModelAnswers] = useState<Record<string, QuestionAnswer[]>>({});
  const [selectedModel, setSelectedModel] = useState<string>('أ');
  const [streamStarted, setStreamStarted] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanAIResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    loadExamData();
    return () => {
      stopCamera();
    };
  }, [id]);

  async function loadExamData() {
    const { data: examData } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single();

    if (examData) {
      setExam(examData);
    }

    // Load questions and correct choices
    const { data: examQs } = await supabase
      .from('exam_questions')
      .select(`
        order_index,
        questions (
          id, text, question_type,
          choices:question_choices(*)
        )
      `)
      .eq('exam_id', id)
      .order('order_index');

    if (examQs) {
      const answers: QuestionAnswer[] = [];
      examQs.forEach((eq: any, idx: number) => {
        const q = eq.questions;
        if (q && q.choices) {
          const correct = q.choices.find((c: any) => c.is_correct);
          answers.push({
            qNum: idx + 1,
            correctCode: correct ? correct.choice_code : 'أ',
          });
        }
      });
      setModelAnswers({
        'أ': answers,
        'ب': answers,
        'ج': answers,
        'د': answers,
      });
    }
  }

  async function startCamera() {
    setCameraError('');
    setScanError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreamStarted(true);
      }
    } catch (err: any) {
      console.error('Camera open error:', err);
      setCameraError('تعذر فتح الكاميرا: يرجى منح الإذن للمتصفح بالوصول لكاميرا الهاتف/الجهاز.');
    }
  }

  function stopCamera() {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setStreamStarted(false);
    }
  }

  // Handle file upload of bubble sheet photo
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setScanResult(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setCapturedPreview(base64);
      await runRealAIScan(base64);
    };
    reader.readAsDataURL(file);
  }

  // Capture frame from active video stream
  async function captureFrameAndScan() {
    if (!streamStarted || !videoRef.current || !canvasRef.current) {
      setScanError('الكاميرا غير مفعلة. يرجى الضغط على زر تشغيل الكاميرا أو رفع صورة الورقة.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPreview(base64);

    await runRealAIScan(base64);
  }

  // Run real Gemini Vision AI OMR processing
  async function runRealAIScan(base64Data: string) {
    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const answersForModel = modelAnswers[selectedModel] || [];
      const totalQ = answersForModel.length || exam?.total_questions || 15;

      const result = await processBubbleSheetImage(base64Data, totalQ, answersForModel);

      if (!result.success || !result.isValidSheet) {
        setScanError(result.error || 'لم يتم التعرف على ورقة إجابة في الكاميرا. يرجى توجيه الكاميرا جيداً نحو الورقة.');
      } else {
        setScanResult(result);
      }
    } catch (err: any) {
      console.error('Scan error:', err);
      setScanError(err.message || 'حدث خطأ أثناء معالجة الصورة.');
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher/exams"
            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <ArrowRight className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span>ماسح البابل شيت بالذكاء الاصطناعي الحقيقي</span>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                AI Vision
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {exam ? `${exam.title} • ${exam.subject}` : 'جاري التحميل...'}
            </p>
          </div>
        </div>

        <Link
          href={`/teacher/exams/${id}/bubble-sheet`}
          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition"
        >
          📄 طباعة أوراق البابل شيت
        </Link>
      </div>

      {/* Model Selection Bar */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span className="text-sm font-bold">النموذج المراد تصحيحه:</span>
        </div>
        <div className="flex gap-2">
          {['أ', 'ب', 'ج', 'د'].map((m) => (
            <button
              key={m}
              onClick={() => setSelectedModel(m)}
              className={`w-9 h-9 rounded-xl font-black text-sm transition ${
                selectedModel === m
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 ring-2 ring-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {cameraError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Camera Live Viewfinder & Capture Area */}
      <div className="bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-900 relative min-h-[380px] flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full max-h-[500px] object-cover ${streamStarted ? 'block' : 'hidden'}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Framing Grid Overlay */}
        {streamStarted && (
          <div className="absolute inset-8 border-2 border-dashed border-emerald-400/70 rounded-2xl pointer-events-none flex flex-col justify-between p-4">
            <div className="flex justify-between text-xs font-mono font-bold text-emerald-400 bg-slate-950/70 px-2.5 py-1 rounded w-fit">
              <span>وجّه الكاميرا نحو ورقة البابل شيت</span>
            </div>
            <div className="self-center bg-emerald-500/20 text-emerald-300 px-4 py-1 rounded-full text-xs font-bold border border-emerald-500/40 backdrop-blur-sm">
              الكاميرا نشطة - جاهز للمسح الحقيقي 📷
            </div>
          </div>
        )}

        {!streamStarted && (
          <div className="text-center p-8 space-y-4">
            <div className="w-16 h-16 bg-slate-800 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">كاميرا التصحيح الذكي</h3>
              <p className="text-slate-400 text-xs mt-1 max-w-sm mx-auto">
                شغّل كاميرا الهاتف لتصوير ورقة الطالب مباشرة، أو ارفع صورة ملتقطة مسبقاً من ألبوم هاتفك.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button
                onClick={startCamera}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>تشغيل الكاميرا الآن</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-sm font-bold transition flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>رفع صورة ورقة إجابة</span>
              </button>
            </div>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {streamStarted && (
          <button
            onClick={captureFrameAndScan}
            disabled={scanning}
            className="w-full sm:w-auto flex-1 max-w-md py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-base shadow-xl shadow-emerald-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>الذكاء الاصطناعي يقرأ تظليلات الورقة...</span>
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
                <span>التقاط وتصحيح الورقة الحقيقية بالذكاء الاصطناعي ⚡</span>
              </>
            )}
          </button>
        )}

        {streamStarted && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full sm:w-auto px-5 py-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            <span>أو اختر صورة من الجهاز</span>
          </button>
        )}
      </div>

      {/* Captured Image Preview thumbnail */}
      {capturedPreview && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4">
          <img
            src={capturedPreview}
            alt="الصورة الملتقطة"
            className="w-20 h-20 object-cover rounded-xl border border-slate-300 shadow-xs"
          />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-700 block">الصورة التي تم إرسالها للذكاء الاصطناعي:</span>
            <span className="text-[11px] text-slate-500">
              يقوم نموذج الرؤية البصرية (Vision AI) بفحص الدوائر المظللة بالقلم بدقة فائقة ومطابقتها بمفتاح الإجابة.
            </span>
          </div>
        </div>
      )}

      {/* Error / Not-A-Sheet Warning */}
      {scanError && (
        <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-900 space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 font-black text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>تنبيه الماسح الضوئي:</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800 pr-7">
            {scanError}
          </p>
        </div>
      )}

      {/* Real Live Scan Results Card */}
      {scanResult && scanResult.isValidSheet && (
        <div className="bg-white rounded-2xl border-2 border-emerald-500 p-6 shadow-xl space-y-5 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
                <Award className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">نتيجة التصحيح الحقيقية</h3>
                <p className="text-xs text-slate-500">
                  تم قراءة ورقة الطالب وتظليلاته بواسطة Vision AI للنموذج ({scanResult.detectedModel || selectedModel})
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-2xl font-black text-emerald-600">
                {scanResult.scorePercentage}%
              </span>
              <span className="text-xs text-slate-500 block">
                ({scanResult.correctAnswers} من {scanResult.totalQuestions} صحيح)
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-xs text-emerald-700 font-bold block">إجابات صحيحة</span>
              <span className="text-xl font-black text-emerald-800">{scanResult.correctAnswers}</span>
            </div>
            <div className="bg-red-50 p-3 rounded-xl border border-red-200">
              <span className="text-xs text-red-700 font-bold block">إجابات خاطئة</span>
              <span className="text-xl font-black text-red-800">{scanResult.wrongAnswers}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600 font-bold block">رقم الجلوس المرصود</span>
              <span className="text-lg font-black text-slate-800">{scanResult.seatNumber}</span>
            </div>
          </div>

          {/* Breakdown of real student answers */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2">تفاصيل تصحيح كل سؤال:</h4>
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-56 overflow-y-auto p-1">
              {scanResult.detailedAnswers?.map((item) => (
                <div
                  key={item.qNum}
                  className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center border transition ${
                    item.isCorrect
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-800 border-red-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-500">س{item.qNum}</span>
                  <span className="text-sm mt-0.5">
                    {item.studentChoice}{' '}
                    {item.isCorrect ? (
                      <Check className="w-3.5 h-3.5 inline text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-red-600 font-normal">({item.correctChoice})</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
