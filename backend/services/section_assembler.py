"""
Project-level documentation section assembler.

Takes per-file agent outputs + repo metadata and produces 19 comprehensive
documentation sections (Project Information through Appendices).
"""

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from agents.base import BytezAgent

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# LLM helper — lightweight synthesizer reusing existing Bytez infra
# ---------------------------------------------------------------------------

class _SynthesizerAgent(BytezAgent):
    """Thin wrapper used for project-level synthesis calls."""

    def __init__(self):
        super().__init__(model_id="Qwen/Qwen2.5-Coder-3B-Instruct")

    async def synthesize(self, system_prompt: str, user_prompt: str, max_tokens: int = 2000) -> str:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return await self.generate(messages, max_tokens=max_tokens)


_synth = _SynthesizerAgent()


# ---------------------------------------------------------------------------
# Aggregation helpers
# ---------------------------------------------------------------------------

def _aggregate(file_results: List[Dict], metadata_files: List[Dict], test_files: List[Dict]) -> Dict[str, Any]:
    """Pre-compute stats used by multiple section builders."""

    languages: Dict[str, int] = {}
    total_loc = 0
    all_deps_internal: List[str] = []
    all_deps_external: List[str] = []
    architecture_types: List[str] = []
    all_docstrings: List[str] = []
    all_markdowns: List[str] = []
    all_examples: List[str] = []
    all_diagrams: List[Dict] = []
    quality_scores: List[float] = []
    file_paths: List[str] = []

    for fr in file_results:
        path = fr.get("path", "unknown")
        file_paths.append(path)

        ext = os.path.splitext(path)[1].lower()
        lang_map = {
            '.py': 'python', '.js': 'javascript', '.jsx': 'javascript',
            '.ts': 'typescript', '.tsx': 'typescript', '.java': 'java',
            '.cpp': 'cpp', '.c': 'c', '.h': 'c', '.go': 'go',
            '.rs': 'rust', '.cs': 'csharp', '.rb': 'ruby', '.php': 'php'
        }
        lang = lang_map.get(ext, 'text')
        languages[lang] = languages.get(lang, 0) + 1

        agents = fr.get("agents", {})

        # Reader output
        reader_out = _safe_output(agents.get("reader", {}))
        if isinstance(reader_out, dict):
            deps = reader_out.get("dependencies", {})
            if isinstance(deps, dict):
                all_deps_internal.extend(deps.get("internal", []))
                all_deps_external.extend(deps.get("external", []))
            arch = reader_out.get("architecture_type", "")
            if arch:
                architecture_types.append(arch)

        # Writer output
        writer_out = _safe_output(agents.get("writer", {}))
        if isinstance(writer_out, dict):
            ds = writer_out.get("docstring", "")
            if ds:
                all_docstrings.append(f"### {path}\n{ds}")
            md = writer_out.get("markdown", "")
            if md:
                all_markdowns.append(f"### {path}\n{md}")
            exs = writer_out.get("examples", [])
            if exs:
                all_examples.extend(exs)

        # Verifier output
        verifier_out = _safe_output(agents.get("verifier", {}))
        file_quality = 0
        if isinstance(verifier_out, dict):
            qs = verifier_out.get("quality_score", 0)
            try:
                file_quality = float(qs) if qs else 0
            except (ValueError, TypeError):
                file_quality = 0
        quality_scores.append(file_quality)

        # Diagram output
        diagram_out = _safe_output(agents.get("diagram", {}))
        if isinstance(diagram_out, dict):
            code = diagram_out.get("mermaid_code") or diagram_out.get("code") or ""
            if code:
                all_diagrams.append({"source": path, "code": code, "description": diagram_out.get("description", "")})

        # LOC estimate
        content = fr.get("content", "")
        if content:
            total_loc += content.count("\n") + 1

    # Parse metadata files
    readme_content = ""
    package_json: Dict = {}
    requirements_txt = ""
    changelog_content = ""
    license_content = ""
    dockerfile_content = ""

    for mf in metadata_files:
        name_lower = mf.get("name", "").lower()
        content = mf.get("content", "")
        if name_lower.startswith("readme"):
            readme_content = content
        elif name_lower == "package.json":
            try:
                package_json = json.loads(content)
            except Exception:
                pass
        elif name_lower == "requirements.txt":
            requirements_txt = content
        elif name_lower.startswith("changelog") or name_lower.startswith("changes"):
            changelog_content = content
        elif name_lower.startswith("license"):
            license_content = content
        elif name_lower == "dockerfile":
            dockerfile_content = content

    non_zero_scores = [s for s in quality_scores if s > 0]
    avg_quality = round(sum(non_zero_scores) / len(non_zero_scores)) if non_zero_scores else 0

    return {
        "languages": languages,
        "total_loc": total_loc,
        "total_files": len(file_results),
        "total_test_files": len(test_files),
        "deps_internal": sorted(set(all_deps_internal)),
        "deps_external": sorted(set(all_deps_external)),
        "architecture_types": list(set(architecture_types)),
        "all_docstrings": all_docstrings,
        "all_markdowns": all_markdowns,
        "all_examples": all_examples,
        "all_diagrams": all_diagrams,
        "quality_scores": quality_scores,
        "avg_quality": avg_quality,
        "file_paths": file_paths,
        "test_files": test_files,
        "readme": readme_content,
        "package_json": package_json,
        "requirements_txt": requirements_txt,
        "changelog": changelog_content,
        "license": license_content,
        "dockerfile": dockerfile_content,
    }


