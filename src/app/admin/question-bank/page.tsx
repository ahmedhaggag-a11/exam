'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Filter,
  Search,
  RotateCcw,
  User,
  GraduationCap,
  BookOpen,
  Layers,
  Bookmark,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Question } from '@/types/database';

interface TeacherProfile {
  id: string;
  full_name: string;
  email: string;
  subjects?: string[];
  grades?: string[];
}

interface SourceItem {
  id: string;
  teacher_id: string;
  name: string;
}

export default function AdminQuestionBankPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all'); // Filter 0 for Admin
  const [selectedGrade, setSelectedGrade] = useState<string>('all');    // Filter 1
  const [selectedSource, setSelectedSource] = useState<string>('all');  // Filter 2
  const [selectedChapter, setSelectedChapter] = useState<string>('all'); // Filter 3
  const [selectedLesson, setSelectedLesson] = useState<string>('all');   // Filter 4
  const [selectedType, setSelectedType] = useState<string>('all');      // Filter 5

  const supabase = createClient();

  useEffect(() => {
    async function loadAllData() {
      setLoading(true);

      // 1. Load all teachers
      const { data: teachersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, subjects, grades')
        .eq('role', 'teacher')
        .order('full_name');

      if (teachersData) {
        setTeachers(teachersData);
      }

      // 2. Load all sources
      const { data: sourcesData } = await supabase
        .from('sources')
        .select('id, teacher_id, name')
        .order('name');

      if (sourcesData) {
        setSources(sourcesData);
      }

      // 3. Load all questions with choices
      const { data: questionsData } = await supabase
        .from('questions')
        .select('*, choices:question_choices(*)')
        .order('created_at', { ascending: false });

      if (questionsData) {
        setQuestions(questionsData as Question[]);
      }

      setLoading(false);
    }

    loadAllData();
  }, [supabase]);

  // Teachers Map for fast lookup
  const teachersMap = useMemo(() => {
    const map: Record<string, TeacherProfile> = {};
    teachers.forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [teachers]);

  // Sources Map for fast lookup
  const sourcesMap = useMemo(() => {
    const map: Record<string, string> = {};
    sources.forEach((s) => {
      map[s.id] = s.name;
    });
    return map;
  }, [sources]);

  // Available sources filtered by selected teacher
  const filteredSources = useMemo(() => {
    if (selectedTeacher === 'all') return sources;
    return sources.filter((s) => s.teacher_id === selectedTeacher);
  }, [sources, selectedTeacher]);

  // Available grades (union of default, teacher grades, and question grades)
  const availableGrades = useMemo(() => {
    const defaultGrades = ['الصف الأول الثانوي', 'الصف الثاني الثانوي', 'الصف الثالث الثانوي'];
    let teacherAssignedGrades: string[] = [];

    if (selectedTeacher !== 'all') {
      const currentT = teachersMap[selectedTeacher];
      if (currentT?.grades) {
        teacherAssignedGrades = currentT.grades;
      }
    }

    let subset = questions;
    if (selectedTeacher !== 'all') {
      subset = subset.filter((q) => q.teacher_id === selectedTeacher);
    }

    const fromQuestions = subset
      .map((q) => q.grade_level)
      .filter((g): g is string => !!g && g.trim() !== '');

    const set = new Set([...teacherAssignedGrades, ...fromQuestions, ...defaultGrades]);
    return Array.from(set);
  }, [questions, selectedTeacher, teachersMap]);

  // Available chapters based on teacher, grade, source
  const availableChapters = useMemo(() => {
    let subset = questions;
    if (selectedTeacher !== 'all') {
      subset = subset.filter((q) => q.teacher_id === selectedTeacher);
    }
    if (selectedGrade !== 'all') {
      subset = subset.filter((q) => (q.grade_level || 'الصف الثالث الثانوي') === selectedGrade);
    }
    if (selectedSource !== 'all') {
      subset = subset.filter((q) => q.source_id === selectedSource);
    }
    const chapters = subset
      .map((q) => q.chapter)
      .filter((c): c is string => !!c && c.trim() !== '');
    return Array.from(new Set(chapters));
  }, [questions, selectedTeacher, selectedGrade, selectedSource]);

  // Available lessons based on prior filters
  const availableLessons = useMemo(() => {
    let subset = questions;
    if (selectedTeacher !== 'all') {
      subset = subset.filter((q) => q.teacher_id === selectedTeacher);
    }
    if (selectedGrade !== 'all') {
      subset = subset.filter((q) => (q.grade_level || 'الصف الثالث الثانوي') === selectedGrade);
    }
    if (selectedSource !== 'all') {
      subset = subset.filter((q) => q.source_id === selectedSource);
    }
    if (selectedChapter !== 'all') {
      subset = subset.filter((q) => q.chapter === selectedChapter);
    }
    const lessons = subset
      .map((q) => q.lesson)
      .filter((l): l is string => !!l && l.trim() !== '');
    return Array.from(new Set(lessons));
  }, [questions, selectedTeacher, selectedGrade, selectedSource, selectedChapter]);

  // Main Filter Logic
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // 0. Teacher Filter (المعلم أولاً)
      if (selectedTeacher !== 'all') {
        if (q.teacher_id !== selectedTeacher) return false;
      }

      // 1. Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const teacherName = teachersMap[q.teacher_id]?.full_name?.toLowerCase() || '';
        const matchesText = q.text?.toLowerCase().includes(term);
        const matchesChapter = q.chapter?.toLowerCase().includes(term);
        const matchesLesson = q.lesson?.toLowerCase().includes(term);
        const matchesTeacher = teacherName.includes(term);
        if (!matchesText && !matchesChapter && !matchesLesson && !matchesTeacher) return false;
      }

      // 2. Grade Level (السنة الدراسية)
      if (selectedGrade !== 'all') {
        const qGrade = q.grade_level || 'الصف الثالث الثانوي';
        if (qGrade !== selectedGrade) return false;
      }

      // 3. Source (المصدر)
      if (selectedSource !== 'all') {
        if (q.source_id !== selectedSource) return false;
      }

      // 4. Chapter (الشابتر / الفصل)
      if (selectedChapter !== 'all') {
        if (q.chapter !== selectedChapter) return false;
      }

      // 5. Lesson (الدرس)
      if (selectedLesson !== 'all') {
        if (q.lesson !== selectedLesson) return false;
      }

      // 6. Question Type (نوع السؤال)
      if (selectedType !== 'all') {
        if (q.question_type !== selectedType) return false;
      }

      return true;
    });
  }, [
    questions,
    searchTerm,
    selectedTeacher,
    selectedGrade,
    selectedSource,
    selectedChapter,
    selectedLesson,
    selectedType,
    teachersMap,
  ]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedTeacher('all');
    setSelectedGrade('all');
    setSelectedSource('all');
    setSelectedChapter('all');
    setSelectedLesson('all');
    setSelectedType('all');
  };

  const hasActiveFilters =
    searchTerm !== '' ||
    selectedTeacher !== 'all' ||
    selectedGrade !== 'all' ||
    selectedSource !== 'all' ||
    selectedChapter !== 'all' ||
    selectedLesson !== 'all' ||
    selectedType !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span>بنك الأسئلة الشامل (لوحة الإدارة)</span>
            <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold">
              Admin View
            </span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            إدارة وتصفية جميع بنوك أسئلة المعلمين مع فلاتر تفصيلية حسب المعلم، السنة، المصدر، الشابتر، والدرس.
          </p>
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition w-fit"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط جميع الفلاتر</span>
          </button>
        )}
      </div>

      {/* Filter Box with 6 Filter Dropdowns */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="w-5 h-5 absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث شامل بنص السؤال، اسم المعلم، الفصل، أو الدرس..."
            className="w-full pr-11 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* 6 Filters Grid for Admin */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-1">
          {/* 0. المدرس مين (أولاً في الإدارة) */}
          <div className="bg-blue-50/50 p-2 rounded-xl border border-blue-200/60">
            <label className="text-xs font-black text-blue-900 mb-1.5 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-blue-700" />
              <span>المعلم (المدرس مين)</span>
            </label>
            <select
              value={selectedTeacher}
              onChange={(e) => {
                setSelectedTeacher(e.target.value);
                setSelectedSource('all'); // reset source when teacher changes
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-bold text-blue-950 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">جميع المعلمين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} {t.subjects ? `(${t.subjects.join('، ')})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 1. السنة الدراسية */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
              <span>1. السنة الدراسية</span>
            </label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">الكل (جميع السنوات)</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* 2. المصدر */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. المصدر / الكتاب</span>
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">الكل (جميع المصادر)</option>
              {filteredSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. الشابتر / الفصل */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>3. الشابتر / الفصل</span>
            </label>
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">الكل (جميع الفصول)</option>
              {availableChapters.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 4. الدرس */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-emerald-600" />
              <span>4. الدرس</span>
            </label>
            <select
              value={selectedLesson}
              onChange={(e) => setSelectedLesson(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">الكل (جميع الدروس)</option>
              {availableLessons.length > 0 ? (
                availableLessons.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))
              ) : (
                <option value="all" disabled>
                  لا توجد دروس محددة
                </option>
              )}
            </select>
          </div>

          {/* 5. نوع السؤال */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-purple-600" />
              <span>5. نوع السؤال</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">الكل (جميع الأنواع)</option>
              <option value="mcq">اختيار من متعدد (MCQ)</option>
              <option value="essay">مقالي (Essay)</option>
              <option value="true_false">صح أو خطأ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between font-bold text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>الأسئلة المطابقة للفلتر ({filteredQuestions.length})</span>
          </div>
          {filteredQuestions.length < questions.length && (
            <span className="text-xs font-normal text-slate-500">
              من إجمالي {questions.length} سؤال في البنك الشامل
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">جاري تحميل أسئلة البنك...</div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-slate-600 font-bold">لا توجد أسئلة مطابقة للخيارات المحددة.</p>
            <p className="text-xs text-slate-400">جرب تغيير الفلاتر أو إعادة ضبطها.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredQuestions.map((q, idx) => {
              const teacher = teachersMap[q.teacher_id];
              return (
                <div key={q.id} className="p-5 space-y-3 hover:bg-slate-50/50 transition">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800">
                        #{idx + 1}
                      </span>

                      {/* Teacher Badge */}
                      <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-slate-900 text-white flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-400" />
                        <span>{teacher?.full_name || 'معلم'}</span>
                      </span>

                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                        {q.question_type === 'mcq'
                          ? 'اختيار من متعدد'
                          : q.question_type === 'essay'
                          ? 'مقالي'
                          : 'صح/خطأ'}
                      </span>

                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200">
                        🎓 {q.grade_level || 'الصف الثالث الثانوي'}
                      </span>

                      {q.source_id && sourcesMap[q.source_id] && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                          📖 {sourcesMap[q.source_id]}
                        </span>
                      )}

                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                        📁 {q.chapter}
                      </span>

                      {q.lesson && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                          🔖 {q.lesson}
                        </span>
                      )}
                    </div>

                    <span className="text-xs text-slate-400 font-semibold">
                      {q.subject} • {q.marks || 2} درجات
                    </span>
                  </div>

                  <p className="font-bold text-slate-800 text-base leading-relaxed pr-1">{q.text}</p>

                  {q.image_urls && q.image_urls.length > 0 && (
                    <div className="my-3">
                      <img
                        src={q.image_urls[0]}
                        alt="صورة السؤال"
                        className="max-w-full h-auto max-h-52 rounded-xl border border-slate-200 shadow-xs"
                      />
                    </div>
                  )}

                  {q.choices && q.choices.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {q.choices.map((c) => (
                        <div
                          key={c.id || c.choice_code}
                          className={`p-3 rounded-xl text-xs font-bold border transition ${
                            c.is_correct
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="ml-1 text-slate-500 font-black">({c.choice_code})</span> {c.text}
                        </div>
                      ))}
                    </div>
                  )}

                  {q.model_answer && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 mt-2">
                      <span className="font-black">الإجابة النموذجية: </span>
                      <span>{q.model_answer}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
