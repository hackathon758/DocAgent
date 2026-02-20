import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  Cpu,
  Download,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Cloud,
  HardDrive,
  RefreshCw,
  ExternalLink,
  Terminal,
  Loader2,
  Sparkles,
  Code,
  MessageSquare,
  Send
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ModelsPage = () => {
  const [modelsData, setModelsData] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState({});
  const [installGuide, setInstallGuide] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    try {
      const [modelsRes, statusRes] = await Promise.all([
        axios.get(`${API_URL}/api/models`),
        axios.get(`${API_URL}/api/models/status`)
      ]);
      setModelsData(modelsRes.data);
      setStatus(statusRes.data);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      toast.error('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
    const interval = setInterval(fetchModels, 5000); // Poll for updates
    return () => clearInterval(interval);
  }, [fetchModels]);

  const fetchInstallGuide = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/models/ollama/install-guide`);
      setInstallGuide(response.data);
    } catch (error) {
      console.error('Failed to fetch install guide:', error);
    }
  };

  const handleDownload = async (modelId) => {
    setDownloading(prev => ({ ...prev, [modelId]: true }));
    try {
      await axios.post(`${API_URL}/api/models/download/${encodeURIComponent(modelId)}`);
      toast.success(`Started downloading ${modelId}`);

      // Poll for progress
      const pollProgress = setInterval(async () => {
        try {
          const response = await axios.get(`${API_URL}/api/models/download/${encodeURIComponent(modelId)}/progress`);
          if (response.data.status === 'completed') {
            clearInterval(pollProgress);
            setDownloading(prev => ({ ...prev, [modelId]: false }));
            toast.success(`${modelId} downloaded successfully!`);
            fetchModels();
          } else if (response.data.status === 'failed') {
            clearInterval(pollProgress);
            setDownloading(prev => ({ ...prev, [modelId]: false }));
            toast.error(`Failed to download ${modelId}`);
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 2000);
    } catch (error) {
      setDownloading(prev => ({ ...prev, [modelId]: false }));
      toast.error(error.response?.data?.detail || 'Failed to start download');
      if (error.response?.data?.detail?.includes('Ollama')) {
        fetchInstallGuide();
      }
    }
  };

  const handleDelete = async (modelId) => {
    if (!window.confirm(`Are you sure you want to delete ${modelId}?`)) return;

    try {
      await axios.delete(`${API_URL}/api/models/${encodeURIComponent(modelId)}`);
      toast.success(`${modelId} deleted`);
      fetchModels();
    } catch (error) {
      toast.error('Failed to delete model');
    }
  };

  const handleChat = async () => {
    if (!chatMessage.trim() || !selectedModel) return;

    const userMessage = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/models/chat/${encodeURIComponent(selectedModel.id)}`,
        { content: userMessage }
      );
      setChatHistory(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      toast.error('Failed to get response');
      setChatHistory(prev => [...prev, { role: 'assistant', content: 'Error: Failed to get response' }]);
    } finally {
      setChatLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="AI Models" />

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status?.ollama_running ? 'bg-green-500/10' : 'bg-red-500/10'
                      }`}>
                      <HardDrive className={`w-5 h-5 ${status?.ollama_running ? 'text-green-400' : 'text-red-400'
                        }`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ollama Status</p>
                      <p className="font-medium">
                        {status?.ollama_running ? 'Running' : 'Not Running'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Download className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Downloaded Models</p>
                      <p className="font-medium">{status?.installed_model_count || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status?.bytez_configured ? 'bg-green-500/10' : 'bg-yellow-500/10'
                      }`}>
                      <Cloud className={`w-5 h-5 ${status?.bytez_configured ? 'text-green-400' : 'text-yellow-400'
                        }`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cloud API</p>
                      <p className="font-medium">
                        {status?.bytez_configured ? 'Connected' : 'Not Configured'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Install Guide Banner */}
            {!status?.ollama_running && (
              <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Terminal className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-bold text-lg mb-2">Install Ollama to Run Local Models</h3>
                      <p className="text-muted-foreground mb-4">
                        Ollama allows you to download and run powerful AI models locally on your machine for free.
                        No API keys or cloud services required!
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <a href="https://ollama.ai/download" target="_blank" rel="noopener noreferrer">
                          <Button>
                            <Download className="w-4 h-4 mr-2" />
                            Download Ollama
                          </Button>
                        </a>
                        <Button variant="outline" className="border-white/10" onClick={fetchInstallGuide}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Installation Guide
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Install Guide Modal */}
            <AnimatePresence>
              {installGuide && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  onClick={() => setInstallGuide(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                    className="bg-card rounded-xl p-6 max-w-lg w-full border border-white/10"
                    onClick={e => e.stopPropagation()}
                  >
                    <h3 className="font-heading font-bold text-xl mb-4">{installGuide.title}</h3>
                    <p className="text-muted-foreground mb-4">{installGuide.description}</p>

                    <div className="space-y-4 mb-6">
                      {Object.entries(installGuide.platforms || {}).map(([platform, info]) => (
                        <div key={platform} className="p-4 bg-muted/30 rounded-lg">
                          <p className="font-medium capitalize mb-2">{platform}</p>
                          <code className="text-sm text-primary bg-black/30 px-2 py-1 rounded">
                            {info.command}
                          </code>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setInstallGuide(null)}>Close</Button>
                      <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
                        <Button>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Visit Ollama.ai
                        </Button>
                      </a>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Models Tabs */}
            <Tabs defaultValue="local" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="local" className="gap-2">
                  <HardDrive className="w-4 h-4" />
                  Local Models
                </TabsTrigger>
                <TabsTrigger value="cloud" className="gap-2">
                  <Cloud className="w-4 h-4" />
                  Cloud Models
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Test Models
                </TabsTrigger>
              </TabsList>

              {/* Local Models */}
              <TabsContent value="local">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modelsData?.local_models?.map((model) => (
                    <motion.div
                      key={model.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className={`bg-card border-white/5 h-full ${model.installed ? 'ring-1 ring-green-500/30' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Cpu className="w-5 h-5 text-primary" />
                              <CardTitle className="text-base">{model.name}</CardTitle>
                            </div>
                            {model.installed && (
                              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Installed
                              </span>
                            )}
                          </div>
                          <CardDescription className="text-xs">{model.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap gap-1">
                            {model.tasks?.map((task) => (
                              <span key={task} className="text-xs bg-muted px-2 py-1 rounded">
                                {task}
                              </span>
                            ))}
                          </div>

                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Size:</span> {model.size}
                          </div>

                          {model.downloading && (
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Downloading...</span>
                                <span className="text-xs">{model.download_progress || 0}%</span>
                              </div>
                              <Progress value={model.download_progress || 0} className="h-1" />
                            </div>
                          )}

                          <div className="flex gap-2">
                            {model.installed ? (
                              <>
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    setSelectedModel(model);
                                    setChatHistory([]);
                                  }}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  Test
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/10"
                                  onClick={() => handleDelete(model.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleDownload(model.id)}
                                disabled={downloading[model.id] || model.downloading || !status?.ollama_running}
                              >
                                {downloading[model.id] || model.downloading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                    Downloading...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4 mr-1" />
                                    Download
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              {/* Cloud Models */}
              <TabsContent value="cloud">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modelsData?.cloud_models?.map((model) => (
                    <Card key={model.id} className="bg-card border-white/5">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Cloud className="w-5 h-5 text-blue-400" />
                          <CardTitle className="text-base">{model.name}</CardTitle>
                        </div>
                        <CardDescription>{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1 mb-4">
                          {model.tasks?.map((task) => (
                            <span key={task} className="text-xs bg-muted px-2 py-1 rounded">
                              {task}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-sm text-green-400">Available via Bytez API</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* Test Chat */}
              <TabsContent value="chat">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      Test Local Models
                    </CardTitle>
                    <CardDescription>
                      Chat with downloaded models to test their capabilities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!status?.ollama_running ? (
                      <div className="text-center py-8">
                        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Ollama is not running. Please install and start Ollama first.</p>
                      </div>
                    ) : modelsData?.installed_models?.length === 0 ? (
                      <div className="text-center py-8">
                        <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No models downloaded. Download a model to start chatting.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex gap-2 flex-wrap">
                          {modelsData?.installed_models?.map((model) => (
                            <Button
                              key={model.name}
                              size="sm"
                              variant={selectedModel?.id === model.name ? 'default' : 'outline'}
                              className="border-white/10"
                              onClick={() => {
                                setSelectedModel({ id: model.name, name: model.name });
                                setChatHistory([]);
                              }}
                            >
                              {model.name}
                            </Button>
                          ))}
                        </div>

                        {selectedModel && (
                          <>
                            <ScrollArea className="h-[400px] border border-white/10 rounded-lg p-4">
                              {chatHistory.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                  <Sparkles className="w-8 h-8 mx-auto mb-2" />
                                  <p>Start a conversation with {selectedModel.name}</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {chatHistory.map((msg, i) => (
                                    <div
                                      key={i}
                                      className={`p-3 rounded-lg ${msg.role === 'user'
                                          ? 'bg-primary/10 ml-8'
                                          : 'bg-muted/30 mr-8'
                                        }`}
                                    >
                                      <p className="text-xs font-medium mb-1 text-muted-foreground">
                                        {msg.role === 'user' ? 'You' : selectedModel.name}
                                      </p>
                                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                  ))}
                                  {chatLoading && (
                                    <div className="bg-muted/30 mr-8 p-3 rounded-lg">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    </div>
                                  )}
                                </div>
                              )}
                            </ScrollArea>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                                placeholder={`Message ${selectedModel.name}...`}
                                className="flex-1 h-10 px-4 rounded-lg bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                              />
                              <Button onClick={handleChat} disabled={chatLoading || !chatMessage.trim()}>
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ModelsPage;
