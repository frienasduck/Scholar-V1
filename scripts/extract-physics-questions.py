#!/usr/bin/env python3
"""
Extract Physics questions from the 96 pre-rendered ebook page PNGs using Tesseract OCR.
Identifies MCQs, subjective questions, and case-study questions.
Outputs a JSON file with all extracted questions for review/import.
"""
import subprocess
import json
import re
import os
import sys
from pathlib import Path

PAGES_DIR = "/home/z/my-project/scholar/public/ebook-pages"
OUTPUT_FILE = "/home/z/my-project/scholar/scripts/physics-questions-raw.json"
TOTAL_PAGES = 96

# Chapter boundaries (based on OCR inspection)
# Pages 1-29: Units and Measurement (chapter "p2")
# Pages 30-96: Motion in a Straight Line / Motion in a Plane (chapter "p3" / "p4")
# We'll assign chapter based on page number, refine by content keywords
def infer_chapter(page_num, text):
    if page_num <= 29:
        return "Units and Measurement"
    # Check for Motion in a Plane keywords (vectors, 2D, projectile)
    text_lower = text.lower()
    if any(k in text_lower for k in ["projectile", "vector addition", "parallelogram law", "resolution of vector", "cross product", "dot product", "relative velocity"]):
        if page_num >= 60:
            return "Motion in a Plane"
    return "Motion in a Straight Line"

def ocr_page(page_num):
    """Run Tesseract OCR on a single page."""
    img_path = os.path.join(PAGES_DIR, f"page-{str(page_num).padStart(3, '0') if False else str(page_num).zfill(3)}.png")
    if not os.path.exists(img_path):
        return ""
    try:
        result = subprocess.run(
            ["tesseract", img_path, "-", "--psm", "3"],
            capture_output=True, text=True, timeout=30
        )
        return result.stdout.strip()
    except Exception as e:
        print(f"  OCR failed for page {page_num}: {e}", file=sys.stderr)
        return ""

def extract_questions_from_text(text, page_num, chapter):
    """
    Extract questions from OCR text.
    Looks for:
    - Numbered MCQs: "97. ... 1) ... 2) ... 3) ... 4) ..."
    - "TRY YOURSELF" / "BOARD QUESTION" sections
    - Case study questions
    """
    questions = []
    lines = text.split("\n")
    
    # Join lines that are part of the same question
    # MCQ pattern: number followed by question text, then 4 options with 1) 2) 3) 4)
    # Also handle: Q1., Q.1, 1., 01., etc.
    
    current_section = "general"
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Detect section headers
        if "TRY YOUR" in line.upper() or "TRY YOURSELF" in line.upper():
            current_section = "try_yourself"
            i += 1
            continue
        if "BOARD QUESTION" in line.upper():
            current_section = "board"
            i += 1
            continue
        if "NCERT" in line.upper() and ("EXERCISE" in line.upper() or "QUESTION" in line.upper()):
            current_section = "ncert"
            i += 1
            continue
        if "CASE STUDY" in line.upper() or "ASSERTION" in line.upper() or "REASON" in line.upper():
            current_section = "case_study"
            i += 1
            continue
        
        # Try to match MCQ: starts with a number followed by "." or ")"
        # Pattern: "97. Which of the following..." or "Q97. ..." or "97) ..."
        mcq_match = re.match(r'^(?:Q\.?\s*)?(\d{1,3})[.)\]]\s+(.{5,})', line, re.IGNORECASE)
        if mcq_match:
            q_num = int(mcq_match.group(1))
            q_text = mcq_match.group(2)
            
            # Look ahead for options (1) 2) 3) 4) pattern) and continuation
            options = []
            full_text = q_text
            j = i + 1
            option_pattern = re.compile(r'^([1-4])[.)\]]\s+(.{2,})')
            look_ahead = 0
            
            while j < len(lines) and look_ahead < 12:
                next_line = lines[j].strip()
                if not next_line:
                    j += 1
                    look_ahead += 1
                    continue
                
                opt_match = option_pattern.match(next_line)
                if opt_match:
                    opt_num = int(opt_match.group(1))
                    opt_text = opt_match.group(2)
                    # Check if this is a continuation of previous option or new option
                    if len(options) < opt_num:
                        while len(options) < opt_num - 1:
                            options.append("")
                        options.append(opt_text)
                    elif len(options) == opt_num - 1:
                        options.append(opt_text)
                    else:
                        # Continuation of existing option
                        if opt_num - 1 < len(options):
                            options[opt_num - 1] += " " + opt_text
                    j += 1
                    look_ahead += 1
                    continue
                
                # Check if it's the next question
                next_mcq = re.match(r'^(?:Q\.?\s*)?(\d{1,3})[.)\]]\s+', next_line, re.IGNORECASE)
                if next_mcq and not option_pattern.match(next_line):
                    break
                
                # Continuation of question text or last option
                if len(options) == 0:
                    full_text += " " + next_line
                elif len(options) > 0:
                    options[-1] += " " + next_line
                
                j += 1
                look_ahead += 1
            
            # Only save if we found at least 2 options (valid MCQ) or it's a long subjective question
            if len(options) >= 2:
                questions.append({
                    "page": page_num,
                    "chapter": chapter,
                    "section": current_section,
                    "qNum": q_num,
                    "type": "mcq",
                    "question": full_text.strip(),
                    "options": options[:4],  # Keep max 4
                    "answer": "",
                    "explanation": "",
                    "source": f"Physics PDF Page {page_num}",
                    "needsReview": True,
                })
                i = j
                continue
            elif len(full_text) > 15 and current_section in ("board", "ncert", "try_yourself", "case_study"):
                # Subjective question
                questions.append({
                    "page": page_num,
                    "chapter": chapter,
                    "section": current_section,
                    "qNum": q_num,
                    "type": "subjective",
                    "question": full_text.strip(),
                    "options": [],
                    "answer": "",
                    "explanation": "",
                    "source": f"Physics PDF Page {page_num}",
                    "needsReview": True,
                })
                i = j
                continue
        
        i += 1
    
    return questions


