export const MERMAID_KEYWORDS = [
  'graph', 'flowchart', 'sequencediagram', 'classdiagram',
  'statediagram', 'statediagram-v2', 'erdiagram', 'gantt',
  'pie', 'gitgraph', 'mindmap', 'timeline', 'journey',
];

export function cleanMermaidCode(raw) {
  if (!raw) return '';
  let code = raw;
  // Remove markdown code fences
  code = code.replace(/^```(?:mermaid)?\s*\n?/, '');
  code = code.replace(/\n?```\s*$/, '');
  // Handle double-escaped sequences first, then single-escaped
  code = code.replace(/\\\\n/g, '\n');
  code = code.replace(/\\\\t/g, '  ');
  code = code.replace(/\\\\"/g, '"');
  code = code.replace(/\\n/g, '\n');
  code = code.replace(/\\t/g, '  ');
  code = code.replace(/\\"/g, '"');
  // Normalize line endings and trim trailing whitespace per line
  code = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  code = code.split('\n').map(l => l.trimEnd()).join('\n').trim();
  return code;
}

export function isMermaidValid(code) {
  if (!code || !code.trim()) return false;
  const firstLine = code.trim().split('\n')[0].toLowerCase().trim();
  return MERMAID_KEYWORDS.some(kw => firstLine.startsWith(kw));
}

export function attemptMermaidRepair(code) {
  if (!code) return code;
  let lines = code.trim().split('\n');
  // If no valid diagram type on first line, prepend flowchart TD
  const firstLine = lines[0].toLowerCase().trim();
  if (!MERMAID_KEYWORDS.some(kw => firstLine.startsWith(kw))) {
    lines.unshift('flowchart TD');
  }
  // Remove incomplete arrow lines (e.g. "A -->" with no target)
  lines = lines.filter(line => {
    const stripped = line.trimEnd();
    return !(/-->\s*$/.test(stripped) || /->>?\s*$/.test(stripped));
  });
  return lines.join('\n').trim();
}
