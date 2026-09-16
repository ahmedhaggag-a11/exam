# Database Initial Seeding with Realistic Physics Curriculum Data
import json
from app.database.connection import get_session_factory
from app.models import (
    Question, QuestionChoice, QuestionType, DifficultyLevel,
    Exam, ExamModelData, ExamQuestion, ExamStatus,
    ExamTemplate, EducationalSource, LicenseInfo
)
from app.models.source import SourceType, SourceStatus
from app.config.settings import TeacherProfile, LicenseConfig

def migrate_existing_sources():
    session_factory = get_session_factory()
    db = session_factory()
    try:
        sources = db.query(EducationalSource).all()
        dirty = False
        for s in sources:
            current_type = getattr(s, "source_type", None)
            if current_type is None:
                s.source_type = SourceType.EXAM_BANK if "بنك" in (s.name_ar or "") else SourceType.TEXTBOOK
                dirty = True
            else:
                try:
                    if not isinstance(current_type, SourceType):
                        as_str = str(current_type).upper().strip()
                        fixed = SourceType(as_str)
                        if fixed != current_type:
                            s.source_type = fixed
                            dirty = True
                except Exception:
                    s.source_type = SourceType.TEXTBOOK
                    dirty = True

            current_status = getattr(s, "status", None)
            if current_status is None:
                if (s.status_ar or "") == "حصري للمعلم":
                    s.status = SourceStatus.EXCLUSIVE
                else:
                    s.status = SourceStatus.CERTIFIED
                dirty = True
            else:
                try:
                    if not isinstance(current_status, SourceStatus):
                        as_str = str(current_status).upper().strip()
                        fixed_s = SourceStatus(as_str)
                        if fixed_s != current_status:
                            s.status = fixed_s
                            dirty = True
                except Exception:
                    s.status = SourceStatus.CERTIFIED
                    dirty = True

            if not s.pages_count:
                s.pages_count = 0
                dirty = True
        if dirty:
            db.commit()
            print(f"  [Migration] Migrated {len(sources)} existing EducationalSource rows with new enums/defaults.")
    except Exception as e:
        db.rollback()
        print(f"  [Migration] Source data migration skipped: {e}")
    finally:
        db.close()


