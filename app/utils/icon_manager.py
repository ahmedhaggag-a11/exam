# ExamForge Icon & Visual Asset System using Pillow & CTkImage
from PIL import Image, ImageDraw, ImageFont
import customtkinter as ctk
from typing import Dict, Tuple, Optional

class IconManager:
    _cache: Dict[str, ctk.CTkImage] = {}

    @classmethod
    def get_symbol_icon(cls, name: str) -> str:
        """Unicode fallback symbols for crisp text-embedded rendering"""
        symbols = {
            "dashboard": "📊",
            "create_exam": "✨",
            "question_bank": "📚",
            "exams": "📑",
            "templates": "🎨",
            "sources": "📖",
            "settings": "⚙️",
            "search": "🔍",
            "filter": "⚡",
            "add": "➕",
            "edit": "✏️",
            "view": "👁️",
            "duplicate": "📄",
            "delete": "🗑️",
            "generate": "🚀",
            "export_pdf": "📥",
            "check": "✓",
            "cross": "✕",
            "lock": "🔒",
            "star": "★",
            "bell": "🔔",
            "user": "👤",
            "info": "ℹ️",
            "refresh": "🔄",
            "chevron_left": "‹",
            "chevron_right": "›",
            "chevron_down": "▼",
            "models": "🗂️",
            "sparkles": "✨",
            "trophy": "🏆",
            "shield": "🛡️",
        }
        return symbols.get(name, "•")

    @classmethod
    def create_colored_badge_image(cls, text: str, bg_color: str, fg_color: str = "#FFFFFF", size: Tuple[int, int] = (24, 24)) -> ctk.CTkImage:
        key = f"badge_{text}_{bg_color}_{fg_color}_{size}"
        if key in cls._cache:
            return cls._cache[key]
        
        img = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        # Draw rounded rectangle
        draw.rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=size[1] // 2, fill=bg_color)
        
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None

        if font:
            bbox = draw.textbbox((0, 0), text, font=font)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            x = (size[0] - w) / 2
            y = (size[1] - h) / 2 - 1
            draw.text((x, y), text, fill=fg_color, font=font)

        ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=size)
        cls._cache[key] = ctk_img
        return ctk_img

    @classmethod
    def create_logo_image(cls, size: int = 40, bg_color: str = "#2563EB", fg_color: str = "#FFFFFF") -> ctk.CTkImage:
        key = f"logo_{size}_{bg_color}_{fg_color}"
        if key in cls._cache:
            return cls._cache[key]
        
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 4, fill=bg_color)
        
        # Draw stylized monogram "EF"
        try:
            font = ImageFont.load_default()
        except Exception:
            font = None
            
        draw.text((size * 0.22, size * 0.25), "EF", fill=fg_color, font=font)
        
        ctk_img = ctk.CTkImage(light_image=img, dark_image=img, size=(size, size))
        cls._cache[key] = ctk_img
        return ctk_img
