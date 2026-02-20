import json
import logging
from typing import Dict, Any
from agents.base import BytezAgent

logger = logging.getLogger(__name__)


class SearcherAgent(BytezAgent):
    """Gathers context for documentation - Uses Qwen2.5-Coder 7B via Bytez"""

    def __init__(self):
        super().__init__(model_id="Qwen/Qwen2.5-Coder-7B-Instruct")

    async def search(self, code_analysis: Dict[str, Any], language: str) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": """You are a context retrieval expert. Based on the code analysis, provide relevant context for documentation.

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "patterns": [<design patterns used>],
  "best_practices": [<documentation best practices>],
  "concepts": [<relevant programming concepts>],
  "examples": [<example usage patterns>]
}

Respond with ONLY the JSON object, nothing else."""},
            {"role": "user", "content": f"Provide context for documenting {language} code with this analysis:\n{json.dumps(code_analysis)}"}
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
            logger.warning(f"Failed to parse Searcher response as JSON: {response[:200]}")
            return {
                "patterns": ["standard function documentation"],
                "best_practices": ["Include type hints", "Add examples"],
                "concepts": [],
                "examples": []
            }
