import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import mermaid from 'mermaid';
import { 
  X, 
  FileText, 
  Download, 
  ChevronDown, 
  ChevronRight,
  Code,
  BookOpen,
  GitBranch,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis'
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    useMaxWidth: true
  }
});

// Mermaid Diagram Renderer Component
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
        // Clean up the mermaid code
        let cleanCode = code
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '  ')
          .trim();

        const uniqueId = `mermaid-preview-${index}-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, cleanCode);
        setSvg(renderedSvg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(err.message || 'Failed to render diagram');
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

const DocumentPreviewModal = ({ isOpen, onClose, documentation, repoName, onExport }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);

  const toggleSection = (index) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    documentation?.forEach((_, index) => {
      allExpanded[index] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  const copyToClipboard = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const getLanguageColor = (language) => {
    const colors = {
      python: 'bg-blue-500/20 text-blue-400',
      javascript: 'bg-yellow-500/20 text-yellow-400',
      typescript: 'bg-blue-600/20 text-blue-300',
      java: 'bg-orange-500/20 text-orange-400',
      go: 'bg-cyan-500/20 text-cyan-400',
      rust: 'bg-red-500/20 text-red-400',
      default: 'bg-primary/20 text-primary'
    };
    return colors[language?.toLowerCase()] || colors.default;
  };

  const getQualityColor = (score) => {
    if (score >= 80) return 'text-green-400 bg-green-500/20';
    if (score >= 60) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-red-400 bg-red-500/20';
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-card border border-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          data-testid="document-preview-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Document Preview</h2>
                <p className="text-sm text-muted-foreground">
                  {repoName} • {documentation?.length || 0} files documented
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={expandAll}
                className="border-white/10 text-xs"
              >
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={collapseAll}
                className="border-white/10 text-xs"
              >
                Collapse All
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="ml-2"
                data-testid="close-preview-btn"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Document Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {/* Document Title */}
            <div className="text-center mb-8 pb-6 border-b border-white/10">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {repoName} Documentation
              </h1>
              <p className="text-muted-foreground">
                Auto-generated documentation by DocAgent AI
              </p>
              <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {documentation?.length || 0} Files
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Verified
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  AI Generated
                </span>
              </div>
            </div>

            {/* Table of Contents */}
            <div className="bg-muted/30 rounded-lg p-4 mb-6 border border-white/5">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Table of Contents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {documentation?.map((doc, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setExpandedSections(prev => ({ ...prev, [index]: true }));
                      document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-left text-sm px-3 py-2 rounded hover:bg-white/5 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <Code className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{doc.component_path}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Documentation Sections */}
            {documentation?.map((doc, index) => (
              <div
                key={index}
                id={`section-${index}`}
                className="border border-white/10 rounded-lg overflow-hidden bg-muted/20"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(index)}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedSections[index] ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                    <Code className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">{doc.component_path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${getLanguageColor(doc.language)}`}>
                      {doc.language}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getQualityColor(doc.quality_score)}`}>
                      {doc.quality_score?.toFixed(0)}%
                    </span>
                  </div>
                </button>

                {/* Section Content */}
                <AnimatePresence>
                  {expandedSections[index] && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/10"
                    >
                      <div className="p-4 space-y-4">
                        {/* Docstring */}
                        {doc.docstring && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Documentation
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(doc.docstring, `docstring-${index}`)}
                                className="h-7 px-2"
                              >
                                {copiedIndex === `docstring-${index}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <pre className="text-sm bg-black/40 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-muted-foreground font-mono border border-white/5">
                              {doc.docstring}
                            </pre>
                          </div>
                        )}

                        {/* Usage Example */}
                        {doc.usage_example && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                Usage Example
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(doc.usage_example, `example-${index}`)}
                                className="h-7 px-2"
                              >
                                {copiedIndex === `example-${index}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <pre className="text-sm bg-green-500/10 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-green-300 font-mono border border-green-500/20">
                              {doc.usage_example}
                            </pre>
                          </div>
                        )}

                        {/* Diagram */}
                        {doc.diagram && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                <GitBranch className="w-4 h-4" />
                                Diagram
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(doc.diagram, `diagram-${index}`)}
                                className="h-7 px-2"
                                title="Copy Mermaid code"
                              >
                                {copiedIndex === `diagram-${index}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <MermaidDiagram code={doc.diagram} index={index} />
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/5">
                          {doc.complexity && (
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <p className="text-xs text-muted-foreground">Complexity</p>
                              <p className="text-sm font-medium">{doc.complexity}</p>
                            </div>
                          )}
                          {doc.lines_of_code && (
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <p className="text-xs text-muted-foreground">Lines</p>
                              <p className="text-sm font-medium">{doc.lines_of_code}</p>
                            </div>
                          )}
                          {doc.functions_count !== undefined && (
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <p className="text-xs text-muted-foreground">Functions</p>
                              <p className="text-sm font-medium">{doc.functions_count}</p>
                            </div>
                          )}
                          {doc.classes_count !== undefined && (
                            <div className="text-center p-2 bg-muted/30 rounded">
                              <p className="text-xs text-muted-foreground">Classes</p>
                              <p className="text-sm font-medium">{doc.classes_count}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}

            {/* Empty State */}
            {(!documentation || documentation.length === 0) && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No documentation available to preview</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-muted/30 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Preview shows the content that will be exported
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-white/10"
              >
                Close Preview
              </Button>
              <Button
                onClick={() => {
                  onExport();
                  onClose();
                }}
                className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400"
                data-testid="export-from-preview-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Export as DOCX
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DocumentPreviewModal;
