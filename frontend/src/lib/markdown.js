// Simple markdown to HTML renderer with custom CSS classes
// Corresponding styles (md-h1, md-code-block, md-table, etc.) are defined in index.css
export function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h6 class="md-h4">$1</h6>')
    .replace(/^### (.+)$/gm, '<h5 class="md-h3">$1</h5>')
    .replace(/^## (.+)$/gm, '<h4 class="md-h2">$1</h4>')
    .replace(/^# (.+)$/gm, '<h3 class="md-h1">$1</h3>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Tables (basic support)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim() !== '');
      const isHeader = cells.every(c => /^[\s-:]+$/.test(c));
      if (isHeader) return ''; // Skip separator rows
      const tag = 'td';
      const row = cells.map(c => `<${tag} class="md-td">${c.trim()}</${tag}>`).join('');
      return `<tr>${row}</tr>`;
    })
    // Checkboxes
    .replace(/^- \[x\] (.+)$/gm, '<div class="md-checkbox checked">&#9745; $1</div>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="md-checkbox">&#9744; $1</div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr" />')
    // Line breaks
    .replace(/\n\n/g, '</p><p class="md-p">')
    .replace(/\n/g, '<br/>');

  // Wrap table rows
  html = html.replace(/((?:<tr>.*?<\/tr>\s*)+)/g, '<table class="md-table"><tbody>$1</tbody></table>');
  // Wrap list items
  html = html.replace(/((?:<li.*?<\/li>\s*)+)/g, '<ul class="md-ul">$1</ul>');

  return `<div class="md-content"><p class="md-p">${html}</p></div>`;
}
