import { useState, useEffect } from 'react';
import mermaid from 'mermaid';
import { AlertCircle } from 'lucide-react';
import { cleanMermaidCode } from '@/lib/mermaid-utils';

const MermaidDiagram = ({ code, index }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const cleanCode = cleanMermaidCode(code);
        const uniqueId = `mermaid-preview-${index}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanCode);
        setSvg(renderedSvg);
      } catch (err) {
        console.warn('Mermaid render failed, retrying with simplified code:', err.message);

        // Retry: strip style/class lines that may cause parse errors
        try {
          const cleanCode = cleanMermaidCode(code);
          const simplified = cleanCode
            .split('\n')
            .filter(line => !line.trim().startsWith('style ') && !line.trim().startsWith('class ') && !line.trim().startsWith('classDef '))
            .join('\n');
          const retryId = `mermaid-retry-${index}-${Date.now()}`;
          const { svg: retrySvg } = await mermaid.render(retryId, simplified);
          setSvg(retrySvg);
        } catch (retryErr) {
          console.error('Mermaid render retry also failed:', retryErr);
          setError(retryErr.message || 'Failed to render diagram');
        }
      } finally {
        setLoading(false);
      }
    };

    renderDiagram();
  }, [code, index]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-purple-500/10 rounded-lg border border-purple-500/20">
        <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full" />
        <span className="ml-3 text-purple-300">Rendering diagram...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>Could not render diagram: {error}</span>
        </div>
        <pre className="text-sm bg-purple-500/10 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-purple-300 font-mono border border-purple-500/20">
          {code}
        </pre>
      </div>
    );
  }

  if (svg) {
    return (
      <div
        className="bg-white rounded-lg p-4 overflow-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return null;
};

export default MermaidDiagram;
