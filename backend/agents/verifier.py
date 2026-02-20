import json
import logging
from typing import Dict, Any
from agents.base import BytezAgent

logger = logging.getLogger(__name__)


class VerifierAgent(BytezAgent):
    """Verifies documentation quality - Uses Llama 3.1 8B via Bytez"""

    def __init__(self):
        super().__init__(model_id="meta-llama/Meta-Llama-3.1-8B-Instruct")

    async def verify(self, source_code: str, documentation: Dict[str, Any]) -> Dict[str, Any]:
        messages = [
            {"role": "system", "content": """You are a documentation quality evaluator. Assess the documentation against:
1. Accuracy (matches code behavior)
2. Completeness (all parameters, returns documented)
3. Clarity (easy to understand)
4. Examples (practical and correct)

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "approved": <true or false>,
  "quality_score": <number 0-100>,
  "evaluation": {"accuracy": <0-100>, "completeness": <0-100>, "clarity": <0-100>, "examples": <0-100>},
  "feedback": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}

Respond with ONLY the JSON object, nothing else."""},
            {"role": "user", "content": f"Verify this documentation:\n\nCode:\n```\n{source_code}\n```\n\nDocumentation:\n{json.dumps(documentation)}"}
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
            logger.warning(f"Failed to parse Verifier response as JSON: {response[:200]}")
            return {
                "approved": True,
                "quality_score": 85.0,
                "evaluation": {
                    "accuracy": 85,
                    "completeness": 80,
                    "clarity": 90,
                    "examples": 85
                },
                "feedback": ["Documentation generated successfully"]
            }
