import json
import re
import logging
from typing import Dict, Any, Optional
from agents.base import BytezAgent
from services.mermaid_utils import (
    clean_mermaid_code,
    validate_mermaid_syntax,
    attempt_mermaid_repair,
    MERMAID_KEYWORDS,
)

logger = logging.getLogger(__name__)

DIAGRAM_SYSTEM_PROMPT = """You are a Mermaid.js diagram generator. Given source code, produce a diagram.

RULES:
1. Return ONLY a raw JSON object. No markdown fences. No explanation before or after.
2. The JSON must have exactly three keys: "diagram_type", "mermaid_code", "description"
3. diagram_type must be one of: flowchart, sequenceDiagram, classDiagram, stateDiagram
4. mermaid_code must be valid Mermaid.js syntax using \\n for newlines.
5. Node labels must NOT contain parentheses, brackets, or braces — use simple text only.
6. Always start flowcharts with "flowchart TD" (not "graph TD").
7. For sequenceDiagram, declare each participant before use.
8. Do NOT use HTML tags or special characters inside labels.

EXAMPLE RESPONSE:
{"diagram_type": "flowchart", "mermaid_code": "flowchart TD\\n    A[Start] --> B{Decision}\\n    B -->|Yes| C[Process]\\n    B -->|No| D[Error]\\n    C --> E[End]\\n    D --> E", "description": "Basic control flow"}"""


class DiagramAgent(BytezAgent):
    """Generates Mermaid diagrams - Uses Llama 3.1 8B via Bytez"""

    def __init__(self):
        super().__init__(model_id="meta-llama/Meta-Llama-3.1-8B-Instruct")

    async def generate_diagram(self, source_code: str, diagram_type: Optional[str] = None) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": DIAGRAM_SYSTEM_PROMPT},
            {"role": "user", "content": f"Create a diagram for:\n```\n{source_code}\n```" + (f"\nPreferred type: {diagram_type}" if diagram_type else "")}
        ]

        response = await self.generate(messages, max_tokens=800)

        parsed = self._extract_json(response)

        if parsed and parsed.get("mermaid_code"):
            parsed["mermaid_code"] = clean_mermaid_code(parsed["mermaid_code"])
            is_valid, err = validate_mermaid_syntax(parsed["mermaid_code"])
            if is_valid:
                logger.info(f"DiagramAgent: produced valid {parsed.get('diagram_type', '?')} ({len(parsed['mermaid_code'])} chars)")
                return parsed

            logger.warning(f"Mermaid validation failed: {err} — attempting repair")
            repaired = attempt_mermaid_repair(parsed["mermaid_code"], err)
            is_valid2, err2 = validate_mermaid_syntax(repaired)
            if is_valid2:
                parsed["mermaid_code"] = repaired
                logger.info("DiagramAgent: repaired diagram passed validation")
                return parsed

            logger.warning(f"Repair also failed: {err2}")

        logger.warning(f"Using fallback diagram. Raw LLM response: {response[:300]}")
        return self._fallback_diagram()

    def _extract_json(self, response: str) -> Optional[Dict[str, Any]]:
        """Try multiple strategies to extract JSON from the LLM response."""
        clean = response.strip()

        # Strategy 1: Direct parse
        try:
            return json.loads(clean)
        except (json.JSONDecodeError, ValueError):
            pass

        # Strategy 2: Remove markdown code fences
        for pattern in [r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"]:
            match = re.search(pattern, clean, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except (json.JSONDecodeError, ValueError):
                    continue

        # Strategy 3: Find first {...} block
        brace_match = re.search(r"\{.*\}", clean, re.DOTALL)
        if brace_match:
            try:
                return json.loads(brace_match.group(0))
            except (json.JSONDecodeError, ValueError):
                pass

        # Strategy 4: Response looks like raw Mermaid code (no JSON wrapper)
        first_line = clean.split("\n")[0].strip().lower()
        if any(first_line.startswith(kw) for kw in MERMAID_KEYWORDS):
            logger.info("DiagramAgent: LLM returned raw Mermaid code, wrapping in JSON structure")
            return {
                "diagram_type": first_line.split()[0] if first_line.split() else "flowchart",
                "mermaid_code": clean,
                "description": "Auto-extracted diagram",
            }

        logger.warning(f"DiagramAgent: all JSON extraction strategies failed. Raw: {clean[:300]}")
        return None

    @staticmethod
    def _fallback_diagram() -> Dict[str, Any]:
        return {
            "diagram_type": "flowchart",
            "mermaid_code": "flowchart TD\n    A[Start] --> B{Input Valid?}\n    B -->|Yes| C[Process Data]\n    B -->|No| D[Handle Error]\n    C --> E[Return Result]\n    D --> E\n    E --> F[End]",
            "description": "Auto-generated flowchart showing basic control flow",
        }
