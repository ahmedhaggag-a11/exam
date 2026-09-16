# License Info Model
from sqlalchemy import String, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class LicenseInfo(Base, TimestampMixin):
    __tablename__ = "license_info"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    license_key: Mapped[str] = mapped_column(String(100), unique=True)
    teacher_name: Mapped[str] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE")
    expiration_date: Mapped[str] = mapped_column(String(50), default="31/12/2026")
    tier: Mapped[str] = mapped_column(String(100), default="Teacher Pro Edition")
    is_locked: Mapped[bool] = mapped_column(Boolean, default=True)

    def to_dict(self):
        return {
            "id": self.id,
            "license_key": self.license_key,
            "teacher_name": self.teacher_name,
            "status": self.status,
            "expiration_date": self.expiration_date,
            "tier": self.tier
        }
