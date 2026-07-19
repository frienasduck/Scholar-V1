#!/usr/bin/env python3
"""Add rich metadata to all 15 Physics chapters in curriculum-class11.ts"""
import re
import os

FILE = "/home/z/my-project/scholar/src/lib/curriculum-class11.ts"

# Rich metadata for each Physics chapter (p1 through p15)
METADATA = {
    "p1": {
        "overview": "Physics is the study of the basic laws of nature governing matter, energy, space, and time. This chapter introduces the scope of physics, its relationship with technology and society, the fundamental forces of nature, and the scientific method.",
        "learningObjectives": [
            "Understand the scope and excitement of physics as a fundamental science",
            "Identify the connection between physics, technology, and society",
            "Describe the four fundamental forces in nature and their relative strengths",
            "Distinguish between hypotheses, axioms, principles, and theories",
            "Appreciate the role of conservation laws in physics",
        ],
        "prerequisites": ["Basic science concepts from Class 10", "Elementary mathematics"],
        "estimatedTime": "3-4 hours",
        "difficulty": "Easy",
        "boardWeightage": "3 marks",
        "jeeWeightage": "0-1 questions (conceptual)",
        "quickSummary": [
            "Physics studies the fundamental laws of nature — matter, energy, space, and time",
            "Two domains: classical physics (macroscopic) and quantum physics (microscopic)",
            "Four fundamental forces: gravitational, electromagnetic, strong nuclear, weak nuclear",
            "Technology and physics are mutually reinforcing",
            "Conservation laws (energy, momentum, angular momentum, charge) are universal",
        ],
        "importantDefinitions": [
            {"term": "Physics", "definition": "The study of the basic laws of nature governing matter, energy, space, and time."},
            {"term": "Fundamental forces", "definition": "The four basic forces: gravitational, electromagnetic, strong nuclear, and weak nuclear."},
            {"term": "Conservation law", "definition": "A principle stating that a specific quantity remains constant in an isolated system."},
            {"term": "Hypothesis", "definition": "A proposed explanation for a phenomenon that can be tested by experiment."},
            {"term": "Theory", "definition": "A well-substantiated explanation of natural phenomena, supported by evidence."},
        ],
        "commonMistakes": [
            "Confusing strong nuclear force with electromagnetic force — strong force is ~100x stronger but acts only within the nucleus",
            "Thinking technology comes only from physics — it is a two-way street",
            "Mixing up conservation of energy with conservation of momentum — they are independent",
        ],
        "examTips": [
            "Memorise the four fundamental forces and their relative strengths",
            "Give specific examples of physics-technology links",
            "This is a low-weightage chapter — focus on conceptual clarity",
        ],
        "frequentlyConfused": [
            {"a": "Classical physics", "b": "Quantum physics", "distinction": "Classical deals with macroscopic objects at low speeds; quantum deals with atomic/subatomic scales."},
            {"a": "Hypothesis", "b": "Theory", "distinction": "A hypothesis is an untested proposal; a theory is a well-tested, evidence-backed explanation."},
        ],
    },
    "p2": {
        "overview": "This chapter establishes the International System of Units (SI), the foundation of all physical measurement. It covers dimensional analysis, significant figures, error analysis, and the measurement of physical quantities.",
        "learningObjectives": [
            "Identify SI base and derived units for physical quantities",
            "Apply dimensional analysis to check equation consistency and convert units",
            "Determine significant figures and apply rounding rules",
            "Calculate absolute, relative, and percentage errors in measurements",
            "Understand the order of magnitude of physical quantities",
        ],
        "prerequisites": ["Basic algebra", "Powers of 10 / scientific notation", "Class 10 measurement concepts"],
        "estimatedTime": "6-8 hours",
        "difficulty": "Medium",
        "boardWeightage": "5 marks",
        "jeeWeightage": "1-2 questions",
        "quickSummary": [
            "SI has 7 base units: metre, kilogram, second, ampere, kelvin, mole, candela",
            "Dimensional analysis checks consistency using [L], [M], [T], [I], [Theta], [N], [J]",
            "Significant figures reflect measurement precision",
            "Absolute error = |measured - true|; Relative error = absolute/true; Percentage error = relative x 100",
            "1 parsec = 3.086e16 m; 1 light year = 9.46e15 m; 1 angstrom = 1e-10 m",
        ],
        "importantDefinitions": [
            {"term": "SI unit", "definition": "The internationally accepted system of units based on 7 base units."},
            {"term": "Dimensional formula", "definition": "An expression showing the powers of base quantities (M, L, T, etc.) that constitute a physical quantity."},
            {"term": "Significant figures", "definition": "The digits in a measurement that are known reliably plus the first uncertain digit."},
            {"term": "Absolute error", "definition": "The magnitude of the difference between an individual measurement and the true/mean value."},
            {"term": "Least count", "definition": "The smallest measurement that can be taken accurately with an instrument."},
        ],
        "commonMistakes": [
            "Forgetting that dimensional analysis cannot check dimensionless constants",
            "Miscounting significant figures — leading zeros are NOT significant",
            "Mixing up addition/subtraction (least decimal places) with multiplication/division (least sig figs)",
            "Forgetting that dimensional formulas use [M], [L], [T] — not SI unit symbols",
        ],
        "examTips": [
            "Practise converting between units using dimensional analysis (e.g., N to dyne)",
            "Memorise the 7 SI base units and their symbols",
            "For error propagation: addition/subtraction adds absolute errors; multiplication/division adds relative errors",
            "This is a high-yield JEE chapter — practise numericals on dimensional consistency",
        ],
        "frequentlyConfused": [
            {"a": "Precision", "b": "Accuracy", "distinction": "Precision = closeness of repeated measurements; Accuracy = closeness to true value."},
            {"a": "Absolute error", "b": "Relative error", "distinction": "Absolute error has units; relative error is dimensionless (ratio)."},
        ],
    },
}

