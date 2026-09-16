# License & Branding Service - Read-only Profile Information
from typing import Dict, Any
from app.config.settings import TeacherProfile, LicenseConfig

class LicenseService:
    @classmethod
    def get_license_info(cls) -> Dict[str, Any]:
        return {
            "license_key": LicenseConfig.LICENSE_KEY,
            "status": LicenseConfig.STATUS,
            "status_ar": LicenseConfig.STATUS_AR,
            "status_en": LicenseConfig.STATUS_EN,
            "tier": LicenseConfig.TIER,
            "tier_ar": LicenseConfig.TIER_AR,
            "expiration_date": LicenseConfig.EXPIRATION_DATE,
            "max_models": LicenseConfig.MAX_MODELS_PER_EXAM,
            "is_locked": LicenseConfig.IS_LOCKED
        }

    @classmethod
    def get_teacher_profile(cls) -> Dict[str, Any]:
        return {
            "teacher_id": TeacherProfile.TEACHER_ID,
            "name_ar": TeacherProfile.NAME_AR,
            "name_en": TeacherProfile.NAME_EN,
            "title_ar": TeacherProfile.TITLE_AR,
            "title_en": TeacherProfile.TITLE_EN,
            "center_ar": TeacherProfile.CENTER_AR,
            "center_en": TeacherProfile.CENTER_EN,
            "phone": TeacherProfile.PHONE,
            "email": TeacherProfile.EMAIL,
            "subject_ar": TeacherProfile.SUBJECT_AR,
            "subject_en": TeacherProfile.SUBJECT_EN,
            "grade_ar": TeacherProfile.GRADE_AR,
            "grade_en": TeacherProfile.GRADE_EN,
            "academic_year": TeacherProfile.ACADEMIC_YEAR,
            "avatar_initials": TeacherProfile.AVATAR_INITIALS
        }
