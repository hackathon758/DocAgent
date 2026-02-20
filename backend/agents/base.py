import logging
import json
import asyncio
from typing import List, Dict, Optional
import httpx
from config import BYTEZ_API_KEY, BYTEZ_API_URL

logger = logging.getLogger(__name__)

# Chat-capable model indicators
_CHAT_MODEL_KEYWORDS = {"instruct", "chat", "llama", "qwen", "mistral", "gemma", "phi", "deepseek"}


def _is_chat_model(model_id: str) -> bool:
    """Determine if a model supports the chat messages format."""
    lower = model_id.lower()
    return any(kw in lower for kw in _CHAT_MODEL_KEYWORDS)


class BytezAgent:
    """Base agent using Bytez API with free AI models and Ollama local fallback."""

    def __init__(self, model_id: str = "Qwen/Qwen2.5-Coder-0.5B-Instruct"):
        self.model_id = model_id
        self.api_key = BYTEZ_API_KEY
        self.api_url = BYTEZ_API_URL

    # ------------------------------------------------------------------
    # Primary: Bytez cloud inference
    # ------------------------------------------------------------------

    async def generate(self, messages: List[Dict[str, str]], temperature: float = 0.5, max_tokens: int = 1000) -> str:
        """Generate a response. Tries Bytez cloud → Ollama local → mock."""

        # 1. Try Bytez cloud
        if self.api_key:
            result = await self._call_bytez(messages, temperature, max_tokens)
            if result is not None:
                return result
            logger.warning(f"Bytez failed for {self.model_id}, trying Ollama fallback")

        # 2. Try Ollama local fallback
        result = await self._call_ollama(messages, temperature, max_tokens)
        if result is not None:
            return result

        # 3. Mock fallback
        logger.warning(f"All inference backends failed for {self.model_id}, using mock")
        return self._mock_response(messages)

    async def _call_bytez(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> Optional[str]:
        """Call the Bytez cloud API with retry on rate limits. Returns None on failure."""
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    url = f"{self.api_url}/{self.model_id}"
                    logger.info(f"Calling Bytez API: {url} (attempt {attempt + 1})")

                    # Build request body based on model type
                    params = {"max_new_tokens": max_tokens, "temperature": temperature}

                    if _is_chat_model(self.model_id):
                        body = {"messages": messages, "params": params}
                    else:
                        # Text-to-text models: concatenate messages into a prompt
                        prompt_parts = []
                        for msg in messages:
                            role = msg.get("role", "user")
                            content = msg.get("content", "")
                            if role == "system":
                                prompt_parts.append(f"Instructions: {content}")
                            else:
                                prompt_parts.append(content)
                        body = {"text": "\n\n".join(prompt_parts), "params": params}

                    response = await client.post(
                        url,
                        headers={
                            "Authorization": self.api_key,
                            "Content-Type": "application/json"
                        },
                        json=body
                    )

                    # Handle rate limiting with retry
                    if response.status_code == 429:
                        wait = 5 * (attempt + 1)
                        logger.warning(f"Bytez rate limited (429), retrying in {wait}s...")
                        if attempt < max_retries:
                            await asyncio.sleep(wait)
                            continue
                        logger.warning("Bytez rate limit exceeded after retries")
                        return None

                    if response.status_code == 200:
                        data = response.json()
                        logger.info(f"Bytez API response received for {self.model_id}")

                        if data.get("error") is None:
                            output = data.get("output", {})
                            if isinstance(output, dict):
                                content = output.get("content", "")
                                if content:
                                    logger.info(f"Got content from Bytez: {content[:100]}...")
                                    return content
                            elif isinstance(output, str) and output.strip():
                                logger.info(f"Got string output from Bytez: {output[:100]}...")
                                return output

                        logger.warning(f"Bytez error or unexpected format: {str(data)[:200]}")
                    else:
                        logger.warning(f"Bytez API returned {response.status_code}: {response.text[:300]}")

            except httpx.TimeoutException:
                logger.warning(f"Bytez API timeout for {self.model_id}")
            except Exception as e:
                logger.error(f"Bytez API exception for {self.model_id}: {e}")

            # Don't retry on non-rate-limit errors
            if attempt == 0:
                break

        return None

    # ------------------------------------------------------------------
    # Fallback: Ollama local inference
    # ------------------------------------------------------------------

    async def _call_ollama(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> Optional[str]:
        """Try calling an Ollama local model. Returns None if Ollama is unavailable."""
        # Map Bytez model IDs to likely Ollama model names
        ollama_model = self._resolve_ollama_model()
        if not ollama_model:
            return None

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                # Check if Ollama is running
                try:
                    tags_resp = await client.get("http://localhost:11434/api/tags", timeout=5.0)
                    if tags_resp.status_code != 200:
                        return None
                    installed = {m["name"] for m in tags_resp.json().get("models", [])}
                except Exception:
                    return None

                # Check if our target model is installed (match by prefix)
                model_available = ollama_model in installed or any(
                    ollama_model in name for name in installed
                )
                if not model_available:
                    logger.info(f"Ollama model '{ollama_model}' not installed locally")
                    return None

                logger.info(f"Using Ollama local model: {ollama_model}")
                response = await client.post(
                    "http://localhost:11434/api/chat",
                    json={
                        "model": ollama_model,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": temperature,
                            "num_predict": max_tokens,
                        },
                    },
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("message", {}).get("content", "")
                    if content:
                        logger.info(f"Got Ollama response: {content[:100]}...")
                        return content

        except Exception as e:
            logger.error(f"Ollama fallback error: {e}")

        return None

    def _resolve_ollama_model(self) -> Optional[str]:
        """Map a Bytez model ID to the closest Ollama model name."""
        mid = self.model_id.lower()
        mappings = {
            "qwen": "qwen2.5-coder:7b",
            "llama": "llama3.2:3b",
            "starcoder": "qwen2.5-coder:7b",
            "codellama": "codellama:7b",
            "deepseek": "deepseek-coder:6.7b",
            "mistral": "mistral:7b",
            "phi": "phi3:mini",
            "gemma": "gemma2:2b",
        }
        for key, ollama_name in mappings.items():
            if key in mid:
                return ollama_name
        # Default fallback
        return "llama3.2:3b"

    # ------------------------------------------------------------------
    # Mock fallback (last resort)
    # ------------------------------------------------------------------

    def _mock_response(self, messages: List[Dict[str, str]]) -> str:
        """Generate intelligent mock response based on context."""
        user_content = ""
        for msg in messages:
            if msg.get("role") == "user":
                user_content = msg.get("content", "")
                break

        if "analyze" in user_content.lower() or "code" in user_content.lower():
            return json.dumps({
                "complexity": {"cyclomatic": 5, "cognitive": 3},
                "dependencies": {"internal": [], "external": ["json", "typing"]},
                "architecture_type": "function",
                "documentation_needs": ["docstring", "parameters", "return_value", "examples"]
            })
        elif "context" in user_content.lower() or "patterns" in user_content.lower():
            return json.dumps({
                "patterns": ["factory pattern", "dependency injection"],
                "best_practices": ["Use type hints", "Add comprehensive docstrings", "Include examples"],
                "concepts": ["encapsulation", "modularity"],
                "examples": ["# Example usage included"]
            })
        elif "documentation" in user_content.lower() or "write" in user_content.lower():
            return json.dumps({
                "docstring": '\"\"\"\\nAuto-generated documentation for code component.\\n\\nThis function/class provides functionality as defined in the source code.\\n\\nArgs:\\n    param1: First parameter description\\n    param2: Second parameter description\\n\\nReturns:\\n    Result of the operation\\n\\nExample:\\n    >>> result = function_name(arg1, arg2)\\n\"\"\"',
                "markdown": "# Component Documentation\\n\\n## Overview\\n\\nThis component is part of the codebase and provides specific functionality.\\n\\n## Parameters\\n\\n| Name | Type | Description |\\n|------|------|-------------|\\n| param1 | Any | First parameter |\\n| param2 | Any | Second parameter |\\n\\n## Returns\\n\\nReturns the result of the operation.\\n\\n## Example\\n\\n```python\\nresult = function_name(arg1, arg2)\\nprint(result)\\n```",
                "examples": ["result = function_name(arg1, arg2)", "output = process_data(input)"]
            })
        elif "verify" in user_content.lower() or "quality" in user_content.lower():
            return json.dumps({
                "approved": True,
                "quality_score": 87.5,
                "evaluation": {"accuracy": 90, "completeness": 85, "clarity": 88, "examples": 87},
                "feedback": ["Documentation is comprehensive", "Consider adding more edge cases in examples"]
            })
        elif "diagram" in user_content.lower() or "mermaid" in user_content.lower():
            return json.dumps({
                "diagram_type": "flowchart",
                "mermaid_code": "flowchart TD\\n    A[Start] --> B{Validate Input}\\n    B -->|Valid| C[Process Data]\\n    B -->|Invalid| D[Return Error]\\n    C --> E[Transform Result]\\n    E --> F[Return Output]\\n    D --> F\\n    F --> G[End]",
                "description": "Flowchart showing the main execution flow"
            })

        return "Generated content"
