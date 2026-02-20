import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  FileText,
  FolderGit2,
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Activity,
  CheckCircle2,
  Clock,
  Target
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AnalyticsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [selectedRepo, setSelectedRepo] = useState('all');
  const [repositories, setRepositories] = useState([]);
  const [languageFilter, setLanguageFilter] = useState('all');
  const [qualityMin, setQualityMin] = useState(0);
  const [generationTrends, setGenerationTrends] = useState([]);
  const [moduleCoverage, setModuleCoverage] = useState([]);

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedRepo]);

  useEffect(() => {
    fetchGenerationTrends();
    fetchModuleCoverage();
  }, [languageFilter, qualityMin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, coverageRes, reposRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/overview`),
        axios.get(`${API_URL}/api/analytics/coverage`),
        axios.get(`${API_URL}/api/repositories`)
      ]);
      setAnalytics(analyticsRes.data);
      setCoverage(coverageRes.data);
      setRepositories(reposRes.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGenerationTrends = async () => {
    try {
      const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : dateRange === '1y' ? 365 : 30;
      const res = await axios.get(`${API_URL}/api/analytics/generation-trends?days=${days}`);
      setGenerationTrends(res.data || []);
    } catch { setGenerationTrends([]); }
  };

  const fetchModuleCoverage = async () => {
    try {
      const params = new URLSearchParams();
      if (languageFilter !== 'all') params.append('language', languageFilter);
      if (qualityMin > 0) params.append('quality_min', qualityMin);
      const res = await axios.get(`${API_URL}/api/analytics/module-coverage?${params}`);
      setModuleCoverage(res.data || []);
    } catch { setModuleCoverage([]); }
  };

  const handleExportCSV = () => {
    if (!analytics) {
      toast.error('No analytics data to export');
      return;
    }

    const rows = [
      ['Metric', 'Value'],
      ['Total Repositories', analytics.total_repositories || 0],
      ['Components Documented', analytics.total_documentation || 0],
      ['Average Quality Score', `${analytics.average_quality_score || 0}%`],
      ['Coverage', `${analytics.coverage_percentage || 0}%`],
      ['Components This Month', analytics.components_documented_this_month || 0],
    ];

    if (moduleCoverage.length > 0) {
      rows.push([], ['Module', 'Language', 'Quality Score']);
      moduleCoverage.forEach(m => {
        rows.push([m.component_path || m.name || '', m.language || '', m.quality_score || 0]);
      });
    }

    const csvContent = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analytics_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('Analytics exported as CSV');
  };

  // Chart configurations with dark theme
  const coverageTrendData = {
    labels: coverage?.trend?.map(t => t.date) || ['Jan 1', 'Jan 8', 'Jan 15', 'Jan 22', 'Jan 29'],
    datasets: [
      {
        label: 'Coverage %',
        data: coverage?.trend?.map(t => t.coverage) || [50, 60, 65, 70, 75],
        borderColor: 'rgb(124, 58, 237)',
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const languageDistributionData = {
    labels: Object.keys(coverage?.by_language || { Python: 45, JavaScript: 30, TypeScript: 25 }),
    datasets: [
      {
        data: Object.values(coverage?.by_language || { Python: 45, JavaScript: 30, TypeScript: 25 }),
        backgroundColor: [
          'rgba(124, 58, 237, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(124, 58, 237, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const qualityDistributionData = {
    labels: ['90-100%', '80-89%', '70-79%', '60-69%', '<60%'],
    datasets: [
      {
        label: 'Components',
        data: [35, 45, 25, 15, 5],
        backgroundColor: [
          'rgba(16, 185, 129, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(124, 58, 237, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
        },
      },
    },
    scales: {
      x: {
        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
      y: {
        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'rgba(255, 255, 255, 0.7)',
          padding: 15,
        },
      },
    },
  };

  // Activity feed
  const activityFeed = [
    { id: 1, type: 'generate', message: 'Documentation generated for auth.py', time: '5 minutes ago', user: 'John D.' },
    { id: 2, type: 'sync', message: 'Repository synced: my-project', time: '1 hour ago', user: 'System' },
    { id: 3, type: 'generate', message: 'Documentation generated for utils/helpers.js', time: '2 hours ago', user: 'Jane S.' },
    { id: 4, type: 'complete', message: 'Batch documentation completed for api/', time: '3 hours ago', user: 'System' },
    { id: 5, type: 'generate', message: 'Documentation generated for models/user.py', time: '5 hours ago', user: 'John D.' },
  ];

  // Generation Trends chart data
  const generationTrendsData = {
    labels: generationTrends.map(t => t.date || t._id),
    datasets: [
      {
        label: 'Avg Generation Time (s)',
        data: generationTrends.map(t => t.avg_duration || 0),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Module Coverage chart data
  const topModules = moduleCoverage.slice(0, 10);
  const bottomModules = [...moduleCoverage].sort((a, b) => (a.quality_score || 0) - (b.quality_score || 0)).slice(0, 10);
  const moduleCoverageData = {
    labels: topModules.map(m => (m.component_path || m.name || '').split('/').pop()),
    datasets: [
      {
        label: 'Quality Score',
        data: topModules.map(m => m.quality_score || 0),
        backgroundColor: topModules.map(m =>
          (m.quality_score || 0) >= 80 ? 'rgba(16, 185, 129, 0.8)' :
          (m.quality_score || 0) >= 60 ? 'rgba(245, 158, 11, 0.8)' :
          'rgba(239, 68, 68, 0.8)'
        ),
      },
    ],
  };

  const horizontalBarOptions = {
    ...chartOptions,
    indexAxis: 'y',
    plugins: {
      ...chartOptions.plugins,
      legend: { display: false },
    },
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopBar title="Analytics Dashboard" />

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40 bg-muted/50 border-white/10">
                    <Calendar className="w-4 h-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="1y">Last year</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                  <SelectTrigger className="w-48 bg-muted/50 border-white/10">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="All Repositories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Repositories</SelectItem>
                    {repositories.map(repo => (
                      <SelectItem key={repo.id} value={repo.id}>{repo.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={languageFilter} onValueChange={setLanguageFilter}>
                  <SelectTrigger className="w-40 bg-muted/50 border-white/10">
                    <SelectValue placeholder="All Languages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Languages</SelectItem>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Quality &ge; {qualityMin}%</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={qualityMin}
                    onChange={(e) => setQualityMin(Number(e.target.value))}
                    className="w-24 accent-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 border-white/10">
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" className="gap-2 border-white/10" onClick={handleExportCSV}>
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                <Card className="bg-card border-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Repositories</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.total_repositories || 0}</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +2 this month
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
                <Card className="bg-card border-white/5">
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
                <Card className="bg-card border-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Quality Score</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.average_quality_score || 0}%</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +5% from last month
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
                <Card className="bg-card border-white/5">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Coverage</p>
                        <p className="text-3xl font-bold mt-1">{analytics?.coverage_percentage || 0}%</p>
                        <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> +10% from last month
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                        <Activity className="w-6 h-6 text-yellow-400" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coverage Trend */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Coverage Trend
                  </CardTitle>
                  <CardDescription>Documentation coverage over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Line data={coverageTrendData} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Language Distribution */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    Language Distribution
                  </CardTitle>
                  <CardDescription>Coverage by programming language</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Doughnut data={languageDistributionData} options={doughnutOptions} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quality Distribution */}
              <Card className="bg-card border-white/5 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    Quality Score Distribution
                  </CardTitle>
                  <CardDescription>Distribution of documentation quality scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <Bar data={qualityDistributionData} options={chartOptions} />
                  </div>
                </CardContent>
              </Card>

              {/* Activity Feed */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-64 overflow-auto">
                    {activityFeed.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          activity.type === 'complete' ? 'bg-green-500/20' :
                          activity.type === 'sync' ? 'bg-blue-500/20' : 'bg-primary/20'
                        }`}>
                          {activity.type === 'complete' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          ) : activity.type === 'sync' ? (
                            <RefreshCw className="w-4 h-4 text-blue-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{activity.message}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {activity.time}
                            <span>•</span> {activity.user}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generation Trends & Module Coverage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Generation Time Trends */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Generation Time Trends
                  </CardTitle>
                  <CardDescription>Average documentation generation time per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {generationTrends.length > 0 ? (
                      <Line data={generationTrendsData} options={chartOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        No generation data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Module Coverage */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-400" />
                    Module Coverage
                  </CardTitle>
                  <CardDescription>Top documented modules by quality score</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {moduleCoverage.length > 0 ? (
                      <Bar data={moduleCoverageData} options={horizontalBarOptions} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        No module coverage data available
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AnalyticsPage;
