import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import MermaidDiagram from '@/components/MermaidDiagram';
import { renderMarkdown } from '@/lib/markdown';
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
  Info,
  FileCode,
  Settings,
  Monitor,
  Database,
  Globe,
  Users,
  Shield,
  Layers,
  TestTube,
  GraduationCap,
  Tag,
  Wrench,
  Lock,
  ListChecks,
  FileSignature,
  Paperclip
} from 'lucide-react';
import { toast } from 'sonner';

// Section type to icon mapping
const SECTION_ICONS = {
  project_info: Info,
  executive_summary: Sparkles,
  scope: Layers,
  system_requirements: Settings,
  installation_guide: Monitor,
  system_architecture: GitBranch,
  database_schema: Database,
  api_documentation: Globe,
  user_manual: Users,
  admin_guide: Shield,
  source_code: FileCode,
  test_documentation: TestTube,
  training_materials: GraduationCap,
  release_notes: Tag,
  support_maintenance: Wrench,
  security_documentation: Lock,
  post_deployment: ListChecks,
  signoff: FileSignature,
  appendices: Paperclip,
  overview: Sparkles,
  module: Code,
};

const DocumentPreviewModal = ({ isOpen, onClose, documentation, repoName, onExport }) => {
  const [expandedSections, setExpandedSections] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);

  // documentation is now the full preview response: { sections, summary, repo_name, ... }
  const sections = documentation?.sections || [];
  const summary = documentation?.summary || {};

  const toggleSection = (index) => {
    setExpandedSections(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    sections.forEach((_, index) => {
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
                <h2 className="text-xl font-bold text-foreground">Documentation Preview</h2>
                <p className="text-sm text-muted-foreground">
                  {repoName || documentation?.repo_name} — AI-generated documentation
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
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Document Title & Summary */}
            <div className="text-center mb-8 pb-6 border-b border-white/10">
              <h1 className="text-3xl font-bold text-foreground mb-2">
                {repoName || documentation?.repo_name} Documentation
              </h1>
              <p className="text-muted-foreground">
                Auto-generated documentation by DocAgent AI
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {summary.total_files || 0} Files Analyzed
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Quality: {summary.average_quality || 0}%
                </span>
                <span className="flex items-center gap-1">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  {summary.total_diagrams || 0} Diagrams
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  AI Generated
                </span>
              </div>
              {/* Language badges */}
              {summary.languages && Object.keys(summary.languages).length > 0 && (
                <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                  {Object.entries(summary.languages).map(([lang, count]) => (
                    <span key={lang} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {lang} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Table of Contents */}
            {sections.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4 mb-6 border border-white/5">
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Table of Contents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                  {sections.map((section, index) => {
                    const SectionIcon = SECTION_ICONS[section.type] || FileText;
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          setExpandedSections(prev => ({ ...prev, [index]: true }));
                          document.getElementById(`section-${index}`)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-left text-sm px-3 py-2 rounded hover:bg-white/5 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <span className="text-xs text-muted-foreground/50 min-w-[1.5rem]">{index + 1}.</span>
                        <SectionIcon className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
                        <span className="truncate">{section.title}</span>
                        {section.quality_score > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${getQualityColor(section.quality_score)}`}>
                            {section.quality_score}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Documentation Sections */}
            {sections.map((section, index) => {
              const SectionIcon = SECTION_ICONS[section.type] || FileText;
              return (
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
                    <span className="text-xs text-muted-foreground/50 font-mono">{index + 1}.</span>
                    <SectionIcon className="w-5 h-5 text-primary" />
                    <span className="font-medium text-foreground">{section.title}</span>
                    {section.file_count && (
                      <span className="text-xs text-muted-foreground ml-2">({section.file_count} files)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {section.languages && section.languages.length > 0 && (
                      <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary">
                        {section.languages.join(', ')}
                      </span>
                    )}
                    {section.quality_score > 0 && (
                      <span className={`text-xs px-2 py-1 rounded ${getQualityColor(section.quality_score)}`}>
                        {section.quality_score}%
                      </span>
                    )}
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
                        {/* Content */}
                        {section.content && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                {section.title}
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(section.content, `content-${index}`)}
                                className="h-7 px-2"
                              >
                                {copiedIndex === `content-${index}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                            <div
                              className="prose-dark text-sm bg-black/30 p-5 rounded-lg overflow-x-auto border border-white/5 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                            />
                          </div>
                        )}

                        {/* Diagrams */}
                        {section.diagrams && section.diagrams.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
                              <GitBranch className="w-4 h-4" />
                              Diagrams ({section.diagrams.length})
                            </h4>
                            <div className="space-y-3">
                              {section.diagrams.map((diagram, dIdx) => (
                                <div key={dIdx} className="space-y-1">
                                  <div className="flex items-center justify-end">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copyToClipboard(diagram, `diagram-${index}-${dIdx}`)}
                                      className="h-7 px-2"
                                      title="Copy Mermaid code"
                                    >
                                      {copiedIndex === `diagram-${index}-${dIdx}` ? (
                                        <Check className="w-3 h-3 text-green-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  </div>
                                  <MermaidDiagram code={diagram} index={`${index}-${dIdx}`} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
            })}

            {/* Empty State */}
            {sections.length === 0 && (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No documentation available to preview</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-white/10 bg-muted/30 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Preview shows the consolidated repository documentation
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
