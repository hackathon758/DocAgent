import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';
import { Save, Download, GitBranch, Image } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const TEMPLATES = {
  flowchart: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  sequence: `sequenceDiagram
    participant A as Client
    participant B as Server
    A->>B: Request
    B-->>A: Response`,
  class: `classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    Animal <|-- Dog`,
  state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : Start
    Processing --> Done : Complete
    Processing --> Error : Fail
    Error --> Idle : Reset
    Done --> [*]`,
};

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' });

const DiagramEditorPage = () => {
  const { diagramId } = useParams();
  const { user } = useAuth();
  const { theme } = useTheme();
  const [mermaidCode, setMermaidCode] = useState(TEMPLATES.flowchart);
  const [diagramSvg, setDiagramSvg] = useState('');
  const [diagramError, setDiagramError] = useState('');
  const [loading, setLoading] = useState(!!diagramId);
  const [saving, setSaving] = useState(false);
  const renderTimeout = useRef(null);

  // Load diagram from API
  useEffect(() => {
    if (!diagramId) return;
    const loadDiagram = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/diagrams/${diagramId}`);
        if (res.data?.content) {
          setMermaidCode(res.data.content);
        }
      } catch (err) {
        toast.error('Failed to load diagram');
      } finally {
        setLoading(false);
      }
    };
    loadDiagram();
  }, [diagramId]);

  // Render mermaid preview with debounce
  const renderDiagram = useCallback(async (code) => {
    if (!code?.trim()) {
      setDiagramSvg('');
      setDiagramError('');
      return;
    }
    try {
      const id = `mermaid-preview-${Date.now()}`;
      const { svg } = await mermaid.render(id, code.trim());
      setDiagramSvg(svg);
      setDiagramError('');
    } catch (err) {
      setDiagramError(err.message || 'Failed to render diagram');
      setDiagramSvg('');
    }
  }, []);

  useEffect(() => {
    if (renderTimeout.current) clearTimeout(renderTimeout.current);
    renderTimeout.current = setTimeout(() => renderDiagram(mermaidCode), 500);
    return () => clearTimeout(renderTimeout.current);
  }, [mermaidCode, renderDiagram]);

  const handleSave = async () => {
    if (!diagramId) {
      toast.info('No diagram ID to save to');
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/diagrams/${diagramId}`, { content: mermaidCode });
      toast.success('Diagram saved');
    } catch (err) {
      toast.error('Failed to save diagram');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateChange = (template) => {
    if (TEMPLATES[template]) {
      setMermaidCode(TEMPLATES[template]);
    }
  };

  const handleExportSVG = () => {
    if (!diagramSvg) return;
    const blob = new Blob([diagramSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    if (!diagramSvg) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    const svgBlob = new Blob([diagramSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'diagram.png';
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar title="Diagram Editor" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Diagram Editor" />

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-border bg-card/30 flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving || !diagramId} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </Button>

          <Select onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Insert template..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="flowchart">Flowchart</SelectItem>
              <SelectItem value="sequence">Sequence Diagram</SelectItem>
              <SelectItem value="class">Class Diagram</SelectItem>
              <SelectItem value="state">State Diagram</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" size="sm" onClick={handleExportSVG} disabled={!diagramSvg} className="gap-2">
            <Download className="w-4 h-4" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPNG} disabled={!diagramSvg} className="gap-2">
            <Image className="w-4 h-4" />
            PNG
          </Button>
        </div>

        {/* Split Editor / Preview */}
        <main className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-border bg-muted/30">
                  <Badge variant="secondary" className="text-xs">Mermaid Code</Badge>
                </div>
                <div className="flex-1">
                  <Editor
                    height="100%"
                    language="plaintext"
                    value={mermaidCode}
                    onChange={(value) => setMermaidCode(value || '')}
                    theme={theme === 'dark' ? 'vs-dark' : 'light'}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      padding: { top: 16 },
                    }}
                  />
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={30}>
              <div className="h-full flex flex-col">
                <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">Live Preview</Badge>
                  {diagramError && (
                    <Badge variant="destructive" className="text-xs">Error</Badge>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-6">
                  {diagramSvg ? (
                    <div
                      className="flex justify-center items-start"
                      dangerouslySetInnerHTML={{ __html: diagramSvg }}
                    />
                  ) : diagramError ? (
                    <div className="text-center text-muted-foreground py-12">
                      <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium">Diagram Error</p>
                      <p className="text-xs mt-1 max-w-md mx-auto">{diagramError}</p>
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Enter Mermaid code to see a preview</p>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      </div>
    </div>
  );
};

export default DiagramEditorPage;
