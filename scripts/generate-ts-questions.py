#!/usr/bin/env python3
"""
Generate a TypeScript file with the imported Physics PDF questions.
"""
import json

INPUT_FILE = "/home/z/my-project/scholar/scripts/physics-questions-clean.json"
OUTPUT_FILE = "/home/z/my-project/scholar/src/lib/physics-pdf-questions.ts"

def escape_ts_string(s):
    """Escape a string for TypeScript."""
    if not s:
        return ""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\t", "\\t")

def main():
    with open(INPUT_FILE) as f:
        data = json.load(f)
    
    questions = data["questions"]
    
    lines = []
    lines.append("// Class 11 Physics questions imported from PDF via OCR.")
    lines.append("// Source: phy pt1 (pt1)_merged (1)_compressed.pdf (96 pages)")
    lines.append("// These questions were extracted using Tesseract OCR and may contain OCR artifacts.")
    lines.append("// Users can review/edit them in the PDF Import Review mode.")
    lines.append("")
    lines.append('import type { PracticeQuestion } from "./question-bank";')
    lines.append("")
    lines.append(f"export const PHYSICS_PDF_QUESTIONS: PracticeQuestion[] = [")
    
    for i, q in enumerate(questions):
        # Generate a unique ID
        qid = f"pdf_p{q['page']}_q{q['qNum']}_{i+1}"
        
        # Determine subject
        subject = "physics"
        
        # Escape fields
        question = escape_ts_string(q["question"])
        options = q.get("options", [])
        answer = escape_ts_string(q.get("answer", ""))
        explanation = escape_ts_string(q.get("explanation", ""))
        
        # Build options array
        if options:
            opts_str = ", ".join([f'"{escape_ts_string(o)}"' for o in options])
            opts_line = f'options: [{opts_str}], '
        else:
            opts_line = ""
        
        # Determine answer index for MCQs
        answer_index = ""
        if q["type"] == "mcq" and options:
            # We don't know the answer yet — set to 0 as placeholder (needsReview will be true)
            answer_index = "answerIndex: 0, "
        
        # Type
        qtype = q["type"]
        
        lines.append(f'  {{')
        lines.append(f'    id: "{qid}",')
        lines.append(f'    number: {i+1},')
        lines.append(f'    chapter: "{escape_ts_string(q["chapter"])}",')
        lines.append(f'    subject: "{subject}",')
        lines.append(f'    type: "{qtype}",')
        lines.append(f'    question: "{question}",')
        if opts_line:
            lines.append(f'    {opts_line.strip()}')
        lines.append(f'    answer: "{answer if answer else "Review needed"}",')
        if answer_index:
            lines.append(f'    {answer_index.strip()}')
        lines.append(f'    explanation: "{explanation if explanation else "Imported from PDF page " + str(q["page"]) + ". OCR may contain artifacts. Please review."}",')
        lines.append(f'  }},')
    
    lines.append("];")
    lines.append("")
    
    # Also export chapter counts for quick reference
    by_chapter = {}
    for q in questions:
        ch = q["chapter"]
        by_chapter[ch] = by_chapter.get(ch, 0) + 1
    
    lines.append(f"export const PHYSICS_PDF_QUESTION_COUNTS = {json.dumps(by_chapter, indent=2)};")
    lines.append("")
    
    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(lines))
    
    print(f"Generated {len(questions)} questions in {OUTPUT_FILE}")
    print(f"By chapter: {json.dumps(by_chapter, indent=2)}")

if __name__ == "__main__":
    main()
