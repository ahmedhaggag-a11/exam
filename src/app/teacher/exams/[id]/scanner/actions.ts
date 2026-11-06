'use server';

import { GoogleGenAI } from '@google/genai';

interface QuestionKey {
  qNum: number;
  correctCode: string;
}

export interface ScanAIResponse {
  success: boolean;
  error?: string;
  isValidSheet?: boolean;
  studentName?: string;
  seatNumber?: string;
  detectedModel?: string;
  totalQuestions?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  scorePercentage?: number;
  detailedAnswers?: Array<{
    qNum: number;
    studentChoice: string;
    correctChoice: string;
    isCorrect: boolean;
  }>;
}

export async function processBubbleSheetImage(
  imageBase64Data: string,
  totalQuestions: number,
  modelAnswers: QuestionKey[]
): Promise<ScanAIResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'مفتاح الذكاء الاصطناعي (Gemini API Key) غير مهيأ' };
  }

  // Clean base64 header if present
  const base64Clean = imageBase64Data.replace(/^data:image\/\w+;base64,/, '');

  if (!base64Clean || base64Clean.length < 500) {
    return { success: false, error: 'الصورة الملتقطة فارغة أو غير صالحة. يرجى توجيه الكاميرا جيداً نحو الورقة.' };
  }

  const CANDIDATE_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-lite-latest',
  ];

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `أنت خبير في التعرف الضوئي ومعالجة أوراق الإجابة (OMR Bubble Sheet Reader).
انظر بدقة إلى هذه الصورة الملتقطة:

المهمة:
1. أولاً: تحقق هل الصورة تحتوي بالفعل على ورقة إجابة (بابل شيت) حقيقية؟
   - إذا كانت الصورة لا تحتوي على ورقة إجابة (مثلاً: صورة مكتب فارغ، شخص، سقف، شاشة مظلمة، أو أي شيء غير ورقة بابل شيت)، أجب فوراً بـ:
     {"is_valid_sheet": false, "error": "لم يتم التعرف على ورقة إجابة في الكاميرا. يرجى وضع ورقة البابل شيت واضحة ومفرودة داخل الإطار."}

2. إذا كانت هناك ورقة إجابة:
   - اقرأ رقم الجلوس أو اسم الطالب إن وجد.
   - اقرأ النموذج المظلل (أ، ب، ج، د).
   - لكل سؤال من الأسئلة حتى السؤال رقم ${totalQuestions}، حدد الحرف المظلل بالقلم (أ، ب، ج، د) أو (A, B, C, D) مع تحويله للعربية (A->أ، B->ب، C->ج، D->د).
   - إذا كان السؤال غير مظلل، اكتب null.

أعد إجابتك بصيغة JSON فقط بهذا المخطط الدقيق:
{
  "is_valid_sheet": true,
  "seat_number": "رقم الجلوس إن وجد أو لا يوجد",
  "student_name": "اسم الطالب إن وجد",
  "detected_model": "أ",
  "answers": [
    {"qNum": 1, "selected": "أ"},
    {"qNum": 2, "selected": "ب"}
  ]
}`;

  let parsed: any = null;
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: base64Clean,
                  mimeType: 'image/jpeg',
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response && response.text) {
        parsed = JSON.parse(response.text);
        break;
      }
    } catch (err: any) {
      console.warn(`Vision OMR failed with model ${modelName}:`, err?.message || err);
      lastError = err;
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  if (!parsed) {
    return {
      success: false,
      error: lastError?.message || 'تعذر تحليل الصورة بواسطة الذكاء الاصطناعي. تأكد من وضوح الإضاءة.',
    };
  }

  if (!parsed.is_valid_sheet) {
    return {
      success: false,
      isValidSheet: false,
      error: parsed.error || 'لم يتم العثور على ورقة إجابة واضحة في الصورة. يرجى توجيه الكاميرا نحو الورقة.',
    };
  }

  // Real answer verification against DB key
  const answersMap: Record<number, string> = {};
  if (Array.isArray(parsed.answers)) {
    parsed.answers.forEach((a: any) => {
      if (a.qNum && a.selected) {
        answersMap[Number(a.qNum)] = String(a.selected).trim();
      }
    });
  }

  let correctCount = 0;
  const detailed = modelAnswers.map((item) => {
    const studentChoice = answersMap[item.qNum] || 'لم يُظلل';
    const isCorrect = studentChoice === item.correctCode;
    if (isCorrect) correctCount++;

    return {
      qNum: item.qNum,
      studentChoice,
      correctChoice: item.correctCode,
      isCorrect,
    };
  });

  const total = modelAnswers.length || totalQuestions || 1;
  const percentage = Math.round((correctCount / total) * 100);

  return {
    success: true,
    isValidSheet: true,
    studentName: parsed.student_name || 'غير محدد',
    seatNumber: parsed.seat_number || 'غير مدون',
    detectedModel: parsed.detected_model || 'أ',
    totalQuestions: total,
    correctAnswers: correctCount,
    wrongAnswers: total - correctCount,
    scorePercentage: percentage,
    detailedAnswers: detailed,
  };
}
