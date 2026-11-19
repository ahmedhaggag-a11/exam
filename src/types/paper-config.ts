export interface ExamPaperConfig {
  // General Page
  pageSize: 'A4' | 'A3';
  direction: 'rtl';
  fontFamily: 'Tajawal' | 'Cairo' | 'Amiri' | 'Traditional Arabic';
  fontSize: 'sm' | 'base' | 'lg';
  columns: 1 | 2;
  pageBorder: 'none' | 'single' | 'double' | 'rounded';
  headerStyle: 'standard' | 'formal' | 'boxed' | 'modern-gradient' | 'minimal';
  themeColor: string; // e.g., '#1e3a8a' or '#0f172a'

  // Header Details
  header: {
    ministryLine: string;       // e.g. "جمهورية مصر العربية - وزارة التربية والتعليم"
    directorate: string;        // e.g. "مديرية التربية والتعليم بالقاهرة"
    administration: string;     // e.g. "إدارة مصر الجديدة التعليمية"
    schoolOrCenterName: string; // e.g. "أكاديمية النجاح / مدرسة الأوائل"
    teacherName: string;        // e.g. "أستاذ أحمد حجاج"
    logoUrl?: string;           // Optional center/right logo
    showExamDate: boolean;
    showDuration: boolean;
    showTotalMarks: boolean;
    showStudentInfoBox: boolean;
    studentFields: {
      name: boolean;
      seatNumber: boolean;
      groupOrClass: boolean;
      date: boolean;
    };
  };

  // Watermark
  watermark: {
    enabled: boolean;
    type: 'text' | 'logo';
    text: string;
    opacity: number; // 0.05 to 0.3
    angle: number;   // -45 to 0
  };

  // Questions Style
  questions: {
    numberingStyle: 'numeric' | 'arabic-alpha' | 'q-number'; // 1. أو أ) أو س1:
    choicesLayout: 'auto' | 'grid-2' | 'grid-4' | 'vertical'; // توزيع الاختيارات
    choicesBullet: 'arabic-letters' | 'english-letters' | 'circles'; // (أ، ب، ج، د) أو (A, B, C, D)
    showQuestionMarks: boolean;
    showQuestionChapter: boolean;
    essayLinesCount: number; // عدد أسطر الإجابة للأسئلة المقالية
    essayLineStyle: 'dotted' | 'dashed' | 'solid';
    spacing: 'compact' | 'normal' | 'spacious';
  };

  // Footer & Notes
  footer: {
    customFooterText: string; // e.g. "مع أطيب تمنياتي لكم بالتفوق والنجاح"
    showPageNumber: boolean;
    showModelName: boolean;
    bottomNotes?: string;
  };

  // Smart QR Code
  qrCode?: {
    enabled: boolean;
    url: string;
    title: string; // e.g. "امسح الباركود لفيديو الشرح ونموذج الإجابة"
  };
}

export const DEFAULT_PAPER_CONFIG: ExamPaperConfig = {
  pageSize: 'A4',
  direction: 'rtl',
  fontFamily: 'Tajawal',
  fontSize: 'base',
  columns: 1,
  pageBorder: 'single',
  headerStyle: 'formal',
  themeColor: '#1e3a8a',

  header: {
    ministryLine: 'جمهورية مصر العربية - وزارة التربية والتعليم',
    directorate: 'مديرية التربية والتعليم',
    administration: 'إدارة التعليم العام',
    schoolOrCenterName: 'منصة ExamForge التعليمية',
    teacherName: '',
    logoUrl: '',
    showExamDate: true,
    showDuration: true,
    showTotalMarks: true,
    showStudentInfoBox: true,
    studentFields: {
      name: true,
      seatNumber: true,
      groupOrClass: true,
      date: true,
    },
  },

  watermark: {
    enabled: false,
    type: 'text',
    text: 'ExamForge',
    opacity: 0.08,
    angle: -30,
  },

  questions: {
    numberingStyle: 'numeric',
    choicesLayout: 'auto',
    choicesBullet: 'arabic-letters',
    showQuestionMarks: true,
    showQuestionChapter: false,
    essayLinesCount: 3,
    essayLineStyle: 'dashed',
    spacing: 'normal',
  },

  footer: {
    customFooterText: 'مع خالص أمنياتنا بالتفوق والنجاح المستمر',
    showPageNumber: true,
    showModelName: true,
    bottomNotes: '',
  },

  qrCode: {
    enabled: false,
    url: '',
    title: 'امسح الكود لعرض فيديو شرح وحل الامتحان',
  },
};
