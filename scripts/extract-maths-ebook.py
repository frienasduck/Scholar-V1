"""Build the versioned Scholar clean-text data for Mathematics Part 1.

The source PDF is authoritative for printed text. The handwritten scanned copy is
kept separately and is never used to populate answers or clean content.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from pypdf import PdfReader

BOOK_ID = "class11-maths-part1"
VERSION = 1


def clean_text(value: str) -> str:
    value = value.replace("\x00", "").replace("NCER T", "NCERT").replace("T ry", "Try")
    value = value.replace("F unction", "Function").replace("F ALSE", "FALSE")
    value = re.sub(r"Mathematics Practice Workbook(?: —)? Part 1\s*", "", value)
    value = re.sub(r"\n\s*\d{1,2}\s*$", "", value.strip())
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def chapter_for(page_number: int) -> tuple[str, str]:
    if page_number >= 17:
        return "relations-and-functions", "Relations and Functions"
    return "sets", "Sets"


def scanned_pages_for(text_page: int) -> list[int]:
    # The clean PDF has a generated contents page and reflows the first two and
    # final three printed scan pages. The middle pages retain their printed page.
    if text_page == 1:
        return [1]
    if text_page == 2:
        return [1, 2]
    if 3 <= text_page <= 34:
        return [text_page]
    return [35, 36, 37]


def section_type(line: str) -> str:
    low = line.lower().strip()
    if low.startswith("classwork"):
        return "classwork"
    if low.startswith("homework"):
        return "homework"
    if low.startswith("try yourself"):
        return "try-yourself"
    if low.startswith("case study"):
        return "case-study"
    if low.startswith("note"):
        return "note"
    if low.startswith("example"):
        return "example"
    if re.search(r"\b(?:is called|is defined as|is said to be|is a well-defined)\b", low):
        return "definition"
    if "=" in line and len(line) < 180:
        return "formula"
    if low.startswith("space for keynote"):
        return "keynote-space"
    if len(line) < 90 and not line.endswith((".", ":", ";", "?")):
        return "subheading"
    return "paragraph"


def page_sections(text: str, page_number: int) -> list[dict]:
    chunks = [re.sub(r"\s*\n\s*", " ", part).strip() for part in re.split(r"\n\s*\n", text)]
    if len(chunks) <= 2:
        chunks = [line.strip() for line in text.splitlines() if line.strip()]
    chapter_id, _ = chapter_for(page_number)
    sections = []
    for order, chunk in enumerate((c for c in chunks if c), 1):
        sections.append({
            "id": f"{BOOK_ID}-{chapter_id}-p{page_number:02d}-s{order:03d}",
            "type": section_type(chunk),
            "text": chunk,
            "sourcePage": scanned_pages_for(page_number)[0],
            "order": order,
        })
    return sections


def classify_question(prompt: str) -> str:
    low = prompt.lower()
    if all(token in prompt for token in ("(A)", "(B)", "(C)", "(D)")):
        return "mcq"
    if "true or false" in low or "true/false" in low:
        return "true-false"
    if re.search(r"\(a\).*\(b\)|\(i\).*\(ii\)", low, re.S):
        return "multi-part"
    if "match" in low:
        return "match"
    if "graph" in low or "figure" in low:
        return "graph"
    if "prove" in low or "verify" in low:
        return "proof"
    if any(word in low for word in ("find", "calculate", "write", "determine")):
        return "numerical"
    return "short-answer"


def question_options(prompt: str) -> list[str] | None:
    matches = re.findall(r"\(([A-D])\)\s*(.*?)(?=\s*\([A-D]\)|$)", prompt, re.S)
    if len(matches) != 4:
        return None
    return [f"{letter}. {re.sub(r'\s+', ' ', value).strip()}" for letter, value in matches]


def page_for_offset(spans: list[tuple[int, int, int]], offset: int) -> int:
    for start, end, page in spans:
        if start <= offset < end:
            return page
    return spans[-1][2]


def extract_questions(pages: list[dict]) -> list[dict]:
    joined = ""
    spans: list[tuple[int, int, int]] = []
    for page in pages:
        start = len(joined)
        joined += f"\n\n[[PAGE:{page['textPdfPageNumber']}]]\n" + page["rawText"]
        spans.append((start, len(joined), page["textPdfPageNumber"]))

    marker = re.compile(r"\b(Classwork|Homework)\s+(\d+)\.|\bTry Yourself\s*(?:(\d+)\.)?", re.I)
    matches = list(marker.finditer(joined))
    questions: list[dict] = []
    counters = {"sets": 0, "relations-and-functions": 0}
    for index, match in enumerate(matches):
        label = (match.group(1) or "Try Yourself").lower()
        number = match.group(2) or match.group(3)
        if label == "try yourself" and not number:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(joined)
        structural = re.search(
            r"(?m)^\s*(?:DAY\s*\d+|Note\s*$|Example\s*$|Representation of a Set|Roster form|Set-Builder Form|"
            r"Types of Sets|Empty set|Finite Set|Equal Sets|Subsets|Power Set|Intervals|Venn Diagram|Union of Sets|"
            r"Intersection of Sets|Difference of Sets|Complement of a Set|Some Properties|Ordered Pair|Cartesian Product|"
            r"Relations\s*$|Arrow Diagram|Functions\s*$|Vertical Line Test|Some Functions|Identity Function|Constant Function|"
            r"Polynomial Function|Rational functions|The Modulus Function|Signum Function|Greatest Integer Function|"
            r"Domain and Range|Case Study|Space for Keynote)",
            joined[match.end():end],
            re.I,
        )
        if structural:
            end = match.end() + structural.start()
        prompt = re.sub(r"\[\[PAGE:\d+\]\]", " ", joined[match.end():end])
        prompt = re.sub(r"\s+", " ", prompt).strip()
        if not prompt:
            continue
        text_page = page_for_offset(spans, match.start())
        chapter_id, chapter_title = chapter_for(text_page)
        counters[chapter_id] += 1
        q_type = classify_question(prompt)
        options = question_options(prompt)
        source_page = scanned_pages_for(text_page)[0]
        entry = {
            "id": f"{BOOK_ID}-{chapter_id}-{label.replace(' ', '-')}-{number or counters[chapter_id]}",
            "bookId": BOOK_ID,
            "scholarClass": 11,
            "subject": "Mathematics",
            "chapterId": chapter_id,
            "chapterTitle": chapter_title,
            "sourcePage": source_page,
            "textPage": text_page,
            "section": label.replace(" ", "-"),
            "questionNumber": str(number or counters[chapter_id]),
            "questionType": q_type,
            "prompt": prompt,
            "sourceLabel": "NCERT" if "NCERT" in prompt else None,
            "difficulty": "hard" if q_type in {"proof", "graph", "multi-part"} else "medium" if q_type in {"numerical", "match"} else "easy",
            "topicTags": [chapter_title, "printed-book-question"],
        }
        if options:
            entry["options"] = options
        questions.append(entry)

    # Numbered Try Yourself questions after a single heading are not repeated by
    # the PDF text layer. Extract both chapter blocks explicitly.
    for page_number, chapter_id, chapter_title, source_page in (
        (15, "sets", "Sets", 15),
        (35, "relations-and-functions", "Relations and Functions", 36),
    ):
        try_page = next(page for page in pages if page["textPdfPageNumber"] == page_number)
        try_block = try_page["rawText"].split("Try Yourself", 1)[-1].replace("Try Yourself", "")
        numbered = list(re.finditer(r"(?m)^\s*(\d+)\.\s+", try_block))
        for index, match in enumerate(numbered):
            number = match.group(1)
            if any(q["chapterId"] == chapter_id and q["section"] == "try-yourself" and q["questionNumber"] == number for q in questions):
                continue
            end = numbered[index + 1].start() if index + 1 < len(numbered) else len(try_block)
            prompt = re.sub(r"\s+", " ", try_block[match.end():end]).strip()
            if not prompt:
                continue
            q_type = classify_question(prompt)
            entry = {
                "id": f"{BOOK_ID}-{chapter_id}-try-yourself-{number}",
                "bookId": BOOK_ID,
                "scholarClass": 11,
                "subject": "Mathematics",
                "chapterId": chapter_id,
                "chapterTitle": chapter_title,
                "sourcePage": source_page,
                "textPage": page_number,
                "section": "try-yourself",
                "questionNumber": number,
                "questionType": q_type,
                "prompt": prompt,
                "sourceLabel": "NCERT" if "NCERT" in prompt else None,
                "difficulty": "hard" if q_type in {"proof", "graph", "multi-part"} else "medium",
                "topicTags": [chapter_title, "printed-book-question"],
            }
            options = question_options(prompt)
            if options:
                entry["options"] = options
            questions.append(entry)

    # Case-study questions are explicitly numbered under the Case Study heading.
    case_page = next(page for page in pages if page["textPdfPageNumber"] == 34)
    case_block = case_page["rawText"].split("Case Study", 1)[-1]
    case_matches = list(re.finditer(r"(?m)^\s*(?:I|[2-4])\.\s+", case_block))
    for index, match in enumerate(case_matches):
        number = re.match(r"\s*(I|[2-4])", match.group()).group(1)
        end = case_matches[index + 1].start() if index + 1 < len(case_matches) else len(case_block)
        prompt = re.sub(r"\s+", " ", case_block[match.end():end]).strip()
        if not prompt:
            continue
        questions.append({
            "id": f"{BOOK_ID}-relations-and-functions-case-study-{number.lower()}",
            "bookId": BOOK_ID,
            "scholarClass": 11,
            "subject": "Mathematics",
            "chapterId": "relations-and-functions",
            "chapterTitle": "Relations and Functions",
            "sourcePage": 35 if number == "I" else 36,
            "textPage": 34,
            "section": "case-study",
            "questionNumber": number,
            "questionType": classify_question(prompt),
            "prompt": prompt,
            "diagramRef": "/ebook-pages-maths/page-036.png" if "graph" in prompt.lower() or "figure" in prompt.lower() else None,
            "sourceLabel": "NCERT" if "NCERT" in prompt else None,
            "difficulty": "hard",
            "topicTags": ["Relations and Functions", "case-study", "printed-book-question"],
        })

    unique = {question["id"]: question for question in questions}

    # Verified printed MCQ answer key. These answers are derived from the clean
    # mathematical source, never from handwriting in the scanned copy.
    mcq_answers: dict[str, tuple[int | None, str]] = {
        f"{BOOK_ID}-sets-classwork-11": (1, "No natural number can be both less than 5 and greater than 7, so A is empty and n(A) = 0."),
        f"{BOOK_ID}-sets-classwork-14": (2, "A three-element set has 2^3 = 8 subsets."),
        f"{BOOK_ID}-sets-classwork-20": (0, "-4 is excluded and 5 is included, giving the interval (-4, 5]."),
        f"{BOOK_ID}-sets-classwork-21": (1, "Both endpoints of the open interval (6, 12) are excluded: 6 < x < 12."),
        f"{BOOK_ID}-sets-classwork-22": (2, "A universal set must contain every element appearing in A, B, and C; only option C does."),
        f"{BOOK_ID}-sets-classwork-24": (2, "When A is a subset of B, their union contains exactly the elements of B."),
        f"{BOOK_ID}-sets-classwork-28": (3, "Disjoint sets have no common element, so their intersection is the empty set."),
        f"{BOOK_ID}-sets-homework-6": (1, "Intersecting any set with the universal set returns the original set A."),
        f"{BOOK_ID}-sets-classwork-35": (2, "n(P union Q) = n(P) + n(Q - P) = 12 + 7 = 19."),
        f"{BOOK_ID}-sets-classwork-39": (1, "By De Morgan, (A intersection B')' = A' union B; unioning B intersection C adds nothing beyond B."),
        f"{BOOK_ID}-sets-homework-8": (2, "(X union Y)' is contained in X', so its intersection with X is empty."),
        f"{BOOK_ID}-sets-homework-9": (1, "A set and its complement have no common elements."),
        f"{BOOK_ID}-sets-try-yourself-6": (1, "The overlap of [-2, 5] and (2, 6] is (2, 5]."),
        f"{BOOK_ID}-sets-try-yourself-9": (3, "A union B equals A exactly when every element of B is already in A, i.e. B is a subset of A."),
        f"{BOOK_ID}-relations-and-functions-homework-6": (2, "A x B has 2 x 3 = 6 ordered pairs, and every relation is a subset of A x B; therefore there are 2^6 = 64 relations."),
        f"{BOOK_ID}-relations-and-functions-classwork-33": (None, "The printed graph has vertex (1, 1), but none of the printed options represents |x - 1| + 1. The source question has no matching option."),
        f"{BOOK_ID}-relations-and-functions-classwork-40": (4, "|x - 4|/(x - 4) is -1 for x < 4 and 1 for x > 4, so the range is {-1, 1}."),
        f"{BOOK_ID}-relations-and-functions-homework-10": (1, "f(0) = |0 - 2| = 2."),
        f"{BOOK_ID}-relations-and-functions-homework-12": (2, "The denominator x - 1 cannot be zero, so x cannot equal 1; the domain is R - {1}."),
    }
    option_overrides: dict[str, list[str]] = {
        f"{BOOK_ID}-sets-classwork-11": ["A. 1", "B. 0", "C. 2", "D. 3"],
        f"{BOOK_ID}-sets-classwork-39": ["A. A' union B union C", "B. A' union B", "C. A' union C'", "D. A' intersection B", "E. A' union C"],
        f"{BOOK_ID}-sets-homework-8": ["A. X", "B. Y", "C. empty set", "D. X intersection Y", "E. X union Y"],
        f"{BOOK_ID}-sets-try-yourself-9": ["A. A is empty", "B. A is not equal to B", "C. A is a subset of B", "D. B is a subset of A"],
        f"{BOOK_ID}-relations-and-functions-classwork-40": ["A. empty set", "B. R", "C. {1}", "D. {-1}", "E. {1, -1}"],
        f"{BOOK_ID}-relations-and-functions-homework-10": ["A. 0", "B. 2", "C. -2", "D. 1"],
    }
    prompt_overrides: dict[str, str] = {
        f"{BOOK_ID}-sets-classwork-11": "If A = {x : x is a natural number, x < 5 and x > 7}, then n(A) is",
        f"{BOOK_ID}-sets-classwork-21": "The set-builder form of the interval (6, 12) is",
        f"{BOOK_ID}-sets-try-yourself-9": "For two sets A and B, A union B = A if and only if",
        f"{BOOK_ID}-relations-and-functions-homework-10": "For f : R to R defined by f(x) = |x - 2|, the value of f(0) is",
    }
    # A long Try Yourself block contains several numbered questions and is not
    # itself an MCQ; the separately extracted question 6 and question 9 are.
    first_try = unique.get(f"{BOOK_ID}-sets-try-yourself-1")
    if first_try:
        first_try["questionType"] = "numerical"
        first_try.pop("options", None)
    for question_id, (correct, explanation) in mcq_answers.items():
        question = unique.get(question_id)
        if not question:
            continue
        question["questionType"] = "mcq"
        question["correctOption"] = correct
        question["answerExplanation"] = explanation
        if question_id in option_overrides:
            question["options"] = option_overrides[question_id]
        if question_id in prompt_overrides:
            question["prompt"] = prompt_overrides[question_id]
    return sorted(unique.values(), key=lambda q: (q["textPage"], q["section"], int(q["questionNumber"]) if q["questionNumber"].isdigit() else 0))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    reader = PdfReader(str(args.source))
    pages = []
    for page_number, pdf_page in enumerate(reader.pages, 1):
        raw = clean_text(pdf_page.extract_text() or "")
        chapter_id, chapter_title = chapter_for(page_number)
        day_match = re.search(r"DAY\s*0?(\d+)", raw, re.I)
        sections = page_sections(raw, page_number)
        pages.append({
            "id": f"{BOOK_ID}-page-{page_number:02d}",
            "bookId": BOOK_ID,
            "chapterId": chapter_id,
            "chapterTitle": chapter_title,
            "day": int(day_match.group(1)) if day_match else None,
            "originalPageNumber": scanned_pages_for(page_number)[0],
            "textPdfPageNumber": page_number,
            "mappedScannedPages": scanned_pages_for(page_number),
            "title": next((s["text"] for s in sections if s["type"] == "subheading"), chapter_title),
            "sections": sections,
            "rawText": raw,
        })

    questions = extract_questions(pages)
    for page in pages:
        ids = [q["id"] for q in questions if q["textPage"] == page["textPdfPageNumber"]]
        for section in page["sections"]:
            if section["type"] in {"classwork", "homework", "try-yourself", "case-study"}:
                section["questionIds"] = ids

    page_map = []
    for scanned in range(1, 38):
        text_page = 2 if scanned <= 2 else 35 if scanned >= 35 else scanned
        page = pages[text_page - 1]
        page_map.append({
            "scannedPage": scanned,
            "textPage": text_page,
            "chapterId": page["chapterId"],
            "sectionIds": [section["id"] for section in page["sections"]],
        })

    counts = {
        "totalPages": len(pages),
        "totalSections": sum(len(page["sections"]) for page in pages),
        "totalQuestions": len(questions),
        "classwork": sum(q["section"] == "classwork" for q in questions),
        "homework": sum(q["section"] == "homework" for q in questions),
        "tryYourself": sum(q["section"] == "try-yourself" for q in questions),
        "caseStudy": sum(q["section"] == "case-study" for q in questions),
        "mcq": sum(q["questionType"] == "mcq" for q in questions),
        "nonMcq": sum(q["questionType"] != "mcq" for q in questions),
        "definitions": sum(section["type"] == "definition" for page in pages for section in page["sections"]),
        "formulas": sum(section["type"] == "formula" for page in pages for section in page["sections"]),
        "examples": sum(section["type"] == "example" for page in pages for section in page["sections"]),
    }
    record = {
        "dataVersion": VERSION,
        "book": {
            "id": BOOK_ID,
            "scholarClass": 11,
            "subject": "Mathematics",
            "title": "Mathematics Part 1",
            "chapters": ["Sets", "Relations and Functions"],
            "scannedPdfPath": "/content/ebooks/class11-maths-part1/original-scan.pdf",
            "textPdfPath": "/content/ebooks/class11-maths-part1/clean-text.pdf",
            "pageCountScanned": 37,
            "pageCountText": len(pages),
            "coverImage": "/ebook-pages-maths/page-001.png",
            "version": VERSION,
        },
        "pageMap": page_map,
        "pages": pages,
        "questions": questions,
        "counts": counts,
        "uncertainExtractionItems": [
            "The clean PDF reflows scanned pages 1-2 into text page 2 and scanned pages 35-37 into text page 35.",
            "Graph-dependent questions retain a source-page image link; graph geometry is not inferred from handwritten annotations.",
            "Question difficulty is heuristic and can be edited without changing stable IDs.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(counts, indent=2))


if __name__ == "__main__":
    main()