def escape_js_string(s):
    """Escape a string for use in JavaScript double-quoted string."""
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')

def build_metadata_string(meta):
    """Build the JavaScript metadata string to insert after questions array."""
    lines = [","]
    
    if "overview" in meta:
        lines.append(f'    overview: "{escape_js_string(meta["overview"])}",')
    
    if "learningObjectives" in meta:
        lines.append('    learningObjectives: [')
        for obj in meta["learningObjectives"]:
            lines.append(f'      "{escape_js_string(obj)}",')
        lines.append('    ],')
    
    if "prerequisites" in meta:
        lines.append('    prerequisites: [')
        for pre in meta["prerequisites"]:
            lines.append(f'      "{escape_js_string(pre)}",')
        lines.append('    ],')
    
    if "estimatedTime" in meta:
        lines.append(f'    estimatedTime: "{escape_js_string(meta["estimatedTime"])}",')
    
    if "difficulty" in meta:
        lines.append(f'    difficulty: "{escape_js_string(meta["difficulty"])}",')
    
    if "boardWeightage" in meta:
        lines.append(f'    boardWeightage: "{escape_js_string(meta["boardWeightage"])}",')
    
    if "jeeWeightage" in meta:
        lines.append(f'    jeeWeightage: "{escape_js_string(meta["jeeWeightage"])}",')
    
    if "quickSummary" in meta:
        lines.append('    quickSummary: [')
        for qs in meta["quickSummary"]:
            lines.append(f'      "{escape_js_string(qs)}",')
        lines.append('    ],')
    
    if "importantDefinitions" in meta:
        lines.append('    importantDefinitions: [')
        for d in meta["importantDefinitions"]:
            term = escape_js_string(d["term"])
            definition = escape_js_string(d["definition"])
            lines.append(f'      {{ term: "{term}", definition: "{definition}" }},')
        lines.append('    ],')
    
    if "commonMistakes" in meta:
        lines.append('    commonMistakes: [')
        for cm in meta["commonMistakes"]:
            lines.append(f'      "{escape_js_string(cm)}",')
        lines.append('    ],')
    
    if "examTips" in meta:
        lines.append('    examTips: [')
        for et in meta["examTips"]:
            lines.append(f'      "{escape_js_string(et)}",')
        lines.append('    ],')
    
    if "frequentlyConfused" in meta:
        lines.append('    frequentlyConfused: [')
        for fc in meta["frequentlyConfused"]:
            a = escape_js_string(fc["a"])
            b = escape_js_string(fc["b"])
            dist = escape_js_string(fc["distinction"])
            lines.append(f'      {{ a: "{a}", b: "{b}", distinction: "{dist}" }},')
        lines.append('    ],')
    
    return "\n".join(lines)


def main():
    with open(FILE, 'r') as f:
        content = f.read()
    
    for ch_id, meta in METADATA.items():
        # Find the chapter by id
        id_pattern = f'id: "{ch_id}",'
        id_idx = content.find(id_pattern)
        if id_idx == -1:
            print(f"WARNING: Chapter {ch_id} not found!")
            continue
        
        # Find the questions array after this chapter id
        questions_start = content.find('questions: [', id_idx)
        if questions_start == -1:
            print(f"WARNING: questions array not found for {ch_id}")
            continue
        
        # Find the closing ] of the questions array
        bracket_depth = 0
        i = questions_start + len('questions: ')
        while i < len(content):
            if content[i] == '[':
                bracket_depth += 1
            elif content[i] == ']':
                bracket_depth -= 1
                if bracket_depth == 0:
                    break
            i += 1
        
        close_bracket = i
        
        # Check if metadata already exists (look for "overview:" after the questions array)
        next_500_chars = content[close_bracket:close_bracket+500]
        if 'overview:' in next_500_chars:
            print(f"SKIP: {ch_id} already has metadata")
            continue
        
        # Find the comma after ] or insert one
        after = content[close_bracket+1:]
        stripped = after.lstrip()
        offset = len(after) - len(stripped)
        
        if stripped.startswith(','):
            # There's already a comma, insert after it
            insert_point = close_bracket + 1 + offset + 1  # after the comma
            meta_str = build_metadata_string(meta)
            # Remove leading comma from meta_str since comma already exists
            meta_str = "\n" + meta_str[1:]  # replace leading , with newline
        else:
            # No comma, we need to add one
            insert_point = close_bracket + 1 + offset
            meta_str = build_metadata_string(meta)
        
        content = content[:insert_point] + meta_str + content[insert_point:]
        print(f"OK: Added metadata to {ch_id}")
    
    with open(FILE, 'w') as f:
        f.write(content)
    
    print(f"\nDone! Processed {len(METADATA)} chapters.")


if __name__ == '__main__':
    main()
