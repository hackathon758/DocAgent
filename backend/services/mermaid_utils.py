"""Shared Mermaid diagram utilities: cleaning, validation, and repair."""

import re
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

MERMAID_KEYWORDS = {
    "graph", "flowchart", "sequencediagram", "classdiagram",
    "statediagram", "statediagram-v2", "erdiagram", "gantt",
    "pie", "gitgraph", "mindmap", "timeline", "journey",
}


def clean_mermaid_code(raw_code: str) -> str:
    """Thoroughly clean Mermaid code from LLM output artifacts.

    Handles double-escaped sequences, markdown fences, unicode escapes,
    BOM characters and line-ending normalisation.
    """
    if not raw_code:
        return ""

    code = raw_code

    # Step 1: Remove markdown code fences if present
    code = re.sub(r"^```(?:mermaid)?\s*\n?", "", code)
    code = re.sub(r"\n?```\s*$", "", code)

    # Step 2: Handle double-escaped sequences first
    code = code.replace("\\\\n", "\n")
    code = code.replace("\\\\t", "  ")
    code = code.replace('\\\\"', '"')

    # Step 3: Handle single-escaped sequences
    code = code.replace("\\n", "\n")
    code = code.replace("\\t", "  ")
    code = code.replace('\\"', '"')

    # Step 4: Unicode escapes (e.g. \u0027)
    code = re.sub(
        r"\\u([0-9a-fA-F]{4})",
        lambda m: chr(int(m.group(1), 16)),
        code,
    )

    # Step 5: Remove BOM if present
    code = code.lstrip("\ufeff")

    # Step 6: Normalise line endings and strip trailing whitespace per line
    code = code.replace("\r\n", "\n").replace("\r", "\n")
    code = "\n".join(line.rstrip() for line in code.split("\n"))
    code = code.strip()

    return code


def validate_mermaid_syntax(code: str) -> Tuple[bool, str]:
    """Validate basic Mermaid syntax.

    Returns ``(is_valid, error_message)``.  This is a heuristic check, not
    a full parser – it catches the most common LLM mistakes.
    """
    if not code or not code.strip():
        return (False, "Empty diagram code")

    lines = code.strip().split("\n")
    first_line = lines[0].strip().lower()

    # Check that the first line starts with a recognised diagram keyword
    keyword_found = any(first_line.startswith(kw) for kw in MERMAID_KEYWORDS)
    if not keyword_found:
        return (False, f"Unrecognized diagram type in first line: '{lines[0].strip()}'")

    # Check balanced brackets
    for open_b, close_b, name in [("(", ")", "parentheses"), ("[", "]", "square brackets"), ("{", "}", "braces")]:
        if code.count(open_b) != code.count(close_b):
            return (False, f"Unbalanced {name}: {code.count(open_b)} '{open_b}' vs {code.count(close_b)} '{close_b}'")

    return (True, "")


def attempt_mermaid_repair(code: str, error_msg: str) -> str:
    """Best-effort repair of common Mermaid syntax errors.

    Returns the repaired code (may be unchanged if no repair was possible).
    """
    if not code:
        return code

    lines = code.strip().split("\n")

    # Repair 1 – missing diagram type on first line
    first_line = lines[0].strip().lower()
    if not any(first_line.startswith(kw) for kw in MERMAID_KEYWORDS):
        lines.insert(0, "flowchart TD")
        logger.info("Mermaid repair: prepended 'flowchart TD' as diagram type was missing")

    # Repair 2 – unbalanced brackets: trim trailing incomplete lines
    repaired = "\n".join(lines)
    for open_b, close_b in [("(", ")"), ("[", "]"), ("{", "}")]:
        while repaired.count(open_b) != repaired.count(close_b) and len(lines) > 1:
            lines.pop()
            repaired = "\n".join(lines)

    # Repair 3 – remove arrow lines with empty targets (e.g. "A -->")
    cleaned_lines = []
    for line in repaired.split("\n"):
        stripped = line.rstrip()
        if re.search(r"-->\s*$", stripped) or re.search(r"->>?\s*$", stripped):
            logger.info(f"Mermaid repair: removed incomplete arrow line: '{stripped}'")
            continue
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()
