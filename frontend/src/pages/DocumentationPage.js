import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  FileText, FolderGit2, Code, Eye, Copy, Download, Search, Filter,
  ChevronRight, ChevronDown, File, Folder, AlertCircle, GitBranch, Clock
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
  const { user } = useAuth();
  const { theme } = useTheme();
  const [documentation, setDocumentation] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('docstring');
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});

  useEffect(() => {
    fetchDocumentation();
  }, []);

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

  const renderMermaidDiagram = useCallback(async (mermaidCode) => {
    if (!mermaidCode) return;
    
    setDiagramError(null);
    setDiagramSvg('');
    
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });
      
      let cleanCode = mermaidCode.replace(/\\n/g, '\n').replace(/\\t/g, '  ').trim();
      const uniqueId = `mermaid-diagram-${Date.now()}`;
      const { svg } = await mermaid.render(uniqueId, cleanCode);
      setDiagramSvg(svg);
    } catch (error) {
      console.error('Mermaid render error:', error);
      setDiagramError(error.message || 'Failed to render diagram');
    }
  }, [theme]);

  const fetchDocumentation = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/documentation`);
      setDocumentation(response.data);
      if (!docId && response.data.length > 0) {
        setSelectedDoc(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch documentation:', error);
      toast.error('Failed to load documentation');
    } finally {
      setLoading(false);
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
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                      selectedDoc?.id === doc.id
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
                <ScrollArea className="flex-1">
                  <div className="p-2">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : documentation.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No documentation yet</p>
                        <Link to="/generate">
                          <Button size="sm" className="mt-4">Generate Docs</Button>
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
                        <h2 className="text-lg font-semibold">{selectedDoc.component_path}</h2>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Code className="w-3.5 h-3.5" />
                            {selectedDoc.language || 'Unknown'}
                          </span>
                          {selectedDoc.quality_score && (
                            <span className="flex items-center gap-1">
                              Quality: {selectedDoc.quality_score}%
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
                        <TabsTrigger value="docstring">Docstring</TabsTrigger>
                        <TabsTrigger value="markdown">Documentation</TabsTrigger>
                        <TabsTrigger value="diagram">Diagram</TabsTrigger>
                      </TabsList>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <TabsContent value="docstring" className="h-full m-0 p-0">
                        <Editor
                          height="100%"
                          language={selectedDoc.language || 'python'}
                          value={selectedDoc.docstring || '# No docstring available'}
                          theme={theme === 'dark' ? 'vs-dark' : 'light'}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            padding: { top: 16 },
                            wordWrap: 'on',
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="markdown" className="h-full m-0">
                        <ScrollArea className="h-full">
                          <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                            {selectedDoc.markdown ? (
                              <div dangerouslySetInnerHTML={{ __html: selectedDoc.markdown }} />
                            ) : (
                              <p className="text-muted-foreground">No documentation available</p>
                            )}
                          </div>
                        </ScrollArea>
                      </TabsContent>

                      <TabsContent value="diagram" className="h-full m-0">
                        <ScrollArea className="h-full">
                          <div className="p-6">
                            {diagramSvg ? (
                              <div
                                className="flex justify-center"
                                dangerouslySetInnerHTML={{ __html: diagramSvg }}
                              />
                            ) : diagramError ? (
                              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <AlertCircle className="w-8 h-8 mb-2" />
                                <p className="text-sm">Failed to render diagram</p>
                                <p className="text-xs mt-1">{diagramError}</p>
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
