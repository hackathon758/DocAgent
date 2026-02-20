import logging
import os
from typing import Dict, Any, Optional, Callable
from agents.reader import ReaderAgent
from agents.searcher import SearcherAgent
from agents.writer import WriterAgent
from agents.verifier import VerifierAgent
from agents.diagram import DiagramAgent

logger = logging.getLogger(__name__)

# Map file extensions to language names
_EXT_TO_LANG = {
    ".py": "python", ".js": "javascript", ".ts": "typescript", ".tsx": "typescript",
    ".jsx": "javascript", ".java": "java", ".go": "go", ".rs": "rust",
    ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp", ".cs": "csharp",
    ".swift": "swift", ".kt": "kotlin", ".scala": "scala", ".r": "r",
    ".sh": "bash", ".sql": "sql", ".html": "html", ".css": "css",
}


class OrchestratorAgent:
    """Coordinates all agents for documentation generation"""

    def __init__(self):
        self.reader = ReaderAgent()
        self.searcher = SearcherAgent()
        self.writer = WriterAgent()
        self.verifier = VerifierAgent()
        self.diagram = DiagramAgent()

    async def generate_documentation(
        self,
        source_code: str,
        language: str,
        style: str = "google",
        job_id: str = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Full documentation generation pipeline"""

        result = {
            "status": "processing",
            "stages": {}
        }

        try:
            # Stage 1: Reader - Analyze code
            if progress_callback:
                await progress_callback(10, "Analyzing code structure...")
            analysis = await self.reader.analyze(source_code, language)
            result["stages"]["analysis"] = analysis

            # Stage 2: Searcher - Gather context
            if progress_callback:
                await progress_callback(30, "Gathering context...")
            context = await self.searcher.search(analysis, language)
            result["stages"]["context"] = context

            # Stage 3: Writer - Generate documentation
            if progress_callback:
                await progress_callback(50, "Writing documentation...")
            documentation = await self.writer.write(source_code, context, language, style)
            result["stages"]["documentation"] = documentation

            # Stage 4: Verifier - Check quality
            if progress_callback:
                await progress_callback(70, "Verifying quality...")
            verification = await self.verifier.verify(source_code, documentation)
            result["stages"]["verification"] = verification

            # Stage 5: Diagram - Generate visual
            if progress_callback:
                await progress_callback(90, "Generating diagrams...")
            diagram = await self.diagram.generate_diagram(source_code)
            result["stages"]["diagram"] = diagram

            # Final result
            if progress_callback:
                await progress_callback(100, "Complete!")

            result["status"] = "completed"
            result["documentation"] = {
                "docstring": documentation.get("docstring", ""),
                "markdown": documentation.get("markdown", ""),
                "examples": documentation.get("examples", []),
                "quality_score": verification.get("quality_score", 0),
                "diagram": diagram
            }

        except Exception as e:
            logger.error(f"Documentation generation error: {e}")
            result["status"] = "failed"
            result["error"] = str(e)

        return result

    async def run_agent(
        self,
        agent_name: str,
        file_path: str = "",
        file_content: str = "",
        repo_url: str = "",
        branch: str = "main",
        previous_outputs: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Run a single agent by name for the repo-documentation pipeline.

        Maps both the legacy names (context, analyzer, generator, reviewer,
        finalizer) and the canonical names (reader, searcher, writer, verifier,
        diagram) to the real agent methods.
        """
        if previous_outputs is None:
            previous_outputs = {}

        # Detect language from file extension
        ext = os.path.splitext(file_path)[1].lower() if file_path else ""
        language = _EXT_TO_LANG.get(ext, "python")

        name = agent_name.lower()

        if name in ("context", "reader"):
            return await self.reader.analyze(file_content, language)

        if name in ("analyzer", "searcher"):
            # Use reader/context output as input
            analysis = (
                previous_outputs.get("reader")
                or previous_outputs.get("context")
                or {"documentation_needs": ["docstring"]}
            )
            return await self.searcher.search(analysis, language)

        if name in ("generator", "writer"):
            context = (
                previous_outputs.get("searcher")
                or previous_outputs.get("analyzer")
                or {}
            )
            return await self.writer.write(file_content, context, language, "google")

        if name in ("reviewer", "verifier"):
            documentation = (
                previous_outputs.get("writer")
                or previous_outputs.get("generator")
                or {}
            )
            return await self.verifier.verify(file_content, documentation)

        if name in ("finalizer", "diagram"):
            return await self.diagram.generate_diagram(file_content)

        raise ValueError(f"Unknown agent name: {agent_name}")


# Singleton instance
orchestrator = OrchestratorAgent()
