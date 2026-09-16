# Print, Open File, and Browser Preview Utilities for ExamForge
import os
import sys
import tempfile
import webbrowser
from pathlib import Path
from typing import Optional, Dict, Any, List

from app.config.settings import EXPORT_OUTPUT_DIR


def _safe_path(p: Optional[str]) -> Optional[str]:
    if not p:
        return None
    q = Path(p)
    try:
        q.touch(exist_ok=True)
    except Exception:
        pass
    try:
        return str(q.resolve())
    except Exception:
        return str(q)


def _sanitize_filename(name: str) -> str:
    bad = '<>:"/\\|?*'
    safe = ''.join('_' if c in bad else c for c in (name or 'exam')).strip()
    return safe or 'exam'


def resolve_exam_output_dir() -> Path:
    """Guaranteed-writable output dir (fallback to tempdir if root path is locked)."""
    d = Path(EXPORT_OUTPUT_DIR)
    try:
        os.makedirs(d, exist_ok=True)
        # Quick writability test
        probe = d / ".ef_write_test"
        probe.write_bytes(b"ok")
        probe.unlink(missing_ok=True)
        return d
    except Exception:
        alt = Path(tempfile.gettempdir()) / "ExamForge_Output"
        try:
            os.makedirs(alt, exist_ok=True)
            return alt
        except Exception:
            return Path(tempfile.gettempdir())


def build_exam_output_paths(exam_name: str, models_count: int = 4) -> Dict[str, Any]:
    """Build a stable dict of output paths for an exam package (used by modal & export)."""
    out_dir = resolve_exam_output_dir()
    safe_name = _sanitize_filename(exam_name)

    model_letters = ["A", "B", "C", "D"][:max(1, min(4, int(models_count)))]
    model_suffix = "_".join(model_letters)

    combined_pdf = out_dir / f"{safe_name}_Models_{model_suffix}.pdf"
    answer_key_pdf = out_dir / f"{safe_name}_Model_Answer.pdf"
    bublesheet_pdf = out_dir / f"{safe_name}_Bubble_Sheet.pdf"
    answer_sheet_pdf = out_dir / f"{safe_name}_Answer_Sheet.pdf"
    single_model_pdfs = {
        letter: out_dir / f"{safe_name}_Model_{letter}.pdf" for letter in model_letters
    }

    return {
        "output_dir": str(out_dir),
        "exam_name": safe_name,
        "models_count": len(model_letters),
        "model_letters": model_letters,
        "combined_pdf": str(combined_pdf),
        "answer_key_pdf": str(answer_key_pdf),
        "bubble_sheet_pdf": str(bublesheet_pdf),
        "answer_sheet_pdf": str(answer_sheet_pdf),
        "per_model_pdfs": {k: str(v) for k, v in single_model_pdfs.items()},
    }


def open_file_in_os(path: str) -> bool:
    """Open file using the OS default registered app (PDF reader, browser, etc)."""
    p = _safe_path(path)
    if not p or not Path(p).exists():
        return False
    try:
        if os.name == "nt":
            os.startfile(p)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            import subprocess
            subprocess.run(["open", p], check=False)
        else:
            import subprocess
            subprocess.run(["xdg-open", p], check=False)
        return True
    except Exception:
        return False


def open_folder_in_os(path: str) -> bool:
    """Open the folder containing a file (or a folder path directly)."""
    if not path:
        return False
    target = Path(path)
    if target.is_file():
        target = target.parent
    p = _safe_path(str(target))
    if not p:
        return False
    try:
        if os.name == "nt":
            import subprocess
            # select the file if provided path is a file (better UX)
            src = Path(path)
            if src.is_file():
                subprocess.run(["explorer", "/select,", str(src.resolve())], check=False)
            else:
                os.startfile(p)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            import subprocess
            subprocess.run(["open", p], check=False)
        else:
            import subprocess
            subprocess.run(["xdg-open", p], check=False)
        return True
    except Exception:
        return False


