import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import mermaid from 'mermaid';
import { FileText, Code, GitBranch, Clock, AlertCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

mermaid.initialize({ startOnLoad: false, theme: 'default' });

const SharedDocumentPage = () => {
  const { token } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('markdown');
  const [diagramSvg, setDiagramSvg] = useState('');

  useEffect(() => {
    const fetchSharedDoc = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/shared/${token}`);
        setDoc(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('not_found');
        } else if (err.response?.status === 410) {
          setError('expired');
        } else {
          setError('error');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSharedDoc();
  }, [token]);

  // Render mermaid diagram
  useEffect(() => {
    if (!doc?.metadata?.diagram) return;
    const renderDiagram = async () => {
      try {
        const id = `shared-diagram-${Date.now()}`;
        const code = doc.metadata.diagram.replace(/```mermaid\n?/g, '').replace(/```/g, '').trim();
        const { svg } = await mermaid.render(id, code);
        setDiagramSvg(svg);
      } catch (err) {
        // silently fail
      }
    };
    renderDiagram();
  }, [doc]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {error === 'not_found' && 'Document Not Found'}
            {error === 'expired' && 'Link Expired'}
            {error === 'error' && 'Something Went Wrong'}
          </h1>
          <p className="text-muted-foreground">
            {error === 'not_found' && 'This shared document link is invalid or has been revoked.'}
            {error === 'expired' && 'This shared document link has expired. Ask the owner to generate a new one.'}
            {error === 'error' && 'An error occurred while loading the document. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {doc?.component_path || 'Shared Documentation'}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                {doc?.language && (
                  <Badge variant="secondary" className="text-xs">
                    <Code className="w-3 h-3 mr-1" />
                    {doc.language}
                  </Badge>
                )}
                {doc?.metadata?.quality_score && (
                  <Badge variant="outline" className="text-xs">
                    Quality: {doc.metadata.quality_score}%
                  </Badge>
                )}
                {doc?.updated_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(doc.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        <Card>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-6 pt-4 border-b border-border">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="docstring">Docstring</TabsTrigger>
                  <TabsTrigger value="markdown">Documentation</TabsTrigger>
                  <TabsTrigger value="diagram">Diagram</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="docstring" className="m-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-6">
                    <pre className="bg-muted/30 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
                      {doc?.docstring || 'No docstring available'}
                    </pre>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="markdown" className="m-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-6 prose prose-sm dark:prose-invert max-w-none">
                    {doc?.markdown ? (
                      <div dangerouslySetInnerHTML={{ __html: doc.markdown }} />
                    ) : (
                      <p className="text-muted-foreground">No documentation available</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="diagram" className="m-0">
                <ScrollArea className="h-[600px]">
                  <div className="p-6">
                    {diagramSvg ? (
                      <div
                        className="flex justify-center"
                        dangerouslySetInnerHTML={{ __html: diagramSvg }}
                      />
                    ) : (
                      <div className="text-center text-muted-foreground py-12">
                        <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No diagram available</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        Powered by <span className="font-semibold text-primary">DocAgent</span>
      </footer>
    </div>
  );
};

export default SharedDocumentPage;
