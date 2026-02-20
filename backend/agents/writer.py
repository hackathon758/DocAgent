import json
import re
import logging
from typing import Dict, Any
from agents.base import BytezAgent

logger = logging.getLogger(__name__)


class WriterAgent(BytezAgent):
    """Generates documentation - Uses Qwen 2.5 Coder 3B via Bytez"""

    def __init__(self):
        super().__init__(model_id="Qwen/Qwen2.5-Coder-3B-Instruct")

    async def write(self, source_code: str, context: Dict[str, Any], language: str, style: str) -> Dict[str, Any]:
        style_guide = {
            "google": "Google style docstrings with Args, Returns, Raises sections",
            "numpy": "NumPy style with Parameters, Returns, Examples sections",
            "sphinx": "Sphinx/reStructuredText format",
            "jsdoc": "JSDoc format for JavaScript/TypeScript"
        }

        messages = [
            {"role": "system", "content": f"""You are a technical documentation writer. Generate comprehensive documentation using {style_guide.get(style, style_guide['google'])}.

Respond with ONLY a valid JSON object (no markdown wrapping, no explanation):
{{
  "docstring": "<complete docstring with proper formatting>",
  "markdown": "<full markdown documentation with Overview, Parameters, Returns, Example sections>",
  "examples": ["<example 1>", "<example 2>"]
}}

The docstring should be ready to insert directly into the code. Include proper line breaks using \\n.
Respond with ONLY the JSON object, nothing else."""},
            {"role": "user", "content": f"Write documentation for this {language} code:\n\n```{language}\n{source_code}\n```\n\nContext: {json.dumps(context)}"}
        ]

        response = await self.generate(messages, max_tokens=2000)

        try:
            clean_response = response.strip()
            if "```json" in clean_response:
                clean_response = clean_response.split("```json")[1].split("```")[0].strip()
            elif clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1].split("```")[0].strip()

            # Try direct JSON parse first
            try:
                return json.loads(clean_response)
            except json.JSONDecodeError:
                pass

            # Models often use triple-quoted strings (""") inside JSON which
            # breaks parsing.  Replace Python triple quotes with escaped versions.
            fixed = clean_response.replace('"""', '"')
            try:
                return json.loads(fixed)
            except json.JSONDecodeError:
                pass

            # Last resort: extract docstring/markdown with regex
            docstring_match = re.search(
                r'"docstring"\s*:\s*(?:"""(.*?)"""|"((?:[^"\\]|\\.)*)"|```(.*?)```)',
                clean_response, re.DOTALL
            )
            markdown_match = re.search(
                r'"markdown"\s*:\s*"((?:[^"\\]|\\.)*)"',
                clean_response, re.DOTALL
            )
            if docstring_match or markdown_match:
                ds = (docstring_match.group(1) or docstring_match.group(2) or docstring_match.group(3) or "") if docstring_match else ""
                md = markdown_match.group(1) if markdown_match else ""
                return {
                    "docstring": f'"""\n{ds}\n"""' if ds else "",
                    "markdown": md,
                    "examples": []
                }

            raise ValueError("Could not extract documentation")
        except Exception:
            logger.warning(f"Failed to parse Writer response as JSON: {response[:300]}")
            func_name = "function"
            if "def " in source_code:
                parts = source_code.split("def ")[1].split("(")
                if parts:
                    func_name = parts[0].strip()
            elif "function " in source_code:
                parts = source_code.split("function ")[1].split("(")
                if parts:
                    func_name = parts[0].strip()

            return {
                "docstring": f'"""\n{func_name}: Auto-generated documentation.\n\nThis function performs operations as defined in the source code.\n\nArgs:\n    See source code for parameters.\n\nReturns:\n    See source code for return value.\n"""',
                "markdown": f"# {func_name}\n\n## Overview\n\nThis function is part of the codebase.\n\n## Usage\n\n```{language}\nresult = {func_name}()\n```",
                "examples": [f"result = {func_name}()"]
            }
