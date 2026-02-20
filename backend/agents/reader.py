import json
import logging
from typing import Dict, Any
from agents.base import BytezAgent

logger = logging.getLogger(__name__)


class ReaderAgent(BytezAgent):
    """Analyzes code and determines documentation needs - Uses CodeT5+ 16B"""

    def __init__(self):
        super().__init__(model_id="Qwen/Qwen2.5-Coder-7B-Instruct")

    async def analyze(self, source_code: str, language: str) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": """You are a code analysis expert. Analyze the given code and respond with ONLY a valid JSON object (no markdown, no explanation).

The JSON must have this exact structure:
{
  "complexity": {"cyclomatic": <number>, "cognitive": <number>},
  "dependencies": {"internal": [<strings>], "external": [<strings>]},
  "architecture_type": "<string>",
  "documentation_needs": [<strings>]
}

Respond with ONLY the JSON object, nothing else."""},
            {"role": "user", "content": f"Analyze this {language} code:\n\n```{language}\n{source_code}\n```"}
        ]

        response = await self.generate(messages, max_tokens=500)

        try:
            clean_response = response.strip()
            if "```json" in clean_response:
                clean_response = clean_response.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_response:
                clean_response = clean_response.split("```")[1].split("```")[0].strip()
            return json.loads(clean_response)
        except Exception:
            logger.warning(f"Failed to parse Reader response as JSON: {response[:200]}")
            return {
                "complexity": {"cyclomatic": 5, "cognitive": 3},
                "dependencies": {"internal": [], "external": []},
                "architecture_type": "function",
                "documentation_needs": ["docstring", "parameters", "return_value", "examples"]
            }