def print_file_via_os(path: str, show_print_dialog: bool = True) -> bool:
    """Best-effort OS-level print. On Windows: tries default PDF handler 'print' verb.

    This intentionally has many fallbacks because printing from a desktop GUI to a
    real printer across all PDF viewers differs wildly. The order is:
      1. ShellExecute 'print' verb (Windows only, works for most PDF readers)
      2. Open file (user can press Ctrl+P in their viewer)
      3. Open in browser with window.print() injected preview.
    """
    p = _safe_path(path)
    if not p:
        return False

    exists = Path(p).exists()
    if os.name == "nt":
        try:
            try:
                import win32api  # type: ignore
                win32api.ShellExecute(0, "print", p, None, ".", 0)
                return True
            except Exception:
                pass
            try:
                import ctypes
                res = ctypes.windll.shell32.ShellExecuteW(
                    None, "print" if show_print_dialog else "printto", p, None, None, 1
                )
                if res > 32:
                    return True
            except Exception:
                pass
        except Exception:
            pass

    # Fallback chain: open the file so the user can Ctrl+P
    if open_file_in_os(p):
        return True

    # Last fallback: browser-based print preview
    return open_browser_print_preview_for_pdf(p)


def open_browser_print_preview_for_pdf(pdf_path: str) -> bool:
    """Open the PDF in the default web browser, then immediately invoke
    window.print() via a small wrapper HTML. Works for all platforms."""
    pdf = Path(pdf_path)
    if not pdf.exists():
        return False
    try:
        wrapper = Path(tempfile.gettempdir()) / f"ef_print_{pdf.stem}.html"
        pdf_uri = pdf.resolve().as_uri()
        html = f"""<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>ExamForge - معاينة قبل الطباعة: {pdf.stem}</title>
<style>
  html,body{{margin:0;padding:0;height:100%;background:#0F172A;color:#F8FAFC;
           font-family:'Segoe UI',Tahoma,Arial,sans-serif;}}
  .bar{{position:sticky;top:0;z-index:10;background:#1E293B;padding:14px 24px;
        display:flex;gap:10px;align-items:center;border-bottom:1px solid #334155;}}
  .bar h2{{margin:0;font-size:15px;flex:1;color:#E2E8F0;}}
  .btn{{border:0;border-radius:8px;padding:9px 18px;cursor:pointer;font-weight:700;
        font-size:13px;}}
  .btn-primary{{background:#2563EB;color:#fff;}}
  .btn-primary:hover{{background:#1D4ED8;}}
  .btn-ghost{{background:#334155;color:#E2E8F0;}}
  .btn-ghost:hover{{background:#475569;}}
  iframe{{display:block;width:100%;border:0;background:#fff;min-height:calc(100vh - 58px);}}
</style>
</head>
<body>
<div class="bar">
  <h2>🖨️  معاينة قبل الطباعة — {pdf.name}</h2>
  <button class="btn btn-ghost" onclick="history.back()">← رجوع</button>
  <button class="btn btn-primary" onclick="doPrint()">🖨️  طباعة الآن (Ctrl+P)</button>
</div>
<iframe id="pdfView" src="{pdf_uri}#toolbar=1&navpanes=1"
        title="PDF Preview"></iframe>
<script>
  function doPrint(){{
    try{{
      const frm = document.getElementById('pdfView');
      try{{ frm.contentWindow.focus(); frm.contentWindow.print(); return; }}catch(e){{}}
    }}catch(e){{}}
    window.print();
  }}
  // Auto-open print dialog once loaded for fast workflows
  window.addEventListener('load', ()=>{{
    try{{
      const v = document.getElementById('pdfView');
      const fire = ()=>{{ try{{ v.contentWindow.focus(); v.contentWindow.print(); }}catch(e){{ window.print(); }} }};
      if (v.contentDocument && v.contentDocument.readyState==='complete'){{ setTimeout(fire, 900); }}
      else{{ v.addEventListener('load', ()=>setTimeout(fire, 1200)); }}
    }}catch(e){{
      setTimeout(doPrint, 1500);
    }}
  }});
</script>
</body>
</html>
"""
        wrapper.write_text(html, encoding="utf-8")
        webbrowser.open(wrapper.resolve().as_uri())
        return True
    except Exception:
        try:
            webbrowser.open(Path(pdf_path).resolve().as_uri())
            return True
        except Exception:
            return False


