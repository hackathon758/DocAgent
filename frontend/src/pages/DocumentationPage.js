import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import mermaid from 'mermaid';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import MermaidDiagram from '@/components/MermaidDiagram';
import { renderMarkdown } from '@/lib/markdown';
import { cleanMermaidCode, isMermaidValid, attemptMermaidRepair } from '@/lib/mermaid-utils';
import {
  FileText, FolderGit2, Code, Eye, Copy, Download, Search,
  ChevronRight, ChevronDown, File, Folder, AlertCircle, GitBranch, Clock,
  ExternalLink, Loader2
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

const DocumentationPage = () => {
  const { docId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [documentation, setDocumentation] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('preview');
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState(null);
  const [diagramRawCode, setDiagramRawCode] = useState('');
  const [expandedFolders, setExpandedFolders] = useState({});

  // Repo filtering
  const [repositories, setRepositories] = useState([]);
  const [selectedRepoId, setSelectedRepoId] = useState(searchParams.get('repo') || '');

  // Repo info
  const [repoInfo, setRepoInfo] = useState(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    fetchDocumentation(selectedRepoId);
  }, [selectedRepoId]);

  useEffect(() => {
    if (docId && documentation.length > 0) {
      const doc = documentation.find(d => d.id === docId);
      if (doc) setSelectedDoc(doc);
    }
  }, [docId, documentation]);

  useEffect(() => {
    if (selectedDoc?.diagrams?.[0]?.mermaid_code) {
      renderMermaidDiagram(selectedDoc.diagrams[0].mermaid_code);
    } else {
      setDiagramSvg('');
      setDiagramError(null);
    }
  }, [selectedDoc, theme]);

  // Fetch repo info when selected repo changes
  useEffect(() => {
    if (selectedRepoId) {
      fetchRepoInfo(selectedRepoId);
    } else if (documentation.length > 0 && documentation[0]?.repository_id) {
      fetchRepoInfo(documentation[0].repository_id);
    } else {
      setRepoInfo(null);
    }
  }, [selectedRepoId, documentation]);

  const renderMermaidDiagram = useCallback(async (mermaidCode) => {
    if (!mermaidCode) return;
    setDiagramError(null);
    setDiagramSvg('');
    setDiagramRawCode('');
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });
      let cleanCode = cleanMermaidCode(mermaidCode);
      setDiagramRawCode(cleanCode);

      // If the cleaned code doesn't start with a valid keyword, try repair
      if (!isMermaidValid(cleanCode)) {
        cleanCode = attemptMermaidRepair(cleanCode);
      }

      const uniqueId = `mermaid-diagram-${Date.now()}`;
      try {
        const { svg } = await mermaid.render(uniqueId, cleanCode);
        setDiagramSvg(svg);
      } catch (firstError) {
        // Retry with repair if first attempt fails
        const repairedCode = attemptMermaidRepair(cleanCode);
        if (repairedCode !== cleanCode) {
          const retryId = `mermaid-retry-${Date.now()}`;
          const { svg } = await mermaid.render(retryId, repairedCode);
          setDiagramSvg(svg);
        } else {
          throw firstError;
        }
      }
    } catch (error) {
      console.error('Mermaid render error:', error);
      setDiagramError(error.message || 'Failed to render diagram');
    }
  }, [theme]);

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/repositories`);
      setRepositories(response.data);
      // If no repo selected from URL but repos exist, auto-select the first one
      if (!selectedRepoId && response.data.length > 0) {
        const firstRepoId = response.data[0].id;
        setSelectedRepoId(firstRepoId);
        setSearchParams({ repo: firstRepoId });
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
  };

  const fetchDocumentation = async (repoId) => {
    setLoading(true);
    try {
      const params = {};
      if (repoId) params.repository_id = repoId;
      const response = await axios.get(`${API_URL}/api/documentation`, { params });
      setDocumentation(response.data);
      if (!docId && response.data.length > 0) {
        setSelectedDoc(response.data[0]);
      } else if (response.data.length === 0) {
        setSelectedDoc(null);
      }
    } catch (error) {
      console.error('Failed to fetch documentation:', error);
      toast.error('Failed to load documentation');
    } finally {
      setLoading(false);
    }
  };

  const handleRepoChange = (repoId) => {
    setSelectedRepoId(repoId);
    setSelectedDoc(null);
    if (repoId) {
      setSearchParams({ repo: repoId });
    } else {
      setSearchParams({});
    }
  };

  const fetchRepoInfo = async (repoId) => {
    try {
      const response = await axios.get(`${API_URL}/api/repositories/${repoId}`);
      setRepoInfo(response.data);
    } catch {
      // Repo might not exist or auth might fail — that's okay
      setRepoInfo(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const downloadDoc = () => {
    if (!selectedDoc) return;
    const content = `# ${selectedDoc.component_path}\n\n${selectedDoc.markdown || ''}\n\n## Docstring\n\n\`\`\`${selectedDoc.language}\n${selectedDoc.docstring || ''}\n\`\`\``;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedDoc.component_path.replace(/\//g, '_')}_docs.md`;
    a.click();
  };

  // Group docs by folder
  const groupedDocs = documentation.reduce((acc, doc) => {
    const parts = doc.component_path.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'root';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(doc);
    return acc;
  }, {});

  const filteredDocs = documentation.filter(doc =>
    doc.component_path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFolder = (folder) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const FileTree = () => (
    <div className="space-y-1">
      {Object.entries(groupedDocs).map(([folder, docs]) => {
        const isExpanded = expandedFolders[folder] !== false;
        const filteredFolderDocs = docs.filter(doc =>
          doc.component_path.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (searchTerm && filteredFolderDocs.length === 0) return null;

        return (
          <div key={folder}>
            <button
              onClick={() => toggleFolder(folder)}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <Folder className="w-4 h-4" />
              <span className="truncate">{folder}</span>
              <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                {filteredFolderDocs.length}
              </Badge>
            </button>
            {isExpanded && (
              <div className="ml-4 mt-1 space-y-0.5">
                {filteredFolderDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setSelectedDoc(doc)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${selectedDoc?.id === doc.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                  >
                    <File className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{doc.component_path.split('/').pop()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Documentation" />

        <main className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* File Browser Panel */}
            <ResizablePanel defaultSize={20} minSize={15} maxSize={35}>
              <div className="h-full flex flex-col border-r border-border bg-card/50">
                {/* Repo Selector */}
                <div className="p-4 border-b border-border">
                  <Select value={selectedRepoId} onValueChange={handleRepoChange}>
                    <SelectTrigger className="bg-muted/50 border-white/10 h-9">
                      <FolderGit2 className="w-4 h-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Select Repository" />
                    </SelectTrigger>
                    <SelectContent>
                      {repositories.map(repo => (
                        <SelectItem key={repo.id} value={repo.id}>
                          {repo.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                </div>

                {/* Repo Info Badge */}
                {repoInfo && (
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <Link
                      to={`/repositories`}
                      className="flex items-center gap-2 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FolderGit2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {repoInfo.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {repoInfo.provider} · {repoInfo.branch}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </div>
                )}

                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : documentation.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documentation yet</p>
                        <Link to="/dashboard">
                          <Button size="sm" className="mt-4">Go to Dashboard</Button>
                        </Link>
                      </div>
                    ) : (
                      <FileTree />
                    )}
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Main Content Panel */}
            <ResizablePanel defaultSize={80}>
              {selectedDoc ? (
                <div className="h-full flex flex-col">
                  {/* Doc Header */}
                  <div className="px-6 py-4 border-b border-border bg-card/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <h2 className="text-lg font-semibold">{selectedDoc.component_path}</h2>
                          {selectedDoc.version && (
                            <Badge variant="outline" className="text-[10px]">
                              v{selectedDoc.version}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Code className="w-3.5 h-3.5" />
                            {selectedDoc.language || 'Unknown'}
                          </span>
                          {selectedDoc.metadata?.quality_score && (
                            <span className="flex items-center gap-1">
                              Quality: {selectedDoc.metadata.quality_score}%
                            </span>
                          )}
                          {repoInfo && (
                            <span className="flex items-center gap-1">
                              <FolderGit2 className="w-3.5 h-3.5" />
                              {repoInfo.name}
                            </span>
                          )}
                          {selectedDoc.updated_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {new Date(selectedDoc.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(selectedDoc.docstring || '')}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadDoc}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Tabs Content */}
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-6 pt-4 border-b border-border">
                      <TabsList className="bg-muted/50">
                        <TabsTrigger value="preview" className="gap-1.5">
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </TabsTrigger>
                        <TabsTrigger value="docstring">Docstring</TabsTrigger>
                        <TabsTrigger value="diagram">Diagram</TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      {/* Preview Tab — rendered markdown */}
                      <TabsContent value="preview" className="h-full m-0">
                        <ScrollArea className="h-full">
                          <div className="p-6 max-w-none">
                            {selectedDoc.markdown ? (
                              <>
                                <div
                                  className="prose-dark text-sm bg-black/30 p-5 rounded-lg overflow-x-auto border border-white/5 leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedDoc.markdown) }}
                                />
                                {selectedDoc.diagrams && selectedDoc.diagrams.length > 0 && (
                                  <div className="mt-6 space-y-4">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                                      <GitBranch className="w-4 h-4" />
                                      Diagrams ({selectedDoc.diagrams.length})
                                    </h4>
                                    {selectedDoc.diagrams.map((diagram, idx) => (
                                      <MermaidDiagram
                                        key={idx}
                                        code={diagram.mermaid_code}
                                        index={`preview-${idx}`}
                                      />
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-muted-foreground">No documentation available</p>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      {/* Docstring Tab — raw code */}
                      <TabsContent value="docstring" className="h-full m-0">
                        <ScrollArea className="h-full">
                          <div className="p-6">
                            <pre className="text-sm font-mono whitespace-pre-wrap bg-muted/30 rounded-lg p-4 border border-border">
                              {selectedDoc.docstring || '# No docstring available'}
                            </pre>
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      {/* Diagram Tab */}
                      <TabsContent value="diagram" className="h-full m-0">
                        <ScrollArea className="h-full">
                          <div className="p-6">
                            {diagramSvg ? (
                              <div
                                className="flex justify-center"
                                dangerouslySetInnerHTML={{ __html: diagramSvg }}
                              />
                            ) : diagramError ? (
                              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mb-2" />
                                <p className="text-sm font-medium">Failed to render diagram</p>
                                <p className="text-xs mt-1 max-w-md text-center">{diagramError}</p>
                                {diagramRawCode && (
                                  <div className="mt-4 w-full max-w-2xl">
                                    <p className="text-xs font-medium mb-2">Raw Mermaid Code:</p>
                                    <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border border-border overflow-auto max-h-64">
                                      {diagramRawCode}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <GitBranch className="w-8 h-8 mb-2 opacity-50" />
                                <p className="text-sm">No diagram available</p>
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Select a file to view documentation</p>
                    <p className="text-sm mt-1">Choose a file from the sidebar</p>
                  </div>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      </div>
    </div>
  );
};

export default DocumentationPage;