def _safe_output(agent_data: Any) -> Any:
    """Extract the actual output from an agent result dict."""
    if isinstance(agent_data, dict):
        out = agent_data.get("output", agent_data)
        if isinstance(out, str):
            try:
                return json.loads(out)
            except Exception:
                return out
        return out
    return agent_data


def _dir_tree(paths: List[str], max_depth: int = 3) -> str:
    """Build a text directory tree from a flat list of relative paths."""
    tree: Dict = {}
    for p in paths:
        parts = p.replace("\\", "/").split("/")
        node = tree
        for part in parts[:max_depth]:
            node = node.setdefault(part, {})

    lines: List[str] = []

    def _walk(node: Dict, prefix: str = ""):
        items = sorted(node.items())
        for i, (name, children) in enumerate(items):
            connector = "+-" if i < len(items) - 1 else "\\-"
            lines.append(f"{prefix}{connector} {name}")
            extension = "|  " if i < len(items) - 1 else "   "
            if children:
                _walk(children, prefix + extension)

    _walk(tree)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Section builders (1-19)
# ---------------------------------------------------------------------------

async def _s01_project_info(repo_name: str, repo_url: str, branch: str, agg: Dict) -> Dict:
    readme_excerpt = agg["readme"][:1500] if agg["readme"] else "No README found."
    pkg = agg["package_json"]
    version = pkg.get("version", "N/A")
    description = pkg.get("description", "")
    author = pkg.get("author", "N/A")
    if isinstance(author, dict):
        author = author.get("name", "N/A")

    content = f"""## {repo_name}

**Repository:** {repo_url}
**Branch:** {branch}
**Version:** {version}
**Author:** {author}
{f"**Description:** {description}" if description else ""}

**Languages:** {", ".join(f"{lang} ({count} files)" for lang, count in sorted(agg['languages'].items(), key=lambda x: -x[1]))}
**Total Source Files:** {agg['total_files']}
**Total Lines of Code:** {agg['total_loc']:,}

---

### README

{readme_excerpt}"""

    return {"title": "Project Information", "type": "project_info", "content": content}


