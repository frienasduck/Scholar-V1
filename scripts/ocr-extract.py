#!/usr/bin/env python3
"""OCR extract pages from scanned PDF and write to ebook-data.ts"""
import pdfplumber, subprocess, os, tempfile, re, json

PDF = '/home/z/my-project/upload/phy pt1 (pt1)_merged (1)_compressed.pdf'
OUT = '/home/z/my-project/scholar/src/lib/ebook-data.ts'
MAX_PAGES = 50  # First 50 pages to capture both chapters

def ocr_page(page, resolution=150):
    """OCR a single PDF page"""
    try:
        img = page.to_image(resolution=resolution)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
            img.save(tmp.name)
            r = subprocess.run(['tesseract', tmp.name, '-', '--psm', '3'],
                             capture_output=True, text=True, timeout=15)
            os.unlink(tmp.name)
            return r.stdout.strip()
    except Exception as e:
        return f"[OCR Error: {str(e)[:50]}]"

def escape_ts(text):
    """Escape text for TypeScript string literal"""
    text = text.replace('\\', '\\\\')
    text = text.replace('"', '\\"')
    text = text.replace('\n', '\\n')
    text = text.replace('\r', '')
    text = text.replace('\t', ' ')
    return text

print(f"OCR extracting {MAX_PAGES} pages...", flush=True)
pages = []
with pdfplumber.open(PDF) as pdf:
    total = min(MAX_PAGES, len(pdf.pages))
    for i in range(total):
        text = ocr_page(pdf.pages[i])
        pages.append({"page": i + 1, "text": text})
        print(f"  Page {i+1}/{total}: {len(text)} chars", flush=True)

# Detect chapter 2 start
ch2_start = None
for p in pages:
    if p["page"] > 8 and re.search(r'MOTION\s+IN\s+A\s+STRAIGHT', p["text"][:500], re.IGNORECASE):
        ch2_start = p["page"]
        break

print(f"\nChapter 2 detected at page: {ch2_start}")

ch1_pages = [p for p in pages if not ch2_start or p["page"] < ch2_start]
ch2_pages = [p for p in pages if ch2_start and p["page"] >= ch2_start]

print(f"Ch1: {len(ch1_pages)} pages, Ch2: {len(ch2_pages)} pages")

# Write TypeScript
lines = [
    '// E-Book Data — Class 11 Physics (OCR extracted from uploaded scanned PDF)',
    '// Chapters 1 & 2 only (Chapter 3 excluded per requirements)',
    '',
    'export interface EBookPage { page: number; text: string; }',
    'export interface EBookChapter {',
    '  id: string;',
    '  title: string;',
    '  order: number;',
    '  sourcePageStart: number;',
    '  sourcePageEnd: number;',
    '  pages: EBookPage[];',
    '}',
    '',
    'export const PHYSICS_EBOOK_CHAPTERS: EBookChapter[] = [',
]

# Chapter 1
if ch1_pages:
    lines.append(f'  {{')
    lines.append(f'    id: "eb_ch1",')
    lines.append(f'    title: "Units and Measurement",')
    lines.append(f'    order: 1,')
    lines.append(f'    sourcePageStart: {ch1_pages[0]["page"]},')
    lines.append(f'    sourcePageEnd: {ch1_pages[-1]["page"]},')
    lines.append(f'    pages: [')
    for p in ch1_pages:
        escaped = escape_ts(p["text"])
        lines.append(f'      {{ page: {p["page"]}, text: "{escaped}" }},')
    lines.append(f'    ],')
    lines.append(f'  }},')

# Chapter 2
if ch2_pages:
    lines.append(f'  {{')
    lines.append(f'    id: "eb_ch2",')
    lines.append(f'    title: "Motion in a Straight Line",')
    lines.append(f'    order: 2,')
    lines.append(f'    sourcePageStart: {ch2_pages[0]["page"]},')
    lines.append(f'    sourcePageEnd: {ch2_pages[-1]["page"]},')
    lines.append(f'    pages: [')
    for p in ch2_pages:
        escaped = escape_ts(p["text"])
        lines.append(f'      {{ page: {p["page"]}, text: "{escaped}" }},')
    lines.append(f'    ],')
    lines.append(f'  }},')

lines.append('];')

with open(OUT, 'w') as f:
    f.write('\n'.join(lines))

size = os.path.getsize(OUT)
print(f"\nWritten: {OUT}")
print(f"Size: {size} bytes ({size/1024:.1f} KB)")
print(f"Lines: {len(lines)}")
