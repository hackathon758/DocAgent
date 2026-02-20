import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  FileText,
  FolderGit2,
  Settings,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  Github,
  GitBranch,
  Code,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  LayoutGrid,
  List,
  Webhook,
  Link2,
  ArrowRight,
  ChevronRight,
  Upload,
  FolderOpen,
  Globe,
  Loader2,
  FileCode
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Provider icons and colors
const providers = {
  github: { 
    name: 'GitHub', 
    icon: Github, 
    color: 'bg-gray-800 hover:bg-gray-700',
    description: 'Connect your GitHub repositories'
  },
  gitlab: { 
    name: 'GitLab', 
    icon: Globe, 
    color: 'bg-orange-600 hover:bg-orange-500',
    description: 'Connect your GitLab repositories'
  },
  bitbucket: { 
    name: 'Bitbucket', 
    icon: Globe, 
    color: 'bg-blue-600 hover:bg-blue-500',
    description: 'Connect your Bitbucket repositories'
  }
};

const RepositoriesPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConnectWizard, setShowConnectWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProvider, setFilterProvider] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [connecting, setConnecting] = useState(false);
  
  // Manual repo form
  const [formData, setFormData] = useState({
    name: '',
    repo_url: '',
    provider: 'github',
    branch: 'main',
    language: 'python'
  });

  // Mock available repos after OAuth
  const [availableRepos, setAvailableRepos] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState([]);

  // File upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef(null);

  const ALLOWED_EXTENSIONS = ['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.go', '.cpp', '.c', '.cs', '.rs', '.rb', '.php', '.swift', '.kt', '.zip'];

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/repositories`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepositories(response.data);
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
      toast.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = (provider) => {
    setSelectedProvider(provider);
    setConnecting(true);
    
    // Simulate OAuth flow - in production this would redirect to OAuth provider
    setTimeout(() => {
      // Mock available repos after OAuth
      const mockRepos = [
        { id: 1, name: 'my-awesome-project', full_name: 'user/my-awesome-project', language: 'Python', stars: 125, updated: '2 days ago' },
        { id: 2, name: 'react-dashboard', full_name: 'user/react-dashboard', language: 'TypeScript', stars: 89, updated: '1 week ago' },
        { id: 3, name: 'api-service', full_name: 'user/api-service', language: 'JavaScript', stars: 45, updated: '3 days ago' },
        { id: 4, name: 'ml-pipeline', full_name: 'user/ml-pipeline', language: 'Python', stars: 234, updated: '5 hours ago' },
        { id: 5, name: 'docs-generator', full_name: 'user/docs-generator', language: 'Go', stars: 67, updated: '1 day ago' },
      ];
      setAvailableRepos(mockRepos);
      setConnecting(false);
      setWizardStep(2);
    }, 2000);
  };

  const toggleRepoSelection = (repoId) => {
    setSelectedRepos(prev => 
      prev.includes(repoId) 
        ? prev.filter(id => id !== repoId)
        : [...prev, repoId]
    );
  };

  const handleImportRepos = async () => {
    setConnecting(true);

    try {
      const reposToImport = availableRepos.filter(r => selectedRepos.includes(r.id));
      const createdRepos = [];

      for (const repo of reposToImport) {
        const response = await axios.post(`${API_URL}/api/repositories`, {
          name: repo.name,
          repo_url: `https://github.com/${repo.full_name}`,
          provider: selectedProvider,
          branch: 'main',
          language: repo.language.toLowerCase(),
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        createdRepos.push(response.data);
      }

      setRepositories([...repositories, ...createdRepos]);
      setShowConnectWizard(false);
      setWizardStep(1);
      setSelectedProvider(null);
      setSelectedRepos([]);
      toast.success(`Successfully imported ${createdRepos.length} repositories`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to import repositories');
    } finally {
      setConnecting(false);
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setConnecting(true);
    
    try {
      const response = await axios.post(`${API_URL}/api/repositories`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepositories([...repositories, response.data]);
      setShowConnectWizard(false);
      setWizardStep(1);
      setFormData({ name: '', repo_url: '', provider: 'github', branch: 'main', language: 'python' });
      toast.success('Repository added successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add repository');
    } finally {
      setConnecting(false);
    }
  };

  const handleDeleteRepository = async (repoId) => {
    if (!window.confirm('Are you sure you want to delete this repository?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/repositories/${repoId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepositories(repositories.filter(r => r.id !== repoId));
      toast.success('Repository deleted');
    } catch (error) {
      toast.error('Failed to delete repository');
    }
  };

  const handleSyncRepo = async (repoId) => {
    toast.info('Syncing repository...');
    try {
      const response = await axios.post(`${API_URL}/api/repositories/${repoId}/sync`, null, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRepositories(repositories.map(r =>
        r.id === repoId
          ? { ...r, last_synced_at: response.data.last_synced_at, components_count: response.data.components_count, status: 'synced' }
          : r
      ));
      toast.success('Repository synced successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync repository');
    }
  };

  // ===== FILE UPLOAD =====
  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    });
    if (files.length === 0) {
      toast.error('No supported files found. Allowed: ' + ALLOWED_EXTENSIONS.join(', '));
      return;
    }
    setUploadFiles(prev => [...prev, ...files]);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      return ALLOWED_EXTENSIONS.includes(ext);
    });
    setUploadFiles(prev => [...prev, ...files]);
  };

  const removeUploadFile = (index) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', uploadFiles[i]);

        await axios.post(`${API_URL}/api/documentation/upload`, formDataUpload, {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${token}`,
          },
        });
        setUploadProgress(Math.round(((i + 1) / uploadFiles.length) * 100));
      }

      toast.success(`Uploaded ${uploadFiles.length} file(s) for documentation generation`);
      setUploadFiles([]);
      setShowConnectWizard(false);
      setWizardStep(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const filteredRepos = repositories.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProvider = filterProvider === 'all' || repo.provider === filterProvider;
    return matchesSearch && matchesProvider;
  });

  const languages = ['python', 'javascript', 'typescript', 'java', 'go', 'rust', 'cpp', 'csharp'];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopBar title="Repositories" />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Your Repositories</h1>
                <p className="text-muted-foreground mt-1">Connect and manage your code repositories</p>
              </div>
              <Button onClick={() => setShowConnectWizard(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Connect Repository
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search repositories..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-muted/50 border-white/10"
                  />
                </div>
                <Select value={filterProvider} onValueChange={setFilterProvider}>
                  <SelectTrigger className="w-40 bg-muted/50 border-white/10">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="gitlab">GitLab</SelectItem>
                    <SelectItem value="bitbucket">Bitbucket</SelectItem>
                  </SelectContent>
                </Select>
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
            </div>

            {/* Repository Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <FolderGit2 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No repositories yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Connect your first repository to start generating AI-powered documentation
                  </p>
                  <Button onClick={() => setShowConnectWizard(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Connect Repository
                  </Button>
                </CardContent>
              </Card>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {filteredRepos.map((repo) => (
                    <motion.div
                      key={repo.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="group hover:border-primary/50 transition-all duration-300">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                repo.provider === 'github' ? 'bg-gray-800' :
                                repo.provider === 'gitlab' ? 'bg-orange-600' : 'bg-blue-600'
                              }`}>
                                <Github className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{repo.name}</CardTitle>
                                <CardDescription className="text-xs capitalize">{repo.provider}</CardDescription>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Settings className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => window.open(repo.repo_url, '_blank')}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Open in {repo.provider}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSyncRepo(repo.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Sync Now
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/documentation?repo=${repo.id}`)}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  View Documentation
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteRepository(repo.id)}
                                  className="text-red-400"
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <GitBranch className="w-4 h-4" />
                                {repo.branch}
                              </span>
                              <span className="flex items-center gap-1">
                                <Code className="w-4 h-4" />
                                {repo.language}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                <FileText className="w-3 h-3 mr-1" />
                                {repo.components_count || 0} components
                              </Badge>
                              {repo.webhook_active && (
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-400 border-green-500/30">
                                  <Webhook className="w-3 h-3 mr-1" />
                                  Webhook
                                </Badge>
                              )}
                            </div>

                            {repo.last_synced_at && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                Last synced: {new Date(repo.last_synced_at).toLocaleDateString()}
                              </div>
                            )}

                            <div className="pt-3 border-t border-white/5">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Coverage</span>
                                <span className="text-xs font-medium">{repo.coverage_percentage || 0}%</span>
                              </div>
                              <Progress value={repo.coverage_percentage || 0} className="h-1.5" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              // List View
              <Card className="bg-card border-white/5">
                <div className="divide-y divide-white/5">
                  {filteredRepos.map((repo) => (
                    <div key={repo.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            repo.provider === 'github' ? 'bg-gray-800' :
                            repo.provider === 'gitlab' ? 'bg-orange-600' : 'bg-blue-600'
                          }`}>
                            <Github className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">{repo.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {repo.provider} • {repo.branch} • {repo.language}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-medium">{repo.coverage_percentage || 0}%</p>
                            <p className="text-xs text-muted-foreground">Coverage</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">{repo.components_count || 0}</p>
                            <p className="text-xs text-muted-foreground">Components</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleSyncRepo(repo.id)}>
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/documentation?repo=${repo.id}`)}>
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteRepository(repo.id)} className="text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>

      {/* Connect Repository Wizard */}
      <Dialog open={showConnectWizard} onOpenChange={setShowConnectWizard}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Connect Repository</DialogTitle>
            <DialogDescription>
              {wizardStep === 1 && 'Choose how you want to connect your repository'}
              {wizardStep === 2 && `Select repositories from ${selectedProvider}`}
              {wizardStep === 3 && 'Configure repository settings'}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  wizardStep >= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {wizardStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <ChevronRight className={`w-4 h-4 mx-2 ${wizardStep > step ? 'text-primary' : 'text-muted-foreground'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Choose Provider */}
          {wizardStep === 1 && (
            <Tabs defaultValue="oauth" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="oauth">OAuth Connect</TabsTrigger>
                <TabsTrigger value="manual">Manual URL</TabsTrigger>
                <TabsTrigger value="upload">Upload Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="oauth" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(providers).map(([key, provider]) => (
                    <Button
                      key={key}
                      variant="outline"
                      className={`h-auto p-4 justify-start gap-4 border-white/10 hover:border-primary/50 ${
                        connecting && selectedProvider === key ? 'border-primary' : ''
                      }`}
                      onClick={() => handleOAuthConnect(key)}
                      disabled={connecting}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${provider.color}`}>
                        <provider.icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium">Connect with {provider.name}</p>
                        <p className="text-sm text-muted-foreground">{provider.description}</p>
                      </div>
                      {connecting && selectedProvider === key ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <ArrowRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </Button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <form onSubmit={handleManualAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Repository Name</Label>
                    <Input
                      placeholder="my-awesome-project"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Repository URL</Label>
                    <Input
                      placeholder="https://github.com/username/repo"
                      value={formData.repo_url}
                      onChange={(e) => setFormData({ ...formData, repo_url: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <Select value={formData.provider} onValueChange={(v) => setFormData({ ...formData, provider: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="github">GitHub</SelectItem>
                          <SelectItem value="gitlab">GitLab</SelectItem>
                          <SelectItem value="bitbucket">Bitbucket</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Branch</Label>
                      <Input
                        placeholder="main"
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang} value={lang} className="capitalize">
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowConnectWizard(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={connecting}>
                      {connecting ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        'Add Repository'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ALLOWED_EXTENSIONS.join(',')}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="font-medium">Drag & drop code files here</p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supported: {ALLOWED_EXTENSIONS.join(', ')} (max 10MB each)
                    </p>
                  </div>

                  {uploadFiles.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {uploadFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeUploadFile(idx)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {uploading && (
                    <div className="space-y-2">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">{uploadProgress}% uploaded</p>
                    </div>
                  )}

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowConnectWizard(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleFileUpload} disabled={uploadFiles.length === 0 || uploading}>
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload {uploadFiles.length} File{uploadFiles.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Step 2: Select Repositories */}
          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search repositories..." className="pl-10" />
              </div>
              
              <div className="border border-white/10 rounded-lg max-h-64 overflow-y-auto">
                {availableRepos.map((repo) => (
                  <div
                    key={repo.id}
                    onClick={() => toggleRepoSelection(repo.id)}
                    className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 border-b border-white/5 last:border-0 ${
                      selectedRepos.includes(repo.id) ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedRepos.includes(repo.id) ? 'bg-primary border-primary' : 'border-white/20'
                    }`}>
                      {selectedRepos.includes(repo.id) && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <FolderGit2 className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{repo.name}</p>
                      <p className="text-xs text-muted-foreground">{repo.full_name}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">{repo.language}</Badge>
                  </div>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                {selectedRepos.length} repositories selected
              </p>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setWizardStep(1); setSelectedProvider(null); }}>
                  Back
                </Button>
                <Button onClick={handleImportRepos} disabled={selectedRepos.length === 0 || connecting}>
                  {connecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Import {selectedRepos.length} Repositories
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepositoriesPage;