def main():
    all_questions = []
    pages_scanned = 0
    pages_with_questions = 0
    failed_pages = []
    
    print(f"Starting OCR extraction on {TOTAL_PAGES} pages...")
    
    for page_num in range(1, TOTAL_PAGES + 1):
        if page_num % 10 == 0:
            print(f"  Processing page {page_num}/{TOTAL_PAGES}...")
        
        text = ocr_page(page_num)
        if not text:
            failed_pages.append(page_num)
            continue
        
        pages_scanned += 1
        chapter = infer_chapter(page_num, text)
        questions = extract_questions_from_text(text, page_num, chapter)
        
        if questions:
            pages_with_questions += 1
            all_questions.extend(questions)
            print(f"    Page {page_num}: {len(questions)} questions found ({chapter})")
    
    # Summary
    print("\n" + "=" * 60)
    print("EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"Total pages: {TOTAL_PAGES}")
    print(f"Pages scanned: {pages_scanned}")
    print(f"Pages with questions: {pages_with_questions}")
    print(f"Pages failed: {len(failed_pages)} {failed_pages[:10]}")
    print(f"Total questions extracted: {len(all_questions)}")
    
    # Count by chapter
    by_chapter = {}
    for q in all_questions:
        ch = q["chapter"]
        by_chapter[ch] = by_chapter.get(ch, 0) + 1
    print("\nBy chapter:")
    for ch, count in sorted(by_chapter.items()):
        print(f"  {ch}: {count}")
    
    # Count by type
    by_type = {}
    for q in all_questions:
        t = q["type"]
        by_type[t] = by_type.get(t, 0) + 1
    print("\nBy type:")
    for t, count in sorted(by_type.items()):
        print(f"  {t}: {count}")
    
    # Count by section
    by_section = {}
    for q in all_questions:
        s = q["section"]
        by_section[s] = by_section.get(s, 0) + 1
    print("\nBy section:")
    for s, count in sorted(by_section.items()):
        print(f"  {s}: {count}")
    
    # Save output
    output = {
        "summary": {
            "totalPages": TOTAL_PAGES,
            "pagesScanned": pages_scanned,
            "pagesWithQuestions": pages_with_questions,
            "pagesFailed": failed_pages,
            "totalQuestions": len(all_questions),
            "byChapter": by_chapter,
            "byType": by_type,
            "bySection": by_section,
        },
        "questions": all_questions,
    }
    
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\nOutput saved to: {OUTPUT_FILE}")
    print(f"Questions needing review: {len(all_questions)}")


if __name__ == "__main__":
    main()
