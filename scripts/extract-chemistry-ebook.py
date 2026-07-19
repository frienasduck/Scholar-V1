"""Build Scholar's versioned Chemistry Part 1 reader data.

The reconstructed PDF is the source of printed/selectable text. The original
scan is retained separately and is never used as an answer key.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

BOOK_ID = "class11-chemistry-part1"
VERSION = 1


def clean_text(value: str) -> str:
    value = value.replace("\x00", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def chapter_for(text_page: int) -> tuple[str, str]:
    if text_page >= 38:
        return "structure-of-atom", "Structure of Atom"
    return "some-basic-concepts-of-chemistry", "Some Basic Concepts of Chemistry"


def build_clean_to_scan(raw_pages: list[str]) -> dict[int, int]:
    mapping: dict[int, int] = {1: 1}
    current = 1
    for text_page, raw in enumerate(raw_pages[1:], 2):
        printed = re.findall(r"\bPage\s+(\d+)\b", raw, re.I)
        if printed:
            candidate = int(printed[-1])
            # The source contains one OCR typo (Page 10 where Page 3 is meant).
            # Printed pagination otherwise advances monotonically by one.
            if candidate > current + 2 or candidate < current:
                candidate = min(60, current + 1)
            current = candidate
        mapping[text_page] = current
    return mapping


def section_type(text: str) -> str:
    low = text.lower().strip()
    if low.startswith("board question"):
        return "classwork"
    if low.startswith("homework"):
        return "homework"
    if low.startswith("try yourself"):
        return "try-yourself"
    if low.startswith("keep it in mind"):
        return "note"
    if low.startswith("space for keynote"):
        return "keynote-space"
    if low.startswith("example"):
        return "example"
    if "[figure]" in low or low.startswith("figure"):
        return "diagram"
    if re.search(r"\b(?:is defined as|may be defined as|is called|states that)\b", low):
        return "definition"
    if ("=" in text or "→" in text) and len(text) < 220:
        return "formula"
    if len(text) < 105 and not text.endswith((".", ":", ";", "?")):
        return "subheading"
    return "paragraph"


def page_sections(raw: str, text_page: int, source_page: int) -> list[dict]:
    chunks = [re.sub(r"\s*\n\s*", " ", block).strip() for block in re.split(r"\n\s*\n", raw)]
    if len(chunks) < 3:
        chunks = [line.strip() for line in raw.splitlines() if line.strip()]
    chapter_id, _ = chapter_for(text_page)
    return [
        {
            "id": f"{BOOK_ID}-{chapter_id}-p{text_page:02d}-s{order:03d}",
            "type": section_type(chunk),
            "text": chunk,
            "sourcePage": source_page,
            "order": order,
        }
        for order, chunk in enumerate((chunk for chunk in chunks if chunk), 1)
    ]


def classify_question(prompt: str) -> str:
    low = prompt.lower()
    if re.search(r"\([a-d]\).+\([a-d]\).+\([a-d]\).+\([a-d]\)", prompt, re.I | re.S):
        return "mcq"
    if re.search(r"\b(?:calculate|find|determine|mass|moles?|wavelength|energy|radius)\b", low):
        return "numerical"
    if "draw" in low or "diagram" in low or "figure" in low:
        return "diagram"
    if "explain" in low or "write the postulates" in low:
        return "long-answer"
    return "short-answer"


def options_for(prompt: str) -> list[str] | None:
    matches = re.findall(r"\(([A-D])\)\s*(.*?)(?=\s*\([A-D]\)|$)", prompt, re.I | re.S)
    if len(matches) != 4:
        return None
    return [f"{letter.upper()}. {re.sub(r'\s+', ' ', value).strip()}" for letter, value in matches]


def extract_questions(pages: list[dict]) -> list[dict]:
    questions: list[dict] = []
    seen: set[str] = set()
    marker = re.compile(r"\b(BOARD QUESTION|TRY YOURSELF)\b\s*:?(?:\s*(\d{1,2})[.)])?", re.I)
    for page in pages:
        text = page["rawText"]
        matches = list(marker.finditer(text))
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            prompt = text[match.end():end]
            prompt = re.split(r"\b(?:Answer\s*:|Space For Keynotes|HOMEWORK)\b", prompt, 1, flags=re.I)[0]
            prompt = re.sub(r"^\s*(\d{1,2})[.)]\s*", "", prompt)
            prompt = re.sub(r"\s+", " ", prompt).strip(" -:\n")
            if len(prompt) < 12:
                continue
            digest = hashlib.sha1(prompt.lower().encode("utf-8")).hexdigest()[:10]
            if digest in seen:
                continue
            seen.add(digest)
            section = "classwork" if match.group(1).lower().startswith("board") else "try-yourself"
            number = match.group(2) or str(sum(q["textPage"] == page["textPdfPageNumber"] and q["section"] == section for q in questions) + 1)
            q_type = classify_question(prompt)
            entry = {
                "id": f"{BOOK_ID}-{page['chapterId']}-{section}-{page['textPdfPageNumber']}-{number}-{digest[:5]}",
                "bookId": BOOK_ID,
                "scholarClass": 11,
                "subject": "Chemistry",
                "chapterId": page["chapterId"],
                "chapterTitle": page["chapterTitle"],
                "sourcePage": page["originalPageNumber"],
                "textPage": page["textPdfPageNumber"],
                "section": section,
                "questionNumber": str(number),
                "questionType": q_type,
                "prompt": prompt,
                "sourceLabel": "NCERT" if "NCERT" in prompt else None,
                "difficulty": "medium" if q_type in {"numerical", "diagram"} else "easy",
                "topicTags": [page["chapterTitle"], "printed-book-question"],
            }
            options = options_for(prompt)
            if options:
                entry["options"] = options
            questions.append(entry)
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    reader = PdfReader(str(args.source))
    raw_pages = [clean_text(page.extract_text() or "") for page in reader.pages]
    clean_to_scan = build_clean_to_scan(raw_pages)
    pages = []
    for text_page, raw in enumerate(raw_pages, 1):
        source_page = clean_to_scan[text_page]
        chapter_id, chapter_title = chapter_for(text_page)
        sections = page_sections(raw, text_page, source_page)
        day_match = re.search(r"\bDAY\s*0?(\d+)\b", raw, re.I)
        pages.append({
            "id": f"{BOOK_ID}-page-{text_page:02d}",
            "bookId": BOOK_ID,
            "chapterId": chapter_id,
            "chapterTitle": chapter_title,
            "day": int(day_match.group(1)) if day_match else None,
            "originalPageNumber": source_page,
            "textPdfPageNumber": text_page,
            "mappedScannedPages": [source_page],
            "title": next((section["text"] for section in sections if section["type"] == "subheading"), chapter_title),
            "sections": sections,
            "rawText": raw,
        })

    questions = extract_questions(pages)
    for page in pages:
        ids = [question["id"] for question in questions if question["textPage"] == page["textPdfPageNumber"]]
        for section in page["sections"]:
            if section["type"] in {"classwork", "homework", "try-yourself"}:
                section["questionIds"] = ids

    page_map = []
    for scan_page in range(1, 61):
        candidates = [text_page for text_page, mapped in clean_to_scan.items() if mapped == scan_page]
        text_page = candidates[0] if candidates else min(clean_to_scan, key=lambda value: abs(clean_to_scan[value] - scan_page))
        page = pages[text_page - 1]
        page_map.append({
            "scannedPage": scan_page,
            "textPage": text_page,
            "chapterId": page["chapterId"],
            "sectionIds": [section["id"] for section in page["sections"]],
        })

    counts = {
        "totalPages": len(pages),
        "totalSections": sum(len(page["sections"]) for page in pages),
        "totalQuestions": len(questions),
        "classwork": sum(question["section"] == "classwork" for question in questions),
        "homework": sum(question["section"] == "homework" for question in questions),
        "tryYourself": sum(question["section"] == "try-yourself" for question in questions),
        "caseStudy": 0,
        "mcq": sum(question["questionType"] == "mcq" for question in questions),
        "nonMcq": sum(question["questionType"] != "mcq" for question in questions),
        "definitions": sum(section["type"] == "definition" for page in pages for section in page["sections"]),
        "formulas": sum(section["type"] == "formula" for page in pages for section in page["sections"]),
        "examples": sum(section["type"] == "example" for page in pages for section in page["sections"]),
    }
    record = {
        "dataVersion": VERSION,
        "book": {
            "id": BOOK_ID,
            "scholarClass": 11,
            "subject": "Chemistry",
            "title": "Chemistry Part 1",
            "chapters": ["Some Basic Concepts of Chemistry", "Structure of Atom"],
            "scannedPdfPath": "/content/ebooks/class11-chemistry-part1/original-scan.pdf",
            "textPdfPath": "/content/ebooks/class11-chemistry-part1/clean-text.pdf",
            "pageCountScanned": 60,
            "pageCountText": len(pages),
            "coverImage": "/content/ebooks/class11-chemistry-part1/clean-text.pdf#page=1",
            "version": VERSION,
        },
        "pageMap": page_map,
        "pages": pages,
        "questions": questions,
        "counts": counts,
        "uncertainExtractionItems": [
            "The reconstructed PDF reflows 60 printed pages across 80 PDF pages; page mapping follows printed page labels.",
            "Figure placeholders in the reconstructed source are preserved exactly and are not replaced with generated artwork.",
            "Question type and difficulty are heuristic; handwritten scan annotations are never treated as answers.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