async def _s02_executive_summary(repo_name: str, agg: Dict) -> Dict:
    summary_input = (
        f"Repository: {repo_name}\n"
        f"Languages: {json.dumps(agg['languages'])}\n"
        f"Total files: {agg['total_files']}, LOC: {agg['total_loc']}\n"
        f"Architecture types found: {', '.join(agg['architecture_types']) or 'various'}\n"
        f"External deps: {', '.join(agg['deps_external'][:30]) or 'none detected'}\n"
        f"Average quality score: {agg['avg_quality']}%\n"
        f"README excerpt: {agg['readme'][:500]}\n"
    )

    content = await _synth.synthesize(
        system_prompt=(
            "You are a technical writer. Write a concise Executive Summary (3-5 paragraphs) "
            "for a software project based on the information provided. Cover: purpose, tech stack, "
            "architecture overview, key components, and quality assessment. Use markdown formatting. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=summary_input,
        max_tokens=1500,
    )
    return {"title": "Executive Summary", "type": "executive_summary", "content": content}


async def _s03_scope(repo_name: str, agg: Dict) -> Dict:
    lang_table = "\n".join(
        f"| {lang} | {count} |" for lang, count in sorted(agg["languages"].items(), key=lambda x: -x[1])
    )
    tree = _dir_tree(agg["file_paths"])

    content = f"""## Scope of Delivery

This document covers the software deliverables for **{repo_name}**.

### Deliverable Summary

| Metric | Value |
|--------|-------|
| Source files documented | {agg['total_files']} |
| Test files identified | {agg['total_test_files']} |
| Total lines of code | {agg['total_loc']:,} |
| Languages | {len(agg['languages'])} |
| Diagrams generated | {len(agg['all_diagrams'])} |
| Average quality score | {agg['avg_quality']}% |

### Languages Breakdown

| Language | Files |
|----------|-------|
{lang_table}

### Directory Structure

```
{tree}
```"""

    return {"title": "Scope of Delivery", "type": "scope", "content": content}


async def _s04_system_requirements(agg: Dict) -> Dict:
    deps_section = ""
    pkg = agg["package_json"]
    if pkg:
        deps = pkg.get("dependencies", {})
        dev_deps = pkg.get("devDependencies", {})
        if deps:
            rows = "\n".join(f"| {k} | {v} |" for k, v in sorted(deps.items()))
            deps_section += f"\n### Runtime Dependencies (package.json)\n\n| Package | Version |\n|---------|----------|\n{rows}\n"
        if dev_deps:
            rows = "\n".join(f"| {k} | {v} |" for k, v in sorted(dev_deps.items()))
            deps_section += f"\n### Dev Dependencies (package.json)\n\n| Package | Version |\n|---------|----------|\n{rows}\n"
        engines = pkg.get("engines", {})
        if engines:
            rows = "\n".join(f"| {k} | {v} |" for k, v in engines.items())
            deps_section += f"\n### Engine Requirements\n\n| Engine | Version |\n|--------|----------|\n{rows}\n"

    if agg["requirements_txt"]:
        lines = [l.strip() for l in agg["requirements_txt"].splitlines() if l.strip() and not l.startswith("#")]
        if lines:
            rows = "\n".join(f"| {l} |" for l in lines)
            deps_section += f"\n### Python Dependencies (requirements.txt)\n\n| Package |\n|---------|\n{rows}\n"

    if agg["deps_external"]:
        deps_section += f"\n### Detected External Dependencies\n\n{', '.join(agg['deps_external'][:50])}\n"

    content = f"""## System Requirements

### Software Prerequisites

The following tools and runtimes are needed to build and run this project:

{deps_section if deps_section else "No dependency files found in the repository. Check the README for requirements."}

### Hardware Requirements

Standard development machine recommended. See deployment section for production requirements."""

    return {"title": "System Requirements", "type": "system_requirements", "content": content}


async def _s05_installation_guide(agg: Dict) -> Dict:
    # Try to extract install section from README
    readme = agg["readme"]
    install_section = ""
    if readme:
        patterns = [
            r'(?:^|\n)(#{1,3}\s*(?:Install(?:ation)?|Getting\s*Started|Setup|Quick\s*Start).*?)(?=\n#{1,3}\s|\Z)',
        ]
        for pat in patterns:
            m = re.search(pat, readme, re.IGNORECASE | re.DOTALL)
            if m:
                install_section = m.group(1).strip()
                break

    pkg = agg["package_json"]
    auto_steps = ""
    if pkg:
        scripts = pkg.get("scripts", {})
        auto_steps = "\n### Available Scripts\n\n"
        auto_steps += "```bash\n# Install dependencies\nnpm install\n\n"
        for name, cmd in sorted(scripts.items()):
            auto_steps += f"# {name}\nnpm run {name}\n"
        auto_steps += "```\n"
    elif agg["requirements_txt"]:
        auto_steps = """
### Installation Steps

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\\Scripts\\activate  # Windows

# Install dependencies
pip install -r requirements.txt
```
"""

    content = f"""## Installation Guide

{install_section if install_section else "Refer to the project README for detailed installation instructions."}

{auto_steps}"""

    return {"title": "Installation Guide", "type": "installation_guide", "content": content}


async def _s06_system_architecture(repo_name: str, agg: Dict, file_results: List[Dict]) -> Dict:
    # Build a summary of each file's role for the LLM
    file_summaries = []
    for fr in file_results[:30]:
        path = fr.get("path", "")
        agents = fr.get("agents", {})
        reader_out = _safe_output(agents.get("reader", {}))
        arch = ""
        if isinstance(reader_out, dict):
            arch = reader_out.get("architecture_type", "")
        file_summaries.append(f"- {path} (type: {arch})")

    diagrams = agg["all_diagrams"]
    diagram_section = ""
    if diagrams:
        diagram_section = "\n### Component Diagrams\n\n"
        for d in diagrams[:5]:
            diagram_section += f"**{d['source']}**\n\n"
            if d.get("description"):
                diagram_section += f"*{d['description']}*\n\n"

    arch_input = (
        f"Repository: {repo_name}\n"
        f"Files:\n" + "\n".join(file_summaries) + "\n"
        f"External dependencies: {', '.join(agg['deps_external'][:20])}\n"
        f"Architecture types: {', '.join(agg['architecture_types'])}\n"
    )

    arch_text = await _synth.synthesize(
        system_prompt=(
            "You are a software architect. Write a System Architecture section for project documentation. "
            "Describe the high-level architecture, component interactions, design patterns used, "
            "and data flow. Use markdown formatting with subsections. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=arch_input,
        max_tokens=2000,
    )

    content = f"""## System Architecture

{arch_text}

{diagram_section}"""

    return {
        "title": "System Architecture",
        "type": "system_architecture",
        "content": content,
        "diagrams": [d["code"] for d in diagrams[:5]],
    }


async def _s07_database_schema(agg: Dict, file_results: List[Dict]) -> Dict:
    # Find files likely containing DB models/schemas
    db_keywords = {"model", "schema", "migration", "entity", "table", "database", "db", "orm", "prisma", "sequelize", "mongoose", "sqlalchemy"}
    db_files = []
    for fr in file_results:
        path = fr.get("path", "").lower()
        if any(kw in path for kw in db_keywords):
            content = fr.get("content", "")[:1500]
            db_files.append(f"File: {fr.get('path', '')}\n```\n{content}\n```")

    if not db_files:
        return {
            "title": "Database Schema",
            "type": "database_schema",
            "content": "## Database Schema\n\nNo database model files were detected in this repository. "
                       "If the project uses a database, refer to the source code for schema definitions.",
        }

    db_input = "\n\n".join(db_files[:10])
    schema_text = await _synth.synthesize(
        system_prompt=(
            "You are a database architect. Based on the code files provided, document the database schema. "
            "Include tables/collections, fields, data types, relationships, and indexes if detectable. "
            "Use markdown tables. Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=f"Analyze these files and document the database schema:\n\n{db_input}",
        max_tokens=2000,
    )

    return {"title": "Database Schema", "type": "database_schema", "content": f"## Database Schema\n\n{schema_text}"}


async def _s08_api_documentation(agg: Dict, file_results: List[Dict]) -> Dict:
    api_keywords = {"route", "router", "endpoint", "controller", "api", "handler", "view", "urls"}
    api_files = []
    for fr in file_results:
        path = fr.get("path", "").lower()
        if any(kw in path for kw in api_keywords):
            content = fr.get("content", "")[:2000]
            api_files.append(f"File: {fr.get('path', '')}\n```\n{content}\n```")

    if not api_files:
        return {
            "title": "API Documentation",
            "type": "api_documentation",
            "content": "## API Documentation\n\nNo API route files were detected in this repository. "
                       "If the project exposes APIs, refer to the source code for endpoint definitions.",
        }

    api_input = "\n\n".join(api_files[:10])
    api_text = await _synth.synthesize(
        system_prompt=(
            "You are an API documentation writer. Based on the route/controller files provided, "
            "document all API endpoints. For each endpoint include: HTTP method, path, description, "
            "request parameters/body, response format. Use markdown tables where appropriate. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=f"Document the API endpoints from these files:\n\n{api_input}",
        max_tokens=2500,
    )

    return {"title": "API Documentation", "type": "api_documentation", "content": f"## API Documentation\n\n{api_text}"}


async def _s09_user_manual(repo_name: str, agg: Dict) -> Dict:
    examples_text = "\n".join(f"- `{ex}`" for ex in agg["all_examples"][:20]) if agg["all_examples"] else "No usage examples extracted."
    readme_excerpt = agg["readme"][:1000] if agg["readme"] else ""

    manual_input = (
        f"Project: {repo_name}\n"
        f"README excerpt:\n{readme_excerpt}\n\n"
        f"Usage examples from code:\n{examples_text}\n"
    )

    manual_text = await _synth.synthesize(
        system_prompt=(
            "You are a technical writer. Write a User Manual section for software documentation. "
            "Cover: getting started, basic usage, common workflows, and troubleshooting tips. "
            "Base it on the project info and examples provided. Use markdown formatting. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=manual_input,
        max_tokens=2000,
    )

    return {"title": "User Manual", "type": "user_manual", "content": f"## User Manual\n\n{manual_text}"}


async def _s10_admin_guide(repo_name: str, agg: Dict, file_results: List[Dict]) -> Dict:
    config_keywords = {"config", "settings", "env", "deploy", "docker", "nginx", "helm", "k8s", "kubernetes"}
    config_snippets = []
    for fr in file_results:
        path = fr.get("path", "").lower()
        if any(kw in path for kw in config_keywords):
            config_snippets.append(f"File: {fr.get('path', '')}")

    dockerfile_info = ""
    if agg["dockerfile"]:
        dockerfile_info = f"\nDockerfile found:\n```\n{agg['dockerfile'][:800]}\n```\n"

    admin_input = (
        f"Project: {repo_name}\n"
        f"Config/deployment files: {', '.join(config_snippets[:10]) if config_snippets else 'none detected'}\n"
        f"{dockerfile_info}"
        f"Dependencies: {', '.join(agg['deps_external'][:20])}\n"
    )

    admin_text = await _synth.synthesize(
        system_prompt=(
            "You are a DevOps engineer. Write an Admin Guide section for software documentation. "
            "Cover: deployment procedures, environment configuration, monitoring, backup, "
            "and scaling considerations. Use markdown formatting. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=admin_input,
        max_tokens=1500,
    )

    return {"title": "Admin Guide", "type": "admin_guide", "content": f"## Admin Guide\n\n{admin_text}"}


async def _s11_source_code_delivery(agg: Dict) -> Dict:
    tree = _dir_tree(agg["file_paths"])
    file_table = "\n".join(
        f"| {i+1} | {p} |" for i, p in enumerate(agg["file_paths"])
    )

    content = f"""## Source Code Delivery

### Repository Structure

```
{tree}
```

### File Inventory

| # | File Path |
|---|-----------|
{file_table}

### Summary

- **Total source files:** {agg['total_files']}
- **Total test files:** {agg['total_test_files']}
- **Total lines of code:** {agg['total_loc']:,}
- **Languages:** {', '.join(sorted(agg['languages'].keys()))}"""

    return {"title": "Source Code Delivery", "type": "source_code", "content": content}


async def _s12_test_documentation(agg: Dict) -> Dict:
    test_files = agg["test_files"]
    if not test_files:
        content = """## Test Documentation

No dedicated test files were detected in the repository. Consider adding tests to improve code quality and maintainability.

### Recommendations

- Add unit tests for core business logic
- Add integration tests for API endpoints
- Set up CI/CD pipeline to run tests automatically
- Aim for at least 80% code coverage"""
    else:
        file_table = "\n".join(
            f"| {tf['path']} | {tf.get('language', 'unknown')} | {tf.get('size', 0):,} bytes |"
            for tf in test_files
        )
        lang_counts: Dict[str, int] = {}
        for tf in test_files:
            lang = tf.get("language", "unknown")
            lang_counts[lang] = lang_counts.get(lang, 0) + 1

        content = f"""## Test Documentation

### Test Files Inventory

| File | Language | Size |
|------|----------|------|
{file_table}

### Test Summary

- **Total test files:** {len(test_files)}
- **Test languages:** {', '.join(f'{lang} ({count})' for lang, count in sorted(lang_counts.items()))}
- **Test-to-source ratio:** {len(test_files)}:{agg['total_files']}"""

    return {"title": "Test Documentation", "type": "test_documentation", "content": content}


async def _s13_training_materials(repo_name: str, agg: Dict) -> Dict:
    examples_text = "\n".join(f"```\n{ex}\n```" for ex in agg["all_examples"][:15]) if agg["all_examples"] else "No examples extracted."

    training_input = (
        f"Project: {repo_name}\n"
        f"Languages: {json.dumps(agg['languages'])}\n"
        f"Code examples found:\n{examples_text}\n"
    )

    training_text = await _synth.synthesize(
        system_prompt=(
            "You are a training specialist. Write a Training Materials section for software documentation. "
            "Include: learning objectives, prerequisites, step-by-step tutorials, and exercises. "
            "Base it on the project info and code examples. Use markdown formatting. "
            "Do NOT wrap in code fences. Output ONLY the markdown text."
        ),
        user_prompt=training_input,
        max_tokens=1500,
    )

    return {"title": "Training Materials", "type": "training_materials", "content": f"## Training Materials\n\n{training_text}"}


async def _s14_release_notes(repo_name: str, agg: Dict) -> Dict:
    pkg = agg["package_json"]
    version = pkg.get("version", "1.0.0") if pkg else "1.0.0"

    changelog_excerpt = ""
    if agg["changelog"]:
        changelog_excerpt = f"\n### Changelog\n\n{agg['changelog'][:2000]}\n"

    content = f"""## Release Notes

### Version {version}

**Release Date:** {datetime.now().strftime("%B %d, %Y")}
**Project:** {repo_name}

### What's Included

- {agg['total_files']} source files across {len(agg['languages'])} language(s)
- {agg['total_test_files']} test files
- {len(agg['all_diagrams'])} auto-generated diagrams
- Average documentation quality score: {agg['avg_quality']}%

### Languages

{', '.join(f'{lang} ({count} files)' for lang, count in sorted(agg['languages'].items(), key=lambda x: -x[1]))}
{changelog_excerpt}"""

    return {"title": "Release Notes", "type": "release_notes", "content": content}


async def _s15_support_maintenance(repo_name: str, agg: Dict) -> Dict:
    content = f"""## Support & Maintenance

### Maintenance Guidelines

1. **Dependency Updates** — Regularly update dependencies listed in the System Requirements section. Use automated tools (Dependabot, Renovate) where possible.
2. **Code Quality** — Current average quality score is {agg['avg_quality']}%. Run documentation generation periodically to track quality trends.
3. **Testing** — Maintain and expand the test suite ({agg['total_test_files']} test files currently identified).
4. **Documentation** — Re-generate this documentation when significant changes are made.

### Support Contacts

| Role | Contact |
|------|---------|
| Project Maintainer | See repository contributors |
| Issue Tracker | {repo_name} issue tracker |

### Troubleshooting

- Check the Installation Guide for setup issues
- Review the Admin Guide for deployment problems
- Consult the API Documentation for integration questions"""

    return {"title": "Support & Maintenance", "type": "support_maintenance", "content": content}


async def _s16_security_documentation(agg: Dict, file_results: List[Dict]) -> Dict:
    security_keywords = {"auth", "security", "middleware", "jwt", "oauth", "token", "password", "encrypt", "hash", "cors", "csrf", "permission", "rbac"}
    sec_files = []
    for fr in file_results:
        path = fr.get("path", "").lower()
        if any(kw in path for kw in security_keywords):
            sec_files.append(f"- {fr.get('path', '')}")

    if not sec_files:
        content = """## Security Documentation

No dedicated security files were detected. Review the following recommendations:

### Security Checklist

- [ ] Input validation on all user-facing endpoints
- [ ] Authentication and authorization mechanisms
- [ ] Secure storage of secrets and credentials
- [ ] HTTPS enforcement in production
- [ ] CORS configuration
- [ ] Rate limiting on API endpoints
- [ ] Dependency vulnerability scanning
- [ ] Security headers (CSP, X-Frame-Options, etc.)"""
    else:
        sec_input = f"Security-related files found:\n" + "\n".join(sec_files)
        sec_text = await _synth.synthesize(
            system_prompt=(
                "You are a security engineer. Write a Security Documentation section. "
                "Cover: authentication mechanisms, authorization model, data protection, "
                "known security controls, and security recommendations. Use markdown. "
                "Do NOT wrap in code fences. Output ONLY the markdown text."
            ),
            user_prompt=sec_input,
            max_tokens=1500,
        )
        content = f"## Security Documentation\n\n{sec_text}"

    return {"title": "Security Documentation", "type": "security_documentation", "content": content}


async def _s17_post_deployment_checklist(agg: Dict) -> Dict:
    has_docker = bool(agg["dockerfile"])
    has_node = bool(agg["package_json"])
    has_python = bool(agg["requirements_txt"])

    checks = [
        "- [ ] All environment variables configured",
        "- [ ] Database migrations applied",
        "- [ ] SSL/TLS certificates installed",
        "- [ ] DNS records updated",
        "- [ ] Health check endpoints verified",
        "- [ ] Logging and monitoring configured",
        "- [ ] Backup procedures tested",
        "- [ ] Security scan completed",
    ]
    if has_docker:
        checks.extend([
            "- [ ] Docker images built and pushed to registry",
            "- [ ] Container resource limits configured",
        ])
    if has_node:
        checks.extend([
            "- [ ] `npm run build` completed successfully",
            "- [ ] Static assets served via CDN",
        ])
    if has_python:
        checks.extend([
            "- [ ] Python dependencies installed in production virtualenv",
            "- [ ] WSGI/ASGI server configured",
        ])

    content = f"""## Post-Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Documentation up to date

### Deployment Steps

{chr(10).join(checks)}

### Post-Deployment Verification

- [ ] Application accessible and responsive
- [ ] Core functionality smoke tested
- [ ] Monitoring dashboards showing expected metrics
- [ ] Error rates within acceptable thresholds"""

    return {"title": "Post-Deployment Checklist", "type": "post_deployment", "content": content}


async def _s18_signoff(repo_name: str, agg: Dict) -> Dict:
    content = f"""## Sign-Off & Acceptance

### Documentation Summary

| Metric | Value |
|--------|-------|
| Project | {repo_name} |
| Documentation Date | {datetime.now().strftime("%B %d, %Y")} |
| Files Documented | {agg['total_files']} |
| Average Quality Score | {agg['avg_quality']}% |
| Diagrams Generated | {len(agg['all_diagrams'])} |

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | All source files documented | {"Pass" if agg['avg_quality'] > 0 else "Pending"} |
| 2 | API endpoints documented | Refer to Section 8 |
| 3 | Architecture diagrams generated | {"Pass" if agg['all_diagrams'] else "Pending"} |
| 4 | Quality score above threshold | {agg['avg_quality']}% |

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Manager | _____________ | ___/___/______ | _____________ |
| Tech Lead | _____________ | ___/___/______ | _____________ |
| QA Lead | _____________ | ___/___/______ | _____________ |"""

    return {"title": "Sign-Off & Acceptance", "type": "signoff", "content": content}


async def _s19_appendices(agg: Dict) -> Dict:
    # Glossary from external deps
    glossary_items = []
    for dep in agg["deps_external"][:30]:
        glossary_items.append(f"| {dep} | External dependency |")
    glossary_table = "\n".join(glossary_items) if glossary_items else "| (none) | - |"

    # All diagrams
    diagrams_section = ""
    for d in agg["all_diagrams"]:
        diagrams_section += f"\n**{d['source']}**\n"
        if d.get("description"):
            diagrams_section += f"*{d['description']}*\n"

    content = f"""## Appendices

### A. Complete Dependency List

**External Dependencies:** {len(agg['deps_external'])}
**Internal Dependencies:** {len(agg['deps_internal'])}

### B. Glossary

| Term | Description |
|------|-------------|
{glossary_table}

### C. All Generated Diagrams

{diagrams_section if diagrams_section else "No diagrams were generated."}

### D. Quality Metrics by File

| File | Quality Score |
|------|--------------|
{"".join(f"| {path} | {score:.0f}% |{chr(10)}" for path, score in zip(agg['file_paths'], agg['quality_scores']))}

### E. License

{agg['license'][:1000] if agg['license'] else "No LICENSE file found in the repository."}"""

    return {"title": "Appendices", "type": "appendices", "content": content, "diagrams": [d["code"] for d in agg["all_diagrams"]]}


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def assemble_sections(
    repo_name: str,
    repo_url: str,
    branch: str,
    file_results: List[Dict[str, Any]],
    metadata_files: List[Dict[str, Any]],
    test_files: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Assemble all 19 documentation sections from per-file agent outputs.

    Returns a list of dicts, each with: title, type, content, and optionally
    diagrams and quality_score.
    """
    if test_files is None:
        test_files = []

    logger.info(f"Assembling 19 documentation sections for {repo_name} ({len(file_results)} files)")
    agg = _aggregate(file_results, metadata_files, test_files)

    sections = []

    # Deterministic sections first (fast)
    sections.append(await _s01_project_info(repo_name, repo_url, branch, agg))
    sections.append(await _s03_scope(repo_name, agg))
    sections.append(await _s04_system_requirements(agg))
    sections.append(await _s05_installation_guide(agg))
    sections.append(await _s11_source_code_delivery(agg))
    sections.append(await _s12_test_documentation(agg))
    sections.append(await _s14_release_notes(repo_name, agg))
    sections.append(await _s15_support_maintenance(repo_name, agg))
    sections.append(await _s17_post_deployment_checklist(agg))
    sections.append(await _s18_signoff(repo_name, agg))
    sections.append(await _s19_appendices(agg))

    # LLM-synthesized sections (slower — run sequentially to avoid rate limits)
    sections.insert(1, await _s02_executive_summary(repo_name, agg))
    sections.insert(5, await _s06_system_architecture(repo_name, agg, file_results))
    sections.insert(6, await _s07_database_schema(agg, file_results))
    sections.insert(7, await _s08_api_documentation(agg, file_results))
    sections.insert(8, await _s09_user_manual(repo_name, agg))
    sections.insert(9, await _s10_admin_guide(repo_name, agg, file_results))
    sections.insert(12, await _s13_training_materials(repo_name, agg))
    sections.insert(15, await _s16_security_documentation(agg, file_results))

    # Ensure correct order (1-19)
    order = [
        "Project Information", "Executive Summary", "Scope of Delivery",
        "System Requirements", "Installation Guide", "System Architecture",
        "Database Schema", "API Documentation", "User Manual", "Admin Guide",
        "Source Code Delivery", "Test Documentation", "Training Materials",
        "Release Notes", "Support & Maintenance", "Security Documentation",
        "Post-Deployment Checklist", "Sign-Off & Acceptance", "Appendices",
    ]
    title_map = {s["title"]: s for s in sections}
    ordered = [title_map[t] for t in order if t in title_map]
    # Append any extras not in the defined order
    for s in sections:
        if s["title"] not in order:
            ordered.append(s)

    logger.info(f"Section assembly complete: {len(ordered)} sections")
    return ordered
