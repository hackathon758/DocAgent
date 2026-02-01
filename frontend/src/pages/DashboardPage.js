import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  Settings,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  LogOut,
  User,
  Bell,
  Search,
  Home,
  Github,
  Play,
  Download,
  Eye,
  Code,
  GitBranch,
  Bot
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Repository documentation state
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [documentation, setDocumentation] = useState(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleStartGeneration = async () => {
    if (!repoUrl.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    // Validate URL format
    const githubUrlPattern = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!githubUrlPattern.test(repoUrl)) {
      toast.error('Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo)');
      return;
    }

    setIsGenerating(true);
    setJobStatus(null);
    setDocumentation(null);

    try {
      const response = await axios.post(`${API_URL}/api/repo-documentation/start`, {
        repo_url: repoUrl,
        branch: branch
      });

      const jobId = response.data.job_id;
      setCurrentJobId(jobId);
      toast.success(`Started documentation generation for ${response.data.total_files} files`);

      // Start polling for status
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/api/repo-documentation/status/${jobId}`);
          setJobStatus(statusResponse.data);

          if (statusResponse.data.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setIsGenerating(false);
            toast.success('Documentation generated successfully!');
            
            // Fetch documentation preview
            const previewResponse = await axios.get(`${API_URL}/api/repo-documentation/preview/${jobId}`);
            setDocumentation(previewResponse.data.documentation);
          } else if (statusResponse.data.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsGenerating(false);
            toast.error(statusResponse.data.error || 'Documentation generation failed');
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 1500);

    } catch (error) {
      console.error('Start generation error:', error);
      toast.error(error.response?.data?.detail || 'Failed to start documentation generation');
      setIsGenerating(false);
    }
  };

  const handleExportDocx = async () => {
    if (!currentJobId) return;

    try {
      const response = await axios.get(`${API_URL}/api/repo-documentation/export/${currentJobId}`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${jobStatus?.repo_name || 'documentation'}_documentation.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Documentation exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export documentation');
    }
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const agents = [
    { id: 'reader', name: 'Reader Agent', icon: Code, description: 'Analyzing code structure' },
    { id: 'searcher', name: 'Searcher Agent', icon: Search, description: 'Gathering context' },
    { id: 'writer', name: 'Writer Agent', icon: FileText, description: 'Writing documentation' },
    { id: 'verifier', name: 'Verifier Agent', icon: CheckCircle2, description: 'Verifying quality' },
    { id: 'diagram', name: 'Diagram Agent', icon: GitBranch, description: 'Generating diagrams' },
  ];

  const getAgentStatus = (agentId) => {
    if (!jobStatus?.agents) return 'pending';
    return jobStatus.agents[agentId]?.status || 'pending';
  };

  const getAgentProgress = (agentId) => {
    if (!jobStatus?.agents) return 0;
    return jobStatus.agents[agentId]?.progress || 0;
  };

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
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    data-testid={`nav-${item.label.toLowerCase()}`}
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
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-1">Current Plan</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.subscription_tier || 'Free'} Tier</p>
            <Link to="/pricing">
              <Button variant="outline" size="sm" className="w-full mt-3 border-white/10">
                Upgrade
              </Button>
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/5 bg-card/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-foreground">Dashboard</h2>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2" data-testid="user-menu-btn">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400" data-testid="logout-btn">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
                Welcome back, {user?.name?.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                Generate comprehensive documentation for your repositories
              </p>
            </div>

            {/* GitHub Repository Input Section */}
            <Card className="bg-gradient-to-r from-card to-card/50 border-white/10 mb-8" data-testid="repo-input-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Github className="w-6 h-6 text-primary" />
                  Generate Repository Documentation
                </CardTitle>
                <CardDescription>
                  Enter a GitHub repository URL to automatically generate comprehensive documentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-2 block">Repository URL</label>
                    <div className="relative">
                      <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="https://github.com/owner/repository"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="pl-10 bg-muted/50 border-white/10 focus:border-primary"
                        disabled={isGenerating}
                        data-testid="repo-url-input"
                      />
                    </div>
                  </div>
                  <div className="w-32">
                    <label className="text-sm text-muted-foreground mb-2 block">Branch</label>
                    <Input
                      type="text"
                      placeholder="main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="bg-muted/50 border-white/10 focus:border-primary"
                      disabled={isGenerating}
                      data-testid="branch-input"
                    />
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button 
                    onClick={handleStartGeneration}
                    disabled={isGenerating || !repoUrl.trim()}
                    className="flex-1"
                    size="lg"
                    data-testid="start-btn"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating Documentation...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 mr-2" />
                        Start Documentation
                      </>
                    )}
                  </Button>
                  
                  {jobStatus?.status === 'completed' && (
                    <Button 
                      onClick={handleExportDocx}
                      variant="outline"
                      size="lg"
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                      data-testid="export-btn"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Export DOCX
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Progress Section */}
            <AnimatePresence>
              {(isGenerating || jobStatus) && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-8"
                >
                  <Card className="bg-card border-white/5" data-testid="agent-progress-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        Agent Progress
                        {jobStatus?.repo_name && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            - {jobStatus.repo_name}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {jobStatus?.files_processed || 0} of {jobStatus?.total_files || 0} files processed
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* Overall Progress */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Overall Progress</span>
                          <span className="text-sm text-muted-foreground">{jobStatus?.overall_progress || 0}%</span>
                        </div>
                        <Progress value={jobStatus?.overall_progress || 0} className="h-3" />
                      </div>

                      {/* Individual Agent Progress */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {agents.map((agent, index) => {
                          const status = getAgentStatus(agent.id);
                          const progress = getAgentProgress(agent.id);
                          const isActive = jobStatus?.current_agent === agent.id;
                          
                          return (
                            <motion.div
                              key={agent.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              className={`p-4 rounded-lg border transition-all ${
                                status === 'completed' 
                                  ? 'bg-green-500/10 border-green-500/30' 
                                  : isActive 
                                    ? 'bg-primary/10 border-primary/50 ring-2 ring-primary/20' 
                                    : 'bg-muted/30 border-white/5'
                              }`}
                              data-testid={`agent-${agent.id}`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {status === 'completed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                                ) : status === 'processing' ? (
                                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                ) : (
                                  <agent.icon className="w-5 h-5 text-muted-foreground" />
                                )}
                                <span className={`text-sm font-medium ${
                                  status === 'completed' ? 'text-green-400' : 
                                  isActive ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                  {agent.name}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">{agent.description}</p>
                              <Progress 
                                value={progress} 
                                className="h-1.5" 
                              />
                              <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Status Message */}
                      {jobStatus?.status === 'completed' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3"
                        >
                          <CheckCircle2 className="w-6 h-6 text-green-400" />
                          <div>
                            <p className="font-medium text-green-400">Documentation Complete!</p>
                            <p className="text-sm text-muted-foreground">
                              Generated documentation for {jobStatus.total_files} files. Click &quot;Export DOCX&quot; to download.
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {jobStatus?.status === 'failed' && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3"
                        >
                          <AlertCircle className="w-6 h-6 text-red-400" />
                          <div>
                            <p className="font-medium text-red-400">Generation Failed</p>
                            <p className="text-sm text-muted-foreground">
                              {jobStatus.error || 'An error occurred during documentation generation.'}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Documentation Preview */}
            <AnimatePresence>
              {documentation && documentation.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="mb-8"
                >
                  <Card className="bg-card border-white/5" data-testid="documentation-preview-card">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5 text-primary" />
                        Documentation Preview
                      </CardTitle>
                      <CardDescription>
                        {documentation.length} files documented
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {documentation.slice(0, 5).map((doc, index) => (
                          <div 
                            key={index}
                            className="p-4 bg-muted/30 rounded-lg border border-white/5"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="font-medium text-sm">{doc.component_path}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded">
                                  {doc.language}
                                </span>
                                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">
                                  {doc.quality_score?.toFixed(0)}% quality
                                </span>
                              </div>
                            </div>
                            {doc.docstring && (
                              <pre className="text-xs text-muted-foreground bg-black/20 p-2 rounded overflow-x-auto">
                                {doc.docstring.substring(0, 200)}...
                              </pre>
                            )}
                          </div>
                        ))}
                        {documentation.length > 5 && (
                          <p className="text-sm text-muted-foreground text-center">
                            ... and {documentation.length - 5} more files
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
