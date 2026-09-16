# ExamForge Application Configuration & Settings
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_DIR = BASE_DIR / "data"
os.makedirs(DB_DIR, exist_ok=True)
SQLITE_DB_PATH = DB_DIR / "examforge.db"

# Default output directory for generated PDFs & print-ready packages
# Falls back to user home if C: root is not writable
_DEFAULT_ROOT = r"C:/ExamForge_Output" if os.name == "nt" else str(Path.home() / "ExamForge_Output")
EXPORT_OUTPUT_DIR = Path(os.getenv("EXAMFORGE_OUTPUT_DIR", _DEFAULT_ROOT))
os.makedirs(EXPORT_OUTPUT_DIR, exist_ok=True)

class AppConfig:
    APP_NAME = "ExamForge"
    APP_TITLE_AR = "ExamForge | منصة صانع الاختبارات الذكية"
    APP_TITLE_EN = "ExamForge | Smart Exam Authoring & Management"
    VERSION = "1.0.0"
    BUILD_DATE = "2026-08-24"
    
    USE_MYSQL = False
    MYSQL_HOST = os.getenv("EXAMFORGE_DB_HOST", "localhost")
    MYSQL_PORT = int(os.getenv("EXAMFORGE_DB_PORT", "3306"))
    MYSQL_USER = os.getenv("EXAMFORGE_DB_USER", "root")
    MYSQL_PASSWORD = os.getenv("EXAMFORGE_DB_PASSWORD", "password")
    MYSQL_DATABASE = os.getenv("EXAMFORGE_DB_NAME", "examforge")
    
    @classmethod
    def get_database_uri(cls):
        if cls.USE_MYSQL:
            return f"mysql+pymysql://{cls.MYSQL_USER}:{cls.MYSQL_PASSWORD}@{cls.MYSQL_HOST}:{cls.MYSQL_PORT}/{cls.MYSQL_DATABASE}?charset=utf8mb4"
        return f"sqlite:///{SQLITE_DB_PATH}"

class TeacherProfile:
    TEACHER_ID = "TCH-2026-8801"
    NAME_AR = "الأستاذ / أحمد فؤاد"
    NAME_EN = "Mr. Ahmed Fouad"
    TITLE_AR = "خبير ومستشار مادة الفيزياء للثانوية العامة"
    TITLE_EN = "Senior Physics Consultant & High School Specialist"
    CENTER_AR = "أكاديمية نيوتن للعلوم والفيزياء"
    CENTER_EN = "Newton Physics Academy"
    PHONE = "01012345678"
    EMAIL = "ahmed.physics@examforge.edu"
    SUBJECT_AR = "الفيزياء"
    SUBJECT_EN = "Physics"
    GRADE_AR = "الصف الثالث الثانوي (العام والأزهر)"
    GRADE_EN = "3rd Secondary Grade (General & Azhar)"
    ACADEMIC_YEAR = "2025 / 2026"
    AVATAR_INITIALS = "أ.ف"
    LOGO_TAG = "PHYSICS PRO"

class LicenseConfig:
    LICENSE_KEY = "EF-PRO-EGY-2026-9942-AUTH"
    STATUS = "ACTIVE"
    STATUS_AR = "ساري ونشط"
    STATUS_EN = "Active"
    TIER = "Teacher Pro Edition"
    TIER_AR = "إصدار المعلم المحترف (مخصص)"
    EXPIRATION_DATE = "31/12/2026"
    MAX_MODELS_PER_EXAM = 4
    IS_LOCKED = True
