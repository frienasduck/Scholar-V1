#!/usr/bin/env python3
"""
Clean and filter the raw OCR-extracted Physics questions.
Removes false positives, cleans OCR artifacts, and produces a final importable JSON.
"""
import json
import re

INPUT_FILE = "/home/z/my-project/scholar/scripts/physics-questions-raw.json"
OUTPUT_FILE = "/home/z/my-project/scholar/scripts/physics-questions-clean.json"

def clean_text(text):
    """Clean OCR artifacts from text."""
    if not text:
        return ""
    # Remove excessive whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    # Remove common OCR garbage prefixes
    text = re.sub(r'^[>\*\-—\|]+\s*', '', text)
    # Fix common OCR issues
    text = text.replace('|', 'l').replace('—', '-')
    # Remove standalone symbols
    text = re.sub(r'\b[—–]\b', '', text)
    # Clean up spacing around punctuation
    text = re.sub(r'\s+([,.;:!?])', r'\1', text)
    text = re.sub(r'([,.;:!?])([A-Za-z])', r'\1 \2', text)
    return text.strip()

def is_valid_question(q):
    """Check if a question is likely a real question (not a false positive)."""
    text = q.get("question", "").strip()
    
    # Too short — likely not a real question
    if len(text) < 20:
        return False
    
    # Just a list of items (like "Length 2. Mass 3. Temperature")
    if re.match(r'^[\w\s]+\d+\.\s+\w+\s+\d+\.\s+\w+', text) and len(text) < 60:
        return False
    
    # Just numbers or symbols
    if re.match(r'^[\d\s\.\)\(\-\+\/\*]+$', text):
        return False
    
    # Mostly garbage characters
    alpha_count = sum(1 for c in text if c.isalpha())
    if alpha_count < len(text) * 0.4:
        return False
    
    # Check for question-like content
    question_indicators = [
        "what", "which", "how", "why", "when", "where", "calculate", "find",
        "define", "derive", "explain", "state", "deduce", "convert", "determine",
        "show that", "prove", "obtain", "express", "compute", "identify",
        "name", "list", "give", "write", "draw", "describe", "compare",
        "difference", "relation", "formula", "equation", "unit", "dimension",
        "error", "significant", "vernier", "screw gauge", "velocity",
        "acceleration", "displacement", "speed", "motion", "graph",
        "distance", "time", "position", "freely", "fall", "projectile",
        "retardation", "uniform", "non-uniform", "average", "instantaneous",
        "slope", "area under", "kinematic", "stopping", "reaction time",
    ]
    text_lower = text.lower()
    has_indicator = any(ind in text_lower for ind in question_indicators)
    
    # Also accept if it's from a known question section
    section = q.get("section", "")
    if section in ("board", "try_yourself", "ncert", "case_study"):
        return True
    
    # Or if it has MCQ options
    if q.get("type") == "mcq" and len(q.get("options", [])) >= 2:
        # Validate options aren't empty
        valid_opts = [o for o in q["options"] if o and len(o.strip()) > 1]
        if len(valid_opts) >= 2:
            return True
    
    # Or if it's long enough and has question indicators
    if has_indicator and len(text) > 25:
        return True
    
    return False

def clean_options(options):
    """Clean MCQ options."""
    cleaned = []
    for opt in options:
        opt = clean_text(opt)
        if opt and len(opt) > 1:
            cleaned.append(opt)
    return cleaned

def main():
    with open(INPUT_FILE) as f:
        data = json.load(f)
    
    raw_questions = data["questions"]
    print(f"Raw questions: {len(raw_questions)}")
    
    # Filter and clean
    clean_questions = []
    for q in raw_questions:
        q["question"] = clean_text(q["question"])
        q["options"] = clean_options(q.get("options", []))
        
        if is_valid_question(q):
            # Re-validate MCQ after cleaning
            if q["type"] == "mcq" and len(q["options"]) < 2:
                q["type"] = "subjective"
                q["options"] = []
            
            # Assign difficulty based on section and type
            if q["section"] == "board":
                q["difficulty"] = "medium"
            elif q["section"] == "try_yourself":
                q["difficulty"] = "easy"
            elif q["section"] == "case_study":
                q["difficulty"] = "hard"
            else:
                q["difficulty"] = "medium"
            
            # Assign marks based on type
            if q["type"] == "mcq":
                q["marks"] = 1
            elif q["section"] == "board":
                q["marks"] = 3
            else:
                q["marks"] = 2
            
            clean_questions.append(q)
    
    print(f"Clean questions: {len(clean_questions)}")
    
    # Summary by chapter and type
    by_chapter = {}
    by_type = {}
    by_difficulty = {}
    for q in clean_questions:
        ch = q["chapter"]
        by_chapter[ch] = by_chapter.get(ch, 0) + 1
        t = q["type"]
        by_type[t] = by_type.get(t, 0) + 1
        d = q.get("difficulty", "medium")
        by_difficulty[d] = by_difficulty.get(d, 0) + 1
    
    print(f"\nBy chapter: {json.dumps(by_chapter, indent=2)}")
    print(f"\nBy type: {json.dumps(by_type, indent=2)}")
    print(f"\nBy difficulty: {json.dumps(by_difficulty, indent=2)}")
    
    # Save
    output = {
        "summary": {
            "totalRaw": len(raw_questions),
            "totalClean": len(clean_questions),
            "byChapter": by_chapter,
            "byType": by_type,
            "byDifficulty": by_difficulty,
        },
        "questions": clean_questions,
    }
    
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\nClean output saved to: {OUTPUT_FILE}")
    
    # Print sample questions per chapter
    print("\n=== SAMPLE QUESTIONS ===")
    for chapter in by_chapter:
        print(f"\n--- {chapter} ---")
        chapter_qs = [q for q in clean_questions if q["chapter"] == chapter]
        for q in chapter_qs[:3]:
            print(f"  Q{q['qNum']} (p{q['page']}, {q['type']}): {q['question'][:100]}...")
            if q.get("options"):
                for i, opt in enumerate(q["options"][:4]):
                    print(f"    {i+1}) {opt[:60]}")

if __name__ == "__main__":
    main()
