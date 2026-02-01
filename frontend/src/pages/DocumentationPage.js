import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  Settings,
  Home,
  Zap,
  Code,
  Eye,
  Copy,
  Download,
  ChevronLeft,
  Star,
  Clock,
  Search,
  Filter,
  LayoutGrid,
  List,
  Cpu,
  AlertCircle
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Initialize mermaid with proper configuration for dark theme
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

const DocumentationPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documentation, setDocumentation] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repositories, setRepositories] = useState([]);
  const [filterRepo, setFilterRepo] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const diagramContainerRef = useRef(null);

  useEffect(() => {
    fetchDocumentation();
    fetchRepositories();
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
  }, [selectedDoc]);

  // Render Mermaid diagram using mermaid.render() for proper SVG output
  const renderMermaidDiagram = useCallback(async (mermaidCode) => {
    if (!mermaidCode) return;
    
    setDiagramLoading(true);
    setDiagramError(null);
    setDiagramSvg('');
    
    try {
      // Clean up the mermaid code - replace escaped newlines with actual newlines
      let cleanCode = mermaidCode
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '  ')
        .trim();
      
      // Generate unique ID for this render
      const uniqueId = `mermaid-diagram-${Date.now()}`;
      
      // Use mermaid.render() to generate SVG
      const { svg } = await mermaid.render(uniqueId, cleanCode);
      
      setDiagramSvg(svg);
    } catch (error) {
      console.error('Mermaid render error:', error);
      setDiagramError(error.message || 'Failed to render diagram');
      
      // Still show the raw code in case of error
      setDiagramSvg('');
    } finally {
      setDiagramLoading(false);
    }
  }, []);

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

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/repositories`);
      setRepositories(response.data);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
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

  const filteredDocs = documentation.filter(doc => {
    const matchesRepo = filterRepo === 'all' || doc.repository_id === filterRepo;
    const matchesSearch = searchTerm === '' || 
      doc.component_path.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesRepo && matchesSearch;
  });

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/models', icon: Cpu, label: 'AI Models' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-card/50 flex flex-col">
        <div className="p-6 border-b border-white/5">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl">DocAgent</span>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}]
          </ul>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-card/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="font-heading text-xl font-bold">Documentation</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          {/* Documentation List */}
          <div className="w-80 border-r border-white/5 flex flex-col">
            <div className="p-4 space-y-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <Select value={filterRepo} onValueChange={setFilterRepo}>
                <SelectTrigger className="w-full bg-muted/50 border-white/10">
                  <SelectValue placeholder="Filter by repository" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Repositories</SelectItem>
                  {repositories.map(repo => (
                    <SelectItem key={repo.id} value={repo.id}>{repo.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">No documentation found</p>
                    <Link to="/generate">
                      <Button>Generate Documentation</Button>
                    </Link>
                  </div>
                ) : (
                  filteredDocs.map((doc) => (
                    <motion.div
                      key={doc.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedDoc?.id === doc.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedDoc(doc);
                        navigate(`/documentation/${doc.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{doc.component_path}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {doc.component_type} • {doc.language}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <Star className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-muted-foreground">
                            {doc.quality_score?.toFixed(0) || 0}%
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Documentation Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedDoc ? (
              <>
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h2 className="font-heading font-bold text-lg">{selectedDoc.component_path}</h2>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Code className="w-4 h-4" />
                        {selectedDoc.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        {selectedDoc.quality_score?.toFixed(1) || 0}% quality
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        v{selectedDoc.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(selectedDoc.docstring || '')}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadDoc}>
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>

                <Tabs defaultValue="markdown" className="flex-1 flex flex-col">
                  <TabsList className="mx-4 mt-4 w-fit">
                    <TabsTrigger value="markdown">Documentation</TabsTrigger>
                    <TabsTrigger value="docstring">Docstring</TabsTrigger>
                    <TabsTrigger value="diagram">Diagram</TabsTrigger>
                  </TabsList>

                  <TabsContent value="markdown" className="flex-1 overflow-auto p-4">
                    <Card className="bg-card border-white/5">
                      <CardContent className="p-6 prose prose-invert max-w-none">
                        <div 
                          className="markdown-content"
                          dangerouslySetInnerHTML={{ 
                            __html: selectedDoc.markdown?.replace(/\n/g, '<br/>') || 'No documentation available' 
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="docstring" className="flex-1 overflow-hidden p-4">
                    <Card className="bg-card border-white/5 h-full">
                      <CardContent className="p-0 h-full">
                        <Editor
                          height="100%"
                          language={selectedDoc.language || 'python'}
                          value={selectedDoc.docstring || '# No docstring available'}
                          theme="vs-dark"
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                          }}
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="diagram" className="flex-1 overflow-auto p-4">
                    <Card className="bg-card border-white/5">
                      <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm">
                          {selectedDoc.diagrams?.[0]?.diagram_type || 'Flowchart'} Diagram
                        </CardTitle>
                        {selectedDoc.diagrams?.[0]?.mermaid_code && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => copyToClipboard(selectedDoc.diagrams[0].mermaid_code)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Mermaid Code
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent>
                        {selectedDoc.diagrams?.[0]?.mermaid_code ? (
                          <div className="space-y-4">
                            {/* Rendered Diagram */}
                            <div className="bg-muted/30 rounded-lg p-6 overflow-auto min-h-[200px]">
                              {diagramLoading ? (
                                <div className="flex items-center justify-center h-[200px]">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                  <span className="ml-3 text-muted-foreground">Rendering diagram...</span>
                                </div>
                              ) : diagramError ? (
                                <div className="flex flex-col items-center justify-center h-[200px] text-center">
                                  <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                                  <p className="text-red-400 font-medium mb-2">Failed to render diagram</p>
                                  <p className="text-muted-foreground text-sm max-w-md mb-4">{diagramError}</p>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => renderMermaidDiagram(selectedDoc.diagrams[0].mermaid_code)}
                                  >
                                    Retry Render
                                  </Button>
                                </div>
                              ) : diagramSvg ? (
                                <div 
                                  ref={diagramContainerRef}
                                  className="flex justify-center mermaid-container"
                                  dangerouslySetInnerHTML={{ __html: diagramSvg }}
                                />
                              ) : (
                                <div className="flex items-center justify-center h-[200px]">
                                  <p className="text-muted-foreground">Click to render diagram</p>
                                </div>
                              )}
                            </div>
                            
                            {/* Mermaid Source Code (collapsible) */}
                            <details className="bg-muted/20 rounded-lg">
                              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                                View Mermaid Source Code
                              </summary>
                              <div className="px-4 pb-4">
                                <pre className="bg-black/50 rounded-lg p-4 text-sm overflow-x-auto">
                                  <code className="text-green-400 whitespace-pre-wrap">
                                    {selectedDoc.diagrams[0].mermaid_code.replace(/\\n/g, '\n')}
                                  </code>
                                </pre>
                              </div>
                            </details>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-center py-8">No diagram available</p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">Select a document to view</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocumentationPage;