def build_and_open_html_print_preview(
    exam_name: str,
    exam_data: Dict[str, Any],
    questions_per_model: Dict[str, List[Dict[str, Any]]],
    output_paths: Dict[str, Any],
    language: str = "ar",
    template: Optional[Dict[str, Any]] = None,
) -> bool:
    """Fully in-code printable HTML document (no PDF required). Useful when the
    PDF pipeline is not yet wired end-to-end but the teacher still wants to print."""
    rtl = language != "en"
    dir_attr = 'dir="rtl" lang="ar"' if rtl else 'dir="ltr" lang="en"'
    L = {
        "ar": {
            "title": "معاينة الطباعة", "student": "اسم الطالب", "group": "المجموعة / القاعة",
            "instructions": "تعليمات هامة", "questions": "الأسئلة", "marks": "درجات",
            "model": "النموذج", "true": "صحيح", "false": "خطأ", "answer_space": "مساحة الإجابة",
            "teacher": "المعلم", "subject": "المادة", "duration": "الزمن"
        },
        "en": {
            "title": "Print Preview", "student": "Student Name", "group": "Group / Hall",
            "instructions": "Important Instructions", "questions": "Questions", "marks": "Marks",
            "model": "Model", "true": "True", "false": "False", "answer_space": "Answer Space",
            "teacher": "Teacher", "subject": "Subject", "duration": "Duration"
        },
    }[language]
    safe_name = _sanitize_filename(exam_name)
    official_layout = (template or {}).get("layout_type") == "ministry"
    paper_class = "paper official-paper" if official_layout else "paper"
    pieces: List[str] = []
    for idx, (code, qs) in enumerate(questions_per_model.items()):
        body_rows = []
        for qi, q in enumerate(qs, start=1):
            qtype = q.get("question_type", "mcq")
            q_text = str(q.get("text", "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            marks = q.get("marks", 2)
            image_blocks = []
            for image_path in q.get("image_paths", []) or []:
                try:
                    image_uri = Path(image_path).resolve().as_uri()
                    image_blocks.append(
                        f'<img class="question-image" src="{image_uri}" alt="صورة السؤال">'
                    )
                except Exception:
                    continue
            images_html = "".join(image_blocks)
            if qtype == "mcq":
                ch_html = []
                for c in (q.get("choices") or []):
                    label = str(c.get("choice_code", "")).replace("&", "&amp;")
                    txt = str(c.get("text", "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                    ch_html.append(
                        f'<div style="padding:4px 8px"><span style="font-weight:700">({label})</span>&nbsp;&nbsp;{txt}</div>'
                    )
                choices_block = "".join(ch_html) if ch_html else ""
                body_rows.append(
                    f'''<div class="q">
  <div class="qhead"><span class="qnum">{qi}.</span><span class="qtxt">{q_text}</span><span class="qmark">[{marks} {L["marks"]}]</span></div>
    {images_html}
  <div class="choices">{choices_block}</div>
</div>'''
                )
            elif qtype == "true_false":
                t = L["true"]; f = L["false"]
                body_rows.append(
                    f'''<div class="q">
  <div class="qhead"><span class="qnum">{qi}.</span><span class="qtxt">{q_text}</span><span class="qmark">[{marks} {L["marks"]}]</span></div>
    {images_html}
  <div class="tf"><span>(  ) {t}</span>&nbsp;&nbsp;&nbsp;<span>(  ) {f}</span></div>
</div>'''
                )
            else:
                body_rows.append(
                    f'''<div class="q">
  <div class="qhead"><span class="qnum">{qi}.</span><span class="qtxt">{q_text}</span><span class="qmark">[{marks} {L["marks"]}]</span></div>
    {images_html}
  <div class="anslabel">{L["answer_space"]}:</div>
  <div class="ansbox"></div><div class="ansbox"></div><div class="ansbox"></div>
</div>'''
                )
        inst = (str(exam_data.get("instructions", "")) or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
        if not inst:
            inst = ("- اجب على جميع الأسئلة.<br>- لا تنسَ كتابة اسمك والمجموعة ورقم النموذج في الأعلا." if rtl
                    else "- Answer all questions.<br>- Don't forget to write your name, group and model number above.")
        subject = str(exam_data.get("subject", ""))
        duration = str(exam_data.get("duration", ""))
        exam_title = str(exam_data.get("name", exam_name))
        pieces.append(
            f'''<section class="{paper_class}">
  <div class="header">
    <div>
      <div class="tname">{L["teacher"]}: {str(exam_data.get("teacher_name", "")) or "ExamForge"}</div>
      <div class="tsub">{subject}</div>
    </div>
    <div class="htitle">
      <div class="examt">{exam_title}</div>
      <div class="meta">
        {L["model"]}: <b>{code}</b> &nbsp;•&nbsp; {L["duration"]}: <b>{duration}</b>
      </div>
    </div>
    <div class="hinfo">
      <input class="line" placeholder="{L["student"]} ...">
      <input class="line" placeholder="{L["group"]} ...">
    </div>
  </div>
  <hr class="sep">
  <div class="instructions">
    <div class="instrTitle">⚠ {L["instructions"]}</div>
    <div>{inst}</div>
  </div>
  <div class="qtitle">❖ {L["questions"]}</div>
  {''.join(body_rows)}
  <div class="footer">ExamForge &nbsp;•&nbsp; مع أطيب تمنياتنا بالتفوق والنجاح</div>
</section>
{"<div style='page-break-before:always'></div>" if idx < len(questions_per_model)-1 else ""}
'''
        )

    # The two economical templates are intentionally monochrome.  This needs to
    # be applied to the printable HTML too (not only to the in-app preview).
    layout_type = (template or {}).get("layout_type")
    is_simple = layout_type in {"simple_first", "simple_last"}
    css = r'''
@page { size: A4; margin: 18mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: 'Segoe UI', 'Noto Sans Arabic', Tahoma, Arial, sans-serif; color: #0F172A; background: #F1F5F9; }
.toolbar { position: sticky; top: 0; z-index: 10; background: #1E293B; padding: 14px 24px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #334155; }
.toolbar h2 { margin: 0; font-size: 15px; color: #E2E8F0; flex: 1; }
.btn { border: 0; border-radius: 8px; padding: 9px 18px; cursor: pointer; font-weight: 700; font-size: 13px; }
.btn-primary { background: #2563EB; color: #fff; }
.btn-primary:hover { background: #1D4ED8; }
.btn-ghost { background: #334155; color: #E2E8F0; }
.btn-ghost:hover { background: #475569; }

.paper { background: #FFFFFF; width: 210mm; margin: 20px auto 40px; padding: 16mm 14mm; box-shadow: 0 10px 25px rgba(2,6,23,0.15); border-radius: 6px; }

.header { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 14px; align-items: center; }
.tname { font-weight: 700; font-size: 13px; }
.tsub  { font-size: 11px; color: #475569; }
.htitle { text-align: center; }
.examt  { font-size: 20px; font-weight: 800; color: #1D4ED8; }
.meta   { margin-top: 6px; background: #1D4ED8; color: #fff; display: inline-block; padding: 4px 14px; border-radius: 6px; font-size: 12px; }
.hinfo .line { display:block; width: 100%; border: 0; border-bottom: 1px solid #334155; padding: 4px 2px; margin: 8px 0; background: transparent; font-size: 12px; text-align: right; }

.sep { border: 0; border-top: 3px solid #1D4ED8; margin: 12px 0 14px; }

.instructions { background: #EFF6FF; border: 1px solid #BFDBFE; padding: 10px 14px; border-radius: 6px; font-size: 12px; line-height: 1.8; margin-bottom: 14px; }
.instrTitle { font-weight: 800; color: #1E40AF; margin-bottom: 4px; }

.qtitle { font-weight: 800; font-size: 16px; color: #1E293B; margin: 6px 0 12px; }

.q { border-left: 3px solid #1D4ED8; background: #F8FAFC; padding: 10px 12px; margin-bottom: 12px; border-radius: 4px; }
[dir="rtl"] .q { border-left: 0; border-right: 3px solid #1D4ED8; }

.qhead { display: flex; gap: 8px; align-items: flex-start; }
.qnum  { font-weight: 900; min-width: 24px; }
.qtxt  { flex: 1; font-weight: 700; font-size: 13.5px; line-height: 1.9; }
.qmark { font-weight: 800; color: #0369A1; font-size: 12px; white-space: nowrap; }
.question-image { display: block; max-width: 320px; max-height: 120px; margin: 8px auto; object-fit: contain; clear: both; border-radius: 4px; }

.choices { margin-top: 6px; padding-right: 32px; line-height: 2; font-size: 13px; }
[dir="ltr"] .choices { padding-right: 0; padding-left: 32px; }

.tf { margin-top: 8px; padding-right: 32px; font-weight: 600; }
[dir="ltr"] .tf { padding-right: 0; padding-left: 32px; }

.anslabel { font-weight: 700; color: #334155; margin: 8px 0 4px; }
.ansbox { height: 42px; border-bottom: 1px dashed #94A3B8; margin-bottom: 6px; }

.footer { margin-top: 24px; text-align: center; color: #64748B; font-size: 11px; border-top: 1px solid #CBD5E1; padding-top: 10px; }

@media print {
  body { background: #fff; }
  .toolbar { display: none !important; }
  .paper { box-shadow: none !important; margin: 0 auto !important; width: auto; }
}
'''
    if is_simple:
        css += r'''
html, body { color: #000; background: #fff; }
.paper { box-shadow: none; border-radius: 0; padding: 14mm 12mm; }
.examt, .qtitle, .qmark, .anslabel { color: #000; }
.meta { color: #000; background: transparent; padding: 0; border-radius: 0; }
.sep { border-top: 1px solid #000; }
.instructions { background: #fff; border: 1px solid #000; border-radius: 0; }
.instrTitle { color: #000; }
.q { background: #fff; border: 1px solid #000; border-left: 0; border-radius: 0; }
[dir="rtl"] .q { border-right: 0; }
.footer { color: #000; border-color: #000; }
'''
    if layout_type == "ministry":
        css += r'''
.paper { border: 4px double #000; }
'''
    if official_layout:
        css += r'''
.official-paper { border: 2px solid #000; }
.official-paper .header { grid-template-columns: 1fr 1.25fr 1fr; }
.official-paper .tname, .official-paper .tsub { color: #000; font-family: "Times New Roman", serif; }
.official-paper .examt { font-family: "Times New Roman", serif; font-size: 18px; border-bottom: 1px solid #000; padding-bottom: 5px; }
.official-paper .hinfo .line { border-color: #000; }
.official-paper .instructions { border-top: 0; }
.official-paper .q { display: grid; grid-template-columns: 1fr; margin: 0; border-bottom: 0; }
.official-paper .qhead { border-bottom: 1px solid #000; padding-bottom: 5px; }
.official-paper .choices { display: grid; grid-template-columns: repeat(4, 1fr); padding: 0; margin: 0; }
.official-paper .choices > div { border-left: 1px solid #000; padding: 5px 7px !important; text-align: center; }
[dir="rtl"] .official-paper .choices > div { border-left: 0; border-right: 1px solid #000; }
'''
    wrapper_html = f"""<!doctype html>
<html {dir_attr}>
<head>
<meta charset="utf-8">
<title>ExamForge Print — {safe_name}</title>
<style>
{css}
</style>
</head>
<body>
<div class="toolbar">
  <h2>🖨️  {L['title']} — {safe_name}</h2>
  <button class="btn btn-ghost" onclick="history.back()">← رجوع</button>
  <button class="btn btn-primary" onclick="window.print()">🖨️  طباعة (Ctrl+P)</button>
</div>
{''.join(pieces)}
<script>
  window.addEventListener('load', function(){{
    setTimeout(function(){{ window.print(); }}, 900);
  }});
</script>
</body>
</html>
"""
    try:
        wrapper = Path(tempfile.gettempdir()) / f"ef_print_doc_{safe_name}.html"
        wrapper.write_text(wrapper_html, encoding="utf-8")
        webbrowser.open(wrapper.resolve().as_uri())
        # Also save to output dir so teacher has a copy
        try:
            copy_out = Path(output_paths.get("output_dir")) / f"{safe_name}_PrintPreview.html"
            copy_out.write_text(wrapper_html, encoding="utf-8")
        except Exception:
            pass
        return True
    except Exception:
        return False


def build_and_open_html_answer_key_preview(
    exam_name: str,
    exam_data: Dict[str, Any],
    answer_keys: Dict[str, List[Dict[str, Any]]],
    language: str = "ar",
) -> bool:
    """Open a printable answer-key preview with a separate section per model."""
    safe_name = _sanitize_filename(exam_name)
    rtl = language != "en"
    direction = "rtl" if rtl else "ltr"
    teacher = str(exam_data.get("teacher_name", "ExamForge"))
    sections = []
    for model_code, answers in answer_keys.items():
        rows = []
        for item in answers:
            answer = item.get("answer") or "-"
            answer_text = item.get("answer_text") or item.get("model_answer") or "-"
            rows.append(
                f"<tr><td>{item.get('number', '')}</td><td>{item.get('question_type', '')}</td>"
                f"<td><strong>{answer}</strong></td><td>{answer_text}</td></tr>"
            )
        sections.append(
            f"<section class='key'><h2>نموذج الإجابة - النموذج ({model_code})</h2>"
            f"<table><thead><tr><th>السؤال</th><th>النوع</th><th>الإجابة</th><th>التفاصيل</th></tr></thead>"
            f"<tbody>{''.join(rows)}</tbody></table></section>"
        )
    html = f"""<!doctype html>
<html dir="{direction}" lang="{'ar' if rtl else 'en'}">
<head><meta charset="utf-8"><title>نموذج إجابة - {safe_name}</title>
<style>
body{{font-family:'Segoe UI','Noto Sans Arabic',Arial,sans-serif;background:#f1f5f9;color:#0f172a;margin:0;padding:24px;}}
.toolbar{{position:sticky;top:0;background:#1e293b;color:white;padding:12px 16px;margin:-24px -24px 24px;display:flex;gap:12px;align-items:center;}}
.toolbar h1{{font-size:18px;flex:1;margin:0;}} button{{border:0;border-radius:6px;padding:9px 16px;cursor:pointer;font-weight:700;}}
.key{{background:white;max-width:1000px;margin:0 auto 24px;padding:24px;box-shadow:0 4px 16px #0001;page-break-after:always;}}
h2{{margin-top:0;color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:8px;}}
table{{width:100%;border-collapse:collapse;}} th,td{{border:1px solid #cbd5e1;padding:9px;text-align:{'right' if rtl else 'left'};vertical-align:top;}} th{{background:#eff6ff;}}
@media print{{body{{background:white;padding:0;}}.toolbar{{display:none;}}.key{{box-shadow:none;margin:0;}}}}
</style></head><body>
<div class="toolbar"><h1>نموذج إجابة: {safe_name} - {teacher}</h1><button onclick="window.print()">طباعة</button></div>
{''.join(sections)}
</body></html>"""
    try:
        wrapper = Path(tempfile.gettempdir()) / f"ef_answer_key_{safe_name}.html"
        wrapper.write_text(html, encoding="utf-8")
        webbrowser.open(wrapper.resolve().as_uri())
        return True
    except Exception:
        return False
