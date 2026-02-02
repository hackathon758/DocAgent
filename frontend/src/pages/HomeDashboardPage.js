import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  FileText,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Github,
  Play,
  Download,
  Code,
  GitBranch,
  Bot,
  FileSearch,
  Plus,
  TrendingUp,
  Activity,
  Clock,
  ArrowRight,
  BarChart3,
  Target,
  Shield,
  Cpu,
  RefreshCw,
  ExternalLink,
  Star
} from 'lucide-react';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const HomeDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Dashboard state
  const [analytics, setAnalytics] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [recentDocs, setRecentDocs] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Repository documentation state
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [documentation, setDocumentation] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const pollIntervalRef = useRef(null);

  // Activity feed from jobs
  const [activityFeed, setActivityFeed] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, reposRes, docsRes, jobsRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview`),
        axios.get(`${API_URL}/api/repositories`),
        axios.get(`${API_URL}/api/documentation`),
        axios.get(`${API_URL}/api/jobs`)
      ]);
      setAnalytics(analyticsRes.data);
      setRepositories(reposRes.data.slice(0, 5));
      setRecentDocs(docsRes.data.slice(0, 5));
      setRecentJobs(jobsRes.data.slice(0, 5));
      
      // Build activity feed from jobs
      const activities = jobsRes.data.slice(0, 10).map((job, idx) => ({
        id: job.id || idx,
        type: job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : 'generate',
        message: job.status === 'completed' 
          ? `Documentation completed for ${job.repo_name || 'repository'}`
          : job.status === 'failed'
          ? `Failed to generate docs for ${job.repo_name || 'repository'}`
          : `Processing ${job.repo_name || 'repository'}`,
        time: job.created_at ? new Date(job.created_at).toLocaleString() : 'Recently',
        icon: job.status === 'completed' ? CheckCircle2 : job.status === 'failed' ? AlertCircle : FileText,
        color: job.status === 'completed' ? 'text-green-400' : job.status === 'failed' ? 'text-red-400' : 'text-blue-400'
      }));
      setActivityFeed(activities.length > 0 ? activities : [
        { id: 1, type: 'info', message: 'Welcome to DocAgent!', time: 'Just now', icon: Star, color: 'text-primary' },
        { id: 2, type: 'info', message: 'Connect a repository to get started', time: '', icon: FolderGit2, color: 'text-muted-foreground' }
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!repoUrl.trim()) {
      toast.error('Please enter a GitHub repository URL');
      return;
    }

    const githubUrlPattern = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/;
    if (!githubUrlPattern.test(repoUrl)) {
      toast.error('Please enter a valid GitHub repository URL');
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

      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusResponse = await axios.get(`${API_URL}/api/repo-documentation/status/${jobId}`);
          setJobStatus(statusResponse.data);

          if (statusResponse.data.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setIsGenerating(false);
            toast.success('Documentation generated successfully!');
            
            const previewResponse = await axios.get(`${API_URL}/api/repo-documentation/preview/${jobId}`);
            setDocumentation(previewResponse.data.documentation);
            fetchDashboardData();
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

  const agents = [
    { id: 'reader', name: 'Reader', icon: Code, description: 'Analyzing code' },
    { id: 'searcher', name: 'Searcher', icon: FileSearch, description: 'Gathering context' },
    { id: 'writer', name: 'Writer', icon: FileText, description: 'Writing docs' },
    { id: 'verifier', name: 'Verifier', icon: CheckCircle2, description: 'Verifying quality' },
    { id: 'diagram', name: 'Diagram', icon: GitBranch, description: 'Creating diagrams' },
  ];

  const getAgentStatus = (agentId) => {
    if (!jobStatus?.agents) return 'pending';
    return jobStatus.agents[agentId]?.status || 'pending';
  };

  const getAgentProgress = (agentId) => {
    if (!jobStatus?.agents) return 0;
    return jobStatus.agents[agentId]?.progress || 0;
  };

  const quickActions = [
    { icon: Plus, label: 'Connect Repository', path: '/repositories', color: 'bg-blue-500/20 text-blue-400' },
    { icon: Zap, label: 'Generate Docs', path: '/generate', color: 'bg-green-500/20 text-green-400' },
    { icon: BarChart3, label: 'View Analytics', path: '/analytics', color: 'bg-purple-500/20 text-purple-400' },
    { icon: Shield, label: 'Admin Panel', path: '/admin', color: 'bg-yellow-500/20 text-yellow-400' },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopBar title="Dashboard" />

        {/* Dashboard Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            {/* Welcome Header */}
            <div className="mb-8">
              <h1 className="font-heading text-3xl font-bold text-foreground mb-2">
                Welcome back, {user?.name?.split(' ')[0]}!
              </h1>
              <p className="text-muted-foreground">
                Here's an overview of your documentation status
              </p>
            </div>

            {/* Stats Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card className="bg-card border-white/5 hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Repositories</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.total_repositories || 0}</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Active
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                        <FolderGit2 className="w-6 h-6 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-card border-white/5 hover:border-blue-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Components Documented</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.total_documentation || 0}</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +{analytics?.components_documented_this_month || 0} this month
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-blue-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-card border-white/5 hover:border-green-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Quality Score</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.average_quality_score || 0}%</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <Star className="w-3 h-3" /> Excellent
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                        <Target className="w-6 h-6 text-green-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-card border-white/5 hover:border-yellow-500/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Coverage</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.coverage_percentage || 0}%</p>
                        <Progress value={analytics?.coverage_percentage || 0} className="h-1.5 mt-2 w-24" />
                      </div>
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <Activity className="w-6 h-6 text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Quick Actions */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index }}
                  >
                    <Link to={action.path}>
                      <Card className="bg-card border-white/5 hover:border-white/20 transition-all cursor-pointer group">
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                            <action.icon className="w-5 h-5" />
                          </div>
                          <span className="font-medium group-hover:text-primary transition-colors">{action.label}</span>
                          <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Generate Documentation */}
              <div className="lg:col-span-2 space-y-6">
                {/* GitHub Repository Input Section */}
                <Card className="bg-gradient-to-r from-card to-card/50 border-white/10" data-testid="repo-input-card">
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
                        <>
                          <Button 
                            onClick={() => setShowPreviewModal(true)}
                            variant="outline"
                            size="lg"
                            className="border-primary/50 text-primary hover:bg-primary/10"
                            data-testid="preview-btn"
                          >
                            <FileSearch className="w-5 h-5 mr-2" />
                            Preview
                          </Button>
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
                        </>
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
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Overall Progress</span>
                              <span className="text-sm text-muted-foreground">{jobStatus?.overall_progress || 0}%</span>
                            </div>
                            <Progress value={jobStatus?.overall_progress || 0} className="h-3" />
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                                  className={`p-3 rounded-lg border transition-all ${
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
                                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    ) : status === 'processing' ? (
                                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                    ) : (
                                      <agent.icon className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className={`text-xs font-medium ${
                                      status === 'completed' ? 'text-green-400' : 
                                      isActive ? 'text-primary' : 'text-muted-foreground'
                                    }`}>
                                      {agent.name}
                                    </span>
                                  </div>
                                  <Progress value={progress} className="h-1" />
                                  <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
                                </motion.div>
                              );
                            })}
                          </div>

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
                                  Generated documentation for {jobStatus.total_files} files.
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

                {/* Recent Repositories */}
                <Card className="bg-card border-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Repositories</CardTitle>
                      <CardDescription>Your connected repositories</CardDescription>
                    </div>
                    <Link to="/repositories">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View All <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {repositories.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderGit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">No repositories connected</p>
                        <Link to="/repositories">
                          <Button>Connect Repository</Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {repositories.map((repo) => (
                          <div key={repo.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                                <Github className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{repo.name}</p>
                                <p className="text-xs text-muted-foreground">{repo.language} • {repo.branch}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {repo.coverage_percentage || 0}% coverage
                              </Badge>
                              <Button variant="ghost" size="icon" onClick={() => window.open(repo.repo_url, '_blank')}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column - Activity Feed */}
              <div className="space-y-6">
                {/* Activity Feed */}
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-4">
                        {activityFeed.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center`}>
                              <activity.icon className={`w-4 h-4 ${activity.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{activity.message}</p>
                              {activity.time && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" /> {activity.time}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Recent Documentation */}
                <Card className="bg-card border-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Recent Documentation</CardTitle>
                    <Link to="/documentation">
                      <Button variant="ghost" size="sm">
                        View All
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {recentDocs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No documentation generated yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentDocs.slice(0, 4).map((doc) => (
                          <Link key={doc.id} to={`/documentation/${doc.id}`}>
                            <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                                <span className="text-sm truncate">{doc.component_path}</span>
                              </div>
                              <Badge variant="outline" className="text-xs ml-2">
                                {doc.quality_score?.toFixed(0) || 0}%
                              </Badge>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Models Status */}
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Cpu className="w-5 h-5 text-primary" />
                      AI Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { name: 'Reader Agent', model: 'CodeT5+ 16B', status: 'active' },
                        { name: 'Writer Agent', model: 'StarCoder2 15B', status: 'active' },
                        { name: 'Verifier Agent', model: 'Llama 3.1 8B', status: 'active' },
                      ].map((agent, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.model}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full" />
                            <span className="text-xs text-green-400">Active</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Link to="/models">
                      <Button variant="outline" size="sm" className="w-full mt-4 border-white/10">
                        Manage Models
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        documentation={documentation}
        repoName={jobStatus?.repo_name || 'Repository'}
        onExport={handleExportDocx}
      />
    </div>
  );
};

export default HomeDashboardPage;
