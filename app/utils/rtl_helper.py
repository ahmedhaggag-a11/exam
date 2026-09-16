# Arabic RTL & Bidirectional Text Helper
import re
from app.config.i18n import is_rtl

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False

def contains_arabic(text: str) -> bool:
    if not text:
        return False
    return bool(re.search(r'[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]', text))

def format_arabic_for_canvas(text: str) -> str:
    """Reshapes and applies BiDi algorithm for PIL/Canvas rendering where needed"""
    if not text or not HAS_BIDI:
        return text
    if contains_arabic(text):
        try:
            reshaped = arabic_reshaper.reshape(text)
            return get_display(reshaped)
        except Exception:
            return text
    return text

def get_align() -> str:
    """Returns 'e' (right) in RTL mode, 'w' (left) in LTR mode"""
    return "e" if is_rtl() else "w"

def get_justify() -> str:
    """Returns 'right' in RTL mode, 'left' in LTR mode"""
    return "right" if is_rtl() else "left"

def get_sticky_fill() -> str:
    return "ew"