def seed_initial_data():
    migrate_existing_sources()
    session_factory = get_session_factory()
    db = session_factory()
    try:
        # 1. Seed / Sync ExamForge Templates (Ensure exactly 4 clean templates)
        if db.query(ExamTemplate).count() != 4:
            db.query(ExamTemplate).delete()
            db.commit()

            print("Seeding ExamForge templates (4 distinct templates)...")
            templates = [
                ExamTemplate(
                    name_ar="الكلاسيكي المعتمد (Standard Official)",
                    name_en="Classic Official Format",
                    description_ar="تنسيق رسمي معتمد بترويسة مركزية أنيقة ومساحات إجابة واضحة يناسب جميع الامتحانات.",
                    description_en="Official format with centered teacher branding, barcode, and clean question layout.",
                    layout_type="classic",
                    badge="الرسمي المعتمد",
                    accent_color="#2563EB",
                    is_default=True,
                    is_locked=True
                ),
                ExamTemplate(
                    name_ar="النموذج الوزاري (National Ministry)",
                    name_en="National Ministry Standard Layout",
                    description_ar="تنسيق رسمي ذو إطار مزدوج وجدول أسئلة مسطر مطابق لمواصفات الامتحانات الوزارية.",
                    description_en="Identical to the official national exam paper layout and formatting.",
                    layout_type="ministry",
                    badge="مطابق للوزارة",
                    accent_color="#000000",
                    is_default=False,
                    is_locked=True
                ),
                ExamTemplate(
                    name_ar="الحديث المزدوج (Two-Column Pro)",
                    name_en="Modern Two-Column Pro",
                    description_ar="تصميم عصري بدون ألوان مقسم لعمودين لتوفير ورق الطباعة بنسبة 35% مع وضوح عالي.",
                    description_en="Two-column responsive layout saving 35% paper with high clarity.",
                    layout_type="modern_split",
                    badge="توفير الورق",
                    accent_color="#334155",
                    is_default=False,
                    is_locked=True
                ),
                ExamTemplate(
                    name_ar="البسيط الاقتصادي (Minimalist Clean)",
                    name_en="Minimalist Clean Model",
                    description_ar="تصميم بسيط وعملي بدون ألوان، مخصص للطباعة السريعة والاقتصادي في استهلاك الحبر.",
                    description_en="Simple design without colors - suitable for economical printing.",
                    layout_type="simple_first",
                    badge="بسيط واقتصادي",
                    accent_color="#000000",
                    is_default=False,
                    is_locked=True
                ),
            ]
            db.add_all(templates)
            db.commit()

        # 2. Seed License Info if missing
        if db.query(LicenseInfo).count() == 0:
            license_entry = LicenseInfo(
                license_key=LicenseConfig.LICENSE_KEY,
                teacher_name=TeacherProfile.NAME_AR,
                status="ACTIVE",
                expiration_date=LicenseConfig.EXPIRATION_DATE,
                tier=LicenseConfig.TIER,
                is_locked=True
            )
            db.add(license_entry)
            db.commit()

        # 3. Seed Questions & Sample Exams if missing
        if db.query(Question).count() > 0:
            return

        # 4. Seed Questions (Rich Physics dataset for High School)
        q_data = [
            # Chapter 1: Electric Current & Ohm's Law & Kirchhoff
            {
                "text": "سلكان من نفس المادة، طول الأول ضعف طول الثاني ونصف قطر الأول نصف نصف قطر الثاني، فإن النسبة بين مقاومة السلك الأول إلى مقاومة السلك الثاني (R1 : R2) تساوي:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "مقاومة نوعية,أبعاد الموصل,قانون المقاومة",
                "marks": 2,
                "choices": [
                    ("أ", "1 : 8", False),
                    ("ب", "8 : 1", True),
                    ("ج", "4 : 1", False),
                    ("د", "2 : 1", False)
                ]
            },
            {
                "text": "في دائرة كهربية مغلقة تحتوي على بطارية لها مقاومة داخلية، عند زيادة قيمة المقاومة المتغيرة (الريوستات)، فإن قراءة الفولتميتر الموصل بين طرفي البطارية:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "قانون أوم للدوائر المغلقة,فولتميتر البطارية",
                "marks": 2,
                "choices": [
                    ("أ", "تزداد", True),
                    ("ب", "تقل", False),
                    ("ج", "تظل ثابتة", False),
                    ("د", "تصبح صفراً", False)
                ]
            },
            {
                "text": "ثلاث مقاومات متماثلة قيمة كل منها R، عند توصيلها معاً على التوازي تصبح المقاومة المكافئة 2 أوم، فإذا تم توصيلها معاً على التوالي تصبح المقاومة المكافئة:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "نماذج الامتحانات التجريبية والسنوات السابقة",
                "tags": "توصيل توالي وتوازي,مقاومة مكافئة",
                "marks": 2,
                "choices": [
                    ("أ", "6 أوم", False),
                    ("ب", "12 أوم", False),
                    ("ج", "18 أوم", True),
                    ("د", "24 أوم", False)
                ]
            },
            {
                "text": "تطبيق قانون كيرشوف الأول عند نقطة تفرع في دائرة كهربية مغلقة يعتبر تطبيقاً مباشراً لقانون بقاء الشحنة الكهربية.",
                "type": QuestionType.TRUE_FALSE,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "كيرشوف الأول,بقاء الشحنة",
                "marks": 1,
                "choices": [
                    ("أ", "صواب (True)", True),
                    ("ب", "خطأ (False)", False)
                ]
            },
            {
                "text": "وصلت بطارية قوتها الدافعة الكهربية 12V ومقاومتها الداخلية 1Ω بمقاومة خارجية R فمر تيار شدته 2A. احسب قيمة المقاومة R والقدرة المستهلكة في الدائرة بأكملها.",
                "type": QuestionType.ESSAY,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "قانون أوم للدوائر المغلقة,حساب القدرة",
                "marks": 3,
                "model_answer": "1. حساب R: من القانون VB = I(R + r) => 12 = 2(R + 1) => 6 = R + 1 => R = 5 أوم.\n2. القدرة الكلية المستهلكة: P = VB * I = 12 * 2 = 24 وات (أو P = I^2 * R_total = 4 * 6 = 24W)."
            },
            {
                "text": "في شبكة كيرشوف الموضحة، إذا كانت التيارات الداخلة لنقطة عقدة هي I1=3A و I2=4A، وخرج تيار I3=2A وتيار I4 مجهول، فإن قيمة واتجاه التيار I4 تكون:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.HARD,
                "chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "قوانين كيرشوف,عقدة التيارات",
                "marks": 2,
                "choices": [
                    ("أ", "5A خارج من النقطة", True),
                    ("ب", "5A داخل إلى النقطة", False),
                    ("ج", "9A خارج من النقطة", False),
                    ("د", "1A داخل إلى النقطة", False)
                ]
            },

            # Chapter 2: Magnetic Effects & Measuring Instruments
            {
                "text": "سلك مستقيم يمر به تيار كهربي شدته 5A موضوع عمودياً على مجال مغناطيسي منتظم كثافة فيضه 0.4T. فإن القوة المغناطيسية المؤثرة على وحدة الأطوال من السلك تساوي:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الثاني: التأثير المغناطيسي للتيار وأجهزة القياس",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "قوة مغناطيسية,سلك مستقيم,كثافة الفيض",
                "marks": 2,
                "choices": [
                    ("أ", "2 N/m", True),
                    ("ب", "0.5 N/m", False),
                    ("ج", "12.5 N/m", False),
                    ("د", "1.25 N/m", False)
                ]
            },
            {
                "text": "جلفانومتر حساس مقاومة ملفه 50 أوم وأقصى تيار يتحمله ملفه 0.02 أمبير، يراد تحويله إلى فولتميتر يقيس فرق جهد أقصاه 100 فولت. احسب قيمة مضاعف الجهد (Rm) المطلوب توصيله على التوالي.",
                "type": QuestionType.ESSAY,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الثاني: التأثير المغناطيسي للتيار وأجهزة القياس",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "أجهزة القياس,فولتميتر,مضاعف الجهد",
                "marks": 3,
                "model_answer": "Rm = (V - Vg) / Ig = (V - (Ig * Rg)) / Ig\nRm = (100 - (0.02 * 50)) / 0.02 = (100 - 1) / 0.02 = 99 / 0.02 = 4950 أوم."
            },
            {
                "text": "ملف دائري عدد لفاته N ونصف قطره r يمر به تيار I فكانت كثافة الفيض عند مركزه B. إذا أُعيد لفه بحيث أصبح نصف قطره 2r مع مرور نفس التيار، فإن كثافة الفيض تصبح:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.HARD,
                "chapter": "الفصل الثاني: التأثير المغناطيسي للتيار وأجهزة القياس",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "ملف دائري,إعادة التشكيل,كثافة الفيض",
                "marks": 2,
                "choices": [
                    ("أ", "B / 4", True),
                    ("ب", "B / 2", False),
                    ("ج", "2 B", False),
                    ("د", "4 B", False)
                ]
            },
            {
                "text": "عزم الازدواج المغناطيسي المؤثر على ملف مستطيل يمر به تيار وموضوع موازياً لخطوط الفيض المغناطيسي يكون قيمة عظمى.",
                "type": QuestionType.TRUE_FALSE,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الثاني: التأثير المغناطيسي للتيار وأجهزة القياس",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "عزم الازدواج,زاوية الملف",
                "marks": 1,
                "choices": [
                    ("أ", "صواب (True)", True),
                    ("ب", "خطأ (False)", False)
                ]
            },
            {
                "text": "أميتر حراري يمر به تيار متردد قيمته الفعالة I تتولد في سلك البلاتين-إيريديوم قدرة حرارية P. فإذا زادت القيمة الفعالة للتيار إلى 3I، فإن القدرة الحرارية المتولدة تصبح:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الثاني: التأثير المغناطيسي للتيار وأجهزة القياس",
                "source": "نماذج الامتحانات التجريبية والسنوات السابقة",
                "tags": "أميتر حراري,طاقة حرارية,قيمة فعالة",
                "marks": 2,
                "choices": [
                    ("أ", "3 P", False),
                    ("ب", "6 P", False),
                    ("ج", "9 P", True),
                    ("د", "P / 9", False)
                ]
            },

            # Chapter 3: Induction, Generators, Transformers
            {
                "text": "دينامو تيار متردد يدور ملفه بمعدل 3000 دورة في الدقيقة، فإن تردد التيار الناتج يساوي:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الثالث: الحث الكهرومغناطيسي والمحولات والدينامو",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "دينامو,تردد التيار,سرعة زاوية",
                "marks": 2,
                "choices": [
                    ("أ", "50 Hz", True),
                    ("ب", "60 Hz", False),
                    ("ج", "100 Hz", False),
                    ("د", "3000 Hz", False)
                ]
            },
            {
                "text": "محول كهربي مثالي خافض للجهد، النسبة بين عدد لفات ملفيه 1 : 4، فإذا وصل ملفه الابتدائي بمصدر جهد متردد 200V، فإن القوة الدافعة الكهربية الناتجة في الملف الثانوي تكون:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الثالث: الحث الكهرومغناطيسي والمحولات والدينامو",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "محول مثالي,خافض للجهد,نسبة اللفات",
                "marks": 2,
                "choices": [
                    ("أ", "50 V", True),
                    ("ب", "800 V", False),
                    ("ج", "100 V", False),
                    ("د", "25 V", False)
                ]
            },
            {
                "text": "ملف لولبي معامل حثه الذاتي 0.4H يمر به تيار كهربي انعدم خلال 0.02s فتولدت قوة دافعة كهربية مستحثة طردية قدرها 100V. احسب شدة التيار الأصلي الذي كان يمر بالملف.",
                "type": QuestionType.ESSAY,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الثالث: الحث الكهرومغناطيسي والمحولات والدينامو",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "حث ذاتي,قانون فاراداي,قوة مستحثة",
                "marks": 3,
                "model_answer": "emf = - L * (ΔI / Δt)\n100 = 0.4 * (I / 0.02)\n100 = 20 * I => I = 100 / 20 = 5 أمبير."
            },
            {
                "text": "عند تحريك مغناطيس باتجاه ملف لولبي بسرعة، يتولد في الملف تيار مستحث يكون اتجاهه بحيث يقاوم اقتراب المغناطيس طبقاً لقاعدة لنز.",
                "type": QuestionType.TRUE_FALSE,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الثالث: الحث الكهرومغناطيسي والمحولات والدينامو",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "قاعدة لنز,حث كهرومغناطيسي",
                "marks": 1,
                "choices": [
                    ("أ", "صواب (True)", True),
                    ("ب", "خطأ (False)", False)
                ]
            },
            {
                "text": "في تجربة فاراداي، يتناسب مقدار القوة الدافعة الكهربية المستحثة المتولدة في ملف طردياً مع المعدل الزمني لقطع خطوط الفيض المغناطيسي وعدد لفات الملف.",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.HARD,
                "chapter": "الفصل الثالث: الحث الكهرومغناطيسي والمحولات والدينامو",
                "source": "نماذج الامتحانات التجريبية والسنوات السابقة",
                "tags": "قانون فاراداي,معدل قطع الفيض",
                "marks": 2,
                "choices": [
                    ("أ", "قانون فاراداي", True),
                    ("ب", "قانون أمبير الدائري", False),
                    ("ج", "قانون أوم", False),
                    ("د", "قانون كيرشوف الثاني", False)
                ]
            },

            # Chapter 4: AC Circuits & Resonance
            {
                "text": "في دائرة تيار متردد تحتوي على ملف حث عديم المقاومة الأومية ومكثف ومقاومة أومية موصلين على التوالي (دائرة RLC)، عند حالة الرنين تكون المعاوقة الكلية للدائرة:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الرابع: دوائر التيار المتردد والرنين",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "حالة الرنين,دائرة RLC,معاوقة الدائرة",
                "marks": 2,
                "choices": [
                    ("أ", "أقل ما يمكن وتساوي قيمة المقاومة الأومية R", True),
                    ("ب", "أكبر ما يمكن وتساوي المفاعلة الحثية XL", False),
                    ("ج", "تساوي صفراً", False),
                    ("د", "تساوي المفاعلة السعوية XC", False)
                ]
            },
            {
                "text": "دائرة تيار متردد تحتوي على ملف حث مفاعلته الحثية 40 أوم ومقاومة أومية 30 أوم موصلين على التوالي مع مصدر جهد متردد 100V. احسب معاوقة الدائرة الكلية Z وشدة التيار المار.",
                "type": QuestionType.ESSAY,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الرابع: دوائر التيار المتردد والرنين",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "دائرة RL,حساب المعاوقة,شدة التيار",
                "marks": 3,
                "model_answer": "1. المعاوقة Z = √(R^2 + XL^2) = √(30^2 + 40^2) = √(900 + 1600) = √2500 = 50 أوم.\n2. شدة التيار I = V / Z = 100 / 50 = 2 أمبير."
            },
            {
                "text": "مكثف سعته C يتصل بمصدر تيار متردد تردده f، إذا تضاعف تردد المصدر إلى 2f، فإن المفاعلة السعوية للمكثف (Xc):",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الرابع: دوائر التيار المتردد والرنين",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "مفاعلة سعوية,تردد المصدر,علاقة عكسية",
                "marks": 2,
                "choices": [
                    ("أ", "تقل إلى النصف", True),
                    ("ب", "تتضاعف", False),
                    ("ج", "تزداد لأربعة أمثالها", False),
                    ("د", "تظل ثابتة", False)
                ]
            },
            {
                "text": "في دائرة التيار المتردد التي تحتوي على مكثف فقط، يتقدم الجهد الكلي على شدة التيار بزاوية طور 90 درجة.",
                "type": QuestionType.TRUE_FALSE,
                "diff": DifficultyLevel.HARD,
                "chapter": "الفصل الرابع: دوائر التيار المتردد والرنين",
                "source": "نماذج الامتحانات التجريبية والسنوات السابقة",
                "tags": "زاوية الطور,مكثف التيار المتردد",
                "marks": 1,
                "choices": [
                    ("أ", "صواب (True)", False),
                    ("ب", "خطأ (False - التيار هو الذي يتقدم)", True)
                ]
            },

            # Chapter 5: Modern Physics & Wave-Particle Duality
            {
                "text": "في ظاهرة كومتون، بعد تصادم فوتون أشعة إكس بإلكترون حر، فإن الطول الموجي للفوتون المشتت:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.EASY,
                "chapter": "الفصل الخامس: ازدواجية الموجة والجسيم والفيزياء الحديثة",
                "source": "كتاب الوزارة المعتمد (الفيزياء 3ث)",
                "tags": "ظاهرة كومتون,طول موجي,فوتون مشتت",
                "marks": 2,
                "choices": [
                    ("أ", "يزداد", True),
                    ("ب", "يقل", False),
                    ("ج", "يظل ثابتاً", False),
                    ("د", "ينعدم", False)
                ]
            },
            {
                "text": "سقط ضوء أحادي اللون تردده أكبر من التردد الحرج على سطح فلز فتحررت إلكترونات كهروضوئية. فإذا زادت شدة الضوء الساقط مع ثبوت تردده، فإن طاقة الحركة العظمى للإلكترونات المتحررة:",
                "type": QuestionType.MCQ,
                "diff": DifficultyLevel.MEDIUM,
                "chapter": "الفصل الخامس: ازدواجية الموجة والجسيم والفيزياء الحديثة",
                "source": "مذكرات وسلسلة الأستاذ أحمد فؤاد الشاملة",
                "tags": "الخلية الكهروضوئية,شدة الضوء,طاقة الحركة",
                "marks": 2,
                "choices": [
                    ("أ", "تظل ثابتة (وتزداد شدة تيار الانبعاث)", True),
                    ("ب", "تزداد للضعف", False),
                    ("ج", "تقل إلى النصف", False),
                    ("د", "تنعدم", False)
                ]
            },
            {
                "text": "إذا كان الطول الموجي المصاحب لأقصى شدة إشعاع صادر من جسم أسود عند درجة حرارة 3000K هو 1 ميكرومتر، فما درجة حرارة جسم آخر أقصى شدة إشعاع له عند 0.5 ميكرومتر طبقاً لقانون فين؟",
                "type": QuestionType.ESSAY,
                "diff": DifficultyLevel.HARD,
                "chapter": "الفصل الخامس: ازدواجية الموجة والجسيم والفيزياء الحديثة",
                "source": "بنك أسئلة المركز القومي للامتحانات (التقويم التربوي)",
                "tags": "قانون فين,إشعاع الجسم الأسود",
                "marks": 3,
                "model_answer": "طبقاً لقانون فين: λ1 / λ2 = T2 / T1\n1 / 0.5 = T2 / 3000\n2 = T2 / 3000 => T2 = 6000 كلفن (K)."
            }
        ]

        created_questions = []
        for q_item in q_data:
            q = Question(
                text=q_item["text"],
                question_type=q_item["type"],
                difficulty=q_item["diff"],
                subject="الفيزياء",
                chapter=q_item["chapter"],
                source=q_item["source"],
                tags=q_item.get("tags"),
                marks=q_item.get("marks", 2),
                model_answer=q_item.get("model_answer")
            )
            db.add(q)
            db.flush()

            if "choices" in q_item:
                for idx, (c_code, c_text, is_corr) in enumerate(q_item["choices"]):
                    choice = QuestionChoice(
                        question_id=q.id,
                        choice_code=c_code,
                        text=c_text,
                        is_correct=is_corr,
                        order_index=idx
                    )
                    db.add(choice)

            created_questions.append(q)

        db.commit()

        # 5. Create Pre-seeded Sample Exams with 4 Models
        sample_exam_1 = Exam(
            name="الاختبار الشامل الأول - الكهربية والتيار المتردد",
            subject="الفيزياء",
            grade="الصف الثالث الثانوي",
            duration="90 دقيقة",
            exam_date="2026-08-28",
            instructions="1. أجب عن الأسئلة في ورقة الإجابة المخصصة.\n2. مدة الاختبار 90 دقيقة.\n3. راجع إجاباتك قبل التسليم.",
            language="ar",
            status=ExamStatus.READY,
            total_questions=15,
            total_marks=30,
            models_count=4,
            template_name="الكلاسيكي المعتمد (Standard Ministry)",
            template_id=1,
            shuffle_questions=True,
            shuffle_choices=True,
            balance_difficulty=True,
            balance_chapters=True
        )
        db.add(sample_exam_1)
        db.flush()

        # Link questions to exam
        for i, q in enumerate(created_questions[:15]):
            eq = ExamQuestion(
                exam_id=sample_exam_1.id,
                question_id=q.id,
                order_index=i
            )
            db.add(eq)

        # Create 4 models for exam 1
        model_names = [
            ("A", "النموذج (أ)"),
            ("B", "النموذج (ب)"),
            ("C", "النموذج (ج)"),
            ("D", "النموذج (د)")
        ]
        q_ids = [q.id for q in created_questions[:15]]
        for idx, (code, name_ar) in enumerate(model_names):
            # Rotated / shuffled order
            shuffled_ids = q_ids[idx:] + q_ids[:idx]
            model = ExamModelData(
                exam_id=sample_exam_1.id,
                model_code=code,
                model_name_ar=name_ar,
                questions_order_json=json.dumps(shuffled_ids),
                choices_order_json=json.dumps({})
            )
            db.add(model)

        # Sample exam 2 (Modern Physics Quiz)
        sample_exam_2 = Exam(
            name="اختبار قصير (Quiz 3) - الفيزياء الحديثة والازدواجية",
            subject="الفيزياء",
            grade="الصف الثالث الثانوي",
            duration="45 دقيقة",
            exam_date="2026-08-20",
            instructions="اختبار أسبوعي لتقييم استيعاب مفاهيم كومتون والظاهرة الكهروضوئية.",
            language="ar",
            status=ExamStatus.GENERATED,
            total_questions=8,
            total_marks=16,
            models_count=2,
            template_name="المختصر المركز (Compact Grid)",
            template_id=3,
            shuffle_questions=True,
            shuffle_choices=True
        )
        db.add(sample_exam_2)
        db.flush()

        for i, q in enumerate(created_questions[15:23]):
            eq = ExamQuestion(
                exam_id=sample_exam_2.id,
                question_id=q.id,
                order_index=i
            )
            db.add(eq)

        for code, name_ar in [("A", "النموذج (أ)"), ("B", "النموذج (ب)")]:
            model = ExamModelData(
                exam_id=sample_exam_2.id,
                model_code=code,
                model_name_ar=name_ar,
                questions_order_json=json.dumps([q.id for q in created_questions[15:23]]),
                choices_order_json=json.dumps({})
            )
            db.add(model)

        db.commit()

        print("Database seeded successfully with realistic data!")

        # =============================================================
        # 7. Auto-Import any PDF files placed in assets/pdfs/ folder
        #    (This lets you pre-pack teacher PDF materials with the build)
        #    Run in a NEW session so SourceService sessions don't conflict
        # =============================================================
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()

    import os as _os
    _BASE_DIR_ABS = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
    ASSETS_PDF_DIR = _os.path.normpath(_os.path.join(_BASE_DIR_ABS, "..", "assets", "pdfs"))
    _os.makedirs(ASSETS_PDF_DIR, exist_ok=True)

    PDF_MANIFEST = [
    ]
    # --- Example: uncomment and place your real PDFs in assets/pdfs/ ---
    # PDF_MANIFEST.append({
    #     "file": "مذكرات_الفيزياء_الفصل_الأول.pdf",
    #     "name_ar": "مذكرات أ. أحمد فؤاد - الفصل الأول",
    #     "subject": "الفيزياء",
    #     "default_chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
    #     "author": "أ. أحمد فؤاد عبدالله",
    # })
    # PDF_MANIFEST.append({
    #     "file": "بنك_المركز_القومي_2025.pdf",
    #     "name_ar": "بنك المركز القومي للامتحانات 2025",
    #     "subject": "الفيزياء",
    #     "default_chapter": "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرشوف",
    #     "author": "المركز القومي للامتحانات",
    # })
    # --- End of manifest ---

    if PDF_MANIFEST:
        try:
            from app.services.source_service import SourceService
            from app.services.question_service import QuestionService
            for info in PDF_MANIFEST:
                fpath = _os.path.join(ASSETS_PDF_DIR, info.get("file", ""))
                if not _os.path.isfile(fpath):
                    print(f"  [Assets PDF] SKIP (file not found): {info.get('file')}")
                    continue
                try:
                    src, _, qs = SourceService.upload_pdf_and_extract(
                        pdf_file_path=fpath,
                        original_name=info.get("file"),
                        name_ar=info.get("name_ar"),
                        subject=info.get("subject", "الفيزياء"),
                        default_chapter=info.get("default_chapter", "الفصل الأول"),
                        author_name=info.get("author"),
                    )
                    added = 0
                    if qs:
                        r = QuestionService.create_questions_bulk(qs)
                        added = r.get("created_count", 0)
                    print(f"  [Assets PDF] ADDED: {info.get('file')}  -> source #{src['id']}  +  {added} questions")
                except Exception as e_inner:
                    print(f"  [Assets PDF] ERROR importing {info.get('file')}: {e_inner}")
        except Exception as e_outer:
            print(f"  [Assets PDF] Manifest import skipped: {e_outer}")
