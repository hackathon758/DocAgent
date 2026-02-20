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
  AreaChart, Area, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  FileText, FolderGit2, CheckCircle2, AlertCircle, Loader2, Zap, Github,
  Play, Download, Code, GitBranch, Bot, FileSearch, Plus, TrendingUp,
  Activity, Clock, ArrowRight, BarChart3, Target, Shield, RefreshCw, Star
} from 'lucide-react';
import DocumentPreviewModal from '@/components/DocumentPreviewModal';
import { Input } from '@/components/ui/input';
import useWebSocket from '@/hooks/useWebSocket';
import { Lock } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Chart colors
const COLORS = {
  primary: 'hsl(217, 91%, 60%)',
  accent: 'hsl(263, 70%, 66%)',
  success: 'hsl(142, 76%, 42%)',
  warning: 'hsl(38, 92%, 50%)',
  destructive: 'hsl(0, 84%, 60%)'
};

const HomeDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscribeToJob, onMessage, connected } = useWebSocket();

  const [analytics, setAnalytics] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [recentJobs, setRecentJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [githubToken, setGithubToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [filesCompleted, setFilesCompleted] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [documentation, setDocumentation] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const unsubscribeRef = useRef(null);
  const [activityFeed, setActivityFeed] = useState([]);

  // Sample chart data
  const [coverageData, setCoverageData] = useState([
    { name: 'Mon', coverage: 65, docs: 12 },
    { name: 'Tue', coverage: 72, docs: 18 },
    { name: 'Wed', coverage: 68, docs: 15 },
    { name: 'Thu', coverage: 78, docs: 22 },
    { name: 'Fri', coverage: 82, docs: 28 },
    { name: 'Sat', coverage: 85, docs: 32 },
    { name: 'Sun', coverage: 88, docs: 35 },
  ]);

  const [languageData, setLanguageData] = useState([
    { name: 'Python', value: 45, color: COLORS.primary },
    { name: 'JavaScript', value: 30, color: COLORS.warning },
    { name: 'TypeScript', value: 15, color: COLORS.accent },
    { name: 'Other', value: 10, color: COLORS.success },
  ]);

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [analyticsRes, reposRes, jobsRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview`),
        axios.get(`${API_URL}/api/repositories`),
        axios.get(`${API_URL}/api/jobs`)
      ]);
      setAnalytics(analyticsRes.data);
      setRepositories(reposRes.data.slice(0, 5));
      setRecentJobs(jobsRes.data.slice(0, 5));

      const activities = jobsRes.data.slice(0, 8).map((job, idx) => ({
        id: job.id || idx,
        type: job.status === 'completed' ? 'complete' : job.status === 'failed' ? 'error' : 'generate',
        message: job.status === 'completed'
          ? `Documentation completed for ${job.repo_name || 'repository'}`
          : job.status === 'failed'
            ? `Failed to generate docs for ${job.repo_name || 'repository'}`
            : `Processing ${job.repo_name || 'repository'}`,
        time: job.created_at ? new Date(job.created_at).toLocaleString() : 'Recently',
        icon: job.status === 'completed' ? CheckCircle2 : job.status === 'failed' ? AlertCircle : FileText,
        color: job.status === 'completed' ? 'text-green-500' : job.status === 'failed' ? 'text-red-500' : 'text-primary'
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
    setCurrentFile(null);
    setFilesCompleted(0);
    setTotalFiles(0);

    try {
      const payload = { repo_url: repoUrl, branch };
      if (githubToken.trim()) payload.github_token = githubToken.trim();

      const response = await axios.post(`${API_URL}/api/repo-documentation/start`, payload);

      const jobId = response.data.job_id;
      const repositoryId = response.data.repository_id;
      setCurrentJobId(jobId);
      setTotalFiles(response.data.total_files || 0);
      toast.success(`Started documentation generation for ${response.data.total_files} files`);

      // Subscribe via WebSocket for real-time progress
      if (unsubscribeRef.current) unsubscribeRef.current();
      unsubscribeRef.current = subscribeToJob(jobId, async (data) => {
        if (data.type === 'repo_doc_progress') {
          setJobStatus(prev => ({ ...prev, ...data }));
          setFilesCompleted(data.files_completed ?? data.file_index ?? 0);
          if (data.total_files) setTotalFiles(data.total_files);
          if (data.file) setCurrentFile(data.file);

          if (data.status === 'completed') {
            setIsGenerating(false);
            toast.success('Documentation generated successfully!');
            try {
              const previewResponse = await axios.get(`${API_URL}/api/repo-documentation/preview/${jobId}`);
              setDocumentation(previewResponse.data || {});
            } catch (e) { console.error('Preview fetch error:', e); }
            fetchDashboardData();
          } else if (data.status === 'error' || data.status === 'failed') {
            setIsGenerating(false);
            toast.error(data.error || 'Documentation generation failed');
          }
        } else if (data.type === 'repo_doc_agent_progress') {
          setCurrentFile(data.file || null);
          if (data.files_completed != null) setFilesCompleted(data.files_completed);
          if (data.total_files) setTotalFiles(data.total_files);
          setJobStatus(prev => {
            const agents = { ...(prev?.agents || {}) };
            const agent = data.agent;
            if (agent) {
              agents[agent] = {
                ...agents[agent],
                status: data.status === 'running' ? 'processing' : data.status,
                progress: data.status === 'completed' ? 100 : (agents[agent]?.progress || 0),
              };
            }
            return {
              ...prev,
              agents,
              overall_progress: data.total_files
                ? Math.round(((data.files_completed || 0) / data.total_files) * 100)
                : (prev?.overall_progress || 0),
            };
          });
        }
      });

      // Also poll status once initially to seed the UI state
      try {
        const statusResponse = await axios.get(`${API_URL}/api/repo-documentation/status/${jobId}`);
        setJobStatus(statusResponse.data);
      } catch (e) { /* ignore initial poll error */ }

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

  const StatCard = ({ title, value, subtitle, icon: Icon, trend, color }) => (
    <Card className="stat-card bg-card border-border hover:border-primary/50 transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className={`text-xs flex items-center gap-1 ${trend === 'up' ? 'text-green-500' : 'text-muted-foreground'}`}>
                {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                {subtitle}
              </p>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-xs text-muted-foreground">
              {entry.name}: <span className="font-medium text-foreground">{entry.value}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title="Dashboard" />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Welcome */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Welcome back, {user?.name?.split(' ')[0]}!
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Here's an overview of your documentation status
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchDashboardData} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <StatCard
                  title="Total Repositories"
                  value={analytics?.total_repositories || 0}
                  subtitle="Active"
                  trend="up"
                  icon={FolderGit2}
                  color="bg-primary/10 text-primary"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <StatCard
                  title="Components Documented"
                  value={analytics?.total_documentation || 0}
                  subtitle={`+${analytics?.components_documented_this_month || 0} this month`}
                  trend="up"
                  icon={FileText}
                  color="bg-blue-500/10 text-blue-500"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <StatCard
                  title="Avg Quality Score"
                  value={`${analytics?.average_quality_score || 0}%`}
                  subtitle="Excellent"
                  icon={Target}
                  color="bg-green-500/10 text-green-500"
                />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <StatCard
                  title="Coverage"
                  value={`${analytics?.coverage_percentage || 0}%`}
                  subtitle="Overall coverage"
                  icon={Activity}
                  color="bg-amber-500/10 text-amber-500"
                />
              </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Coverage Trend */}
              <Card className="lg:col-span-2 bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Documentation Coverage Trend</CardTitle>
                  <CardDescription>Weekly documentation activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={coverageData}>
                        <defs>
                          <linearGradient id="colorCoverage" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="coverage"
                          stroke={COLORS.primary}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorCoverage)"
                          name="Coverage %"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Language Distribution */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Language Distribution</CardTitle>
                  <CardDescription>By repository count</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={languageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {languageData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Generate Documentation */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-card border-border" data-testid="repo-input-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Github className="w-5 h-5" />
                      Generate Repository Documentation
                    </CardTitle>
                    <CardDescription>
                      Enter a GitHub repository URL to generate comprehensive documentation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="relative">
                          <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="https://github.com/owner/repository"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            className="pl-10"
                            disabled={isGenerating}
                            data-testid="repo-url-input"
                          />
                        </div>
                      </div>
                      <Input
                        type="text"
                        placeholder="main"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        className="w-24"
                        disabled={isGenerating}
                        data-testid="branch-input"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowTokenInput(!showTokenInput)}
                        className="shrink-0"
                        title="Add GitHub token for private repos"
                      >
                        <Lock className={`w-4 h-4 ${githubToken ? 'text-green-500' : 'text-muted-foreground'}`} />
                      </Button>
                    </div>

                    {showTokenInput && (
                      <Input
                        type="password"
                        placeholder="GitHub token (optional, for private repos)"
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        disabled={isGenerating}
                        data-testid="github-token-input"
                      />
                    )}

                    <div className="flex gap-2">
                      <Button
                        onClick={handleStartGeneration}
                        disabled={isGenerating || !repoUrl.trim()}
                        className="flex-1"
                        data-testid="start-btn"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Start Documentation
                          </>
                        )}
                      </Button>

                      {jobStatus?.status === 'completed' && (
                        <>
                          <Button
                            onClick={() => setShowPreviewModal(true)}
                            variant="outline"
                            data-testid="preview-btn"
                          >
                            <FileSearch className="w-4 h-4 mr-2" />
                            Preview
                          </Button>
                          <Button
                            onClick={handleExportDocx}
                            variant="outline"
                            className="text-green-500 border-green-500/50 hover:bg-green-500/10"
                            data-testid="export-btn"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Export DOCX
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Agent Progress */}
                <AnimatePresence>
                  {(isGenerating || jobStatus) && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="bg-card border-border" data-testid="agent-progress-card">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Bot className="w-5 h-5 text-primary" />
                            AI Agent Progress
                          </CardTitle>
                          {jobStatus && (
                            <div className="space-y-2 mt-2">
                              <div className="flex items-center gap-2">
                                <Progress value={jobStatus.overall_progress || 0} className="flex-1 h-2" />
                                <span className="text-sm font-medium">{jobStatus.overall_progress || 0}%</span>
                              </div>
                              {(currentFile || totalFiles > 0) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {totalFiles > 0 && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      {filesCompleted}/{totalFiles} files
                                    </Badge>
                                  )}
                                  {currentFile && (
                                    <span className="truncate max-w-xs" title={currentFile}>
                                      Processing: <code className="text-primary">{currentFile}</code>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-5 gap-3">
                            {agents.map((agent, index) => {
                              const status = getAgentStatus(agent.id);
                              const progress = getAgentProgress(agent.id);
                              return (
                                <motion.div
                                  key={agent.id}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: index * 0.1 }}
                                  className={`p-3 rounded-lg border text-center transition-all ${status === 'completed' ? 'bg-green-500/10 border-green-500/30' :
                                    status === 'processing' ? 'bg-primary/10 border-primary/30' :
                                      'bg-muted/50 border-border'
                                    }`}
                                >
                                  <agent.icon className={`w-5 h-5 mx-auto mb-2 ${status === 'completed' ? 'text-green-500' :
                                    status === 'processing' ? 'text-primary animate-pulse' :
                                      'text-muted-foreground'
                                    }`} />
                                  <p className="text-xs font-medium">{agent.name}</p>
                                  {status === 'processing' && (
                                    <p className="text-[10px] text-muted-foreground mt-1">{progress}%</p>
                                  )}
                                </motion.div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Activity Feed */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <div className="px-6 pb-6 space-y-1">
                      {activityFeed.map((activity, index) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="activity-item flex items-start gap-3 p-3 rounded-lg"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${activity.type === 'complete' ? 'bg-green-500/10' :
                            activity.type === 'error' ? 'bg-red-500/10' :
                              'bg-primary/10'
                            }`}>
                            <activity.icon className={`w-4 h-4 ${activity.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{activity.message}</p>
                            {activity.time && (
                              <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { icon: Plus, label: 'Connect Repository', path: '/repositories', color: 'bg-primary/10 text-primary' },
                    { icon: FileText, label: 'View Documentation', path: '/documentation', color: 'bg-green-500/10 text-green-500' },
                    { icon: BarChart3, label: 'View Analytics', path: '/analytics', color: 'bg-purple-500/10 text-purple-500' },
                    { icon: Shield, label: 'Admin Panel', path: '/admin', color: 'bg-amber-500/10 text-amber-500' },
                  ].map((action) => (
                    <Link key={action.label} to={action.path}>
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all group cursor-pointer">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                          <action.icon className="w-5 h-5" />
                        </div>
                        <span className="font-medium text-sm group-hover:text-primary transition-colors">{action.label}</span>
                        <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Preview Modal */}
      {showPreviewModal && documentation && (
        <DocumentPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          documentation={documentation}
          repoName={jobStatus?.repo_name}
          onExport={handleExportDocx}
        />
      )}
    </div>
  );
};

export default HomeDashboardPage;
