import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  BarChart3,
  Settings,
  Plus,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
  Zap,
  LogOut,
  User,
  Bell,
  Search,
  Home
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/analytics/overview`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const statCards = [
    {
      title: 'Repositories',
      value: analytics?.total_repositories || 0,
      icon: FolderGit2,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    },
    {
      title: 'Documentation',
      value: analytics?.total_documentation || 0,
      icon: FileText,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10'
    },
    {
      title: 'Avg Quality',
      value: `${analytics?.average_quality_score || 0}%`,
      icon: TrendingUp,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10'
    },
    {
      title: 'Jobs Run',
      value: analytics?.total_jobs || 0,
      icon: Zap,
      color: 'text-orange-400',
      bgColor: 'bg-orange-400/10'
    }
  ];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search documentation..."
                className="w-80 h-10 pl-10 pr-4 rounded-lg bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                data-testid="search-input"
              />
            </div>
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
                Here's an overview of your documentation status
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statCards.map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="bg-card border-white/5 hover:border-white/10 transition-colors" data-testid={`stat-${stat.title.toLowerCase().replace(' ', '-')}`}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                          <p className="text-3xl font-heading font-bold text-foreground">
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : stat.value}
                          </p>
                        </div>
                        <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                          <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Quick Actions & Recent Jobs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <Card className="bg-card border-white/5" data-testid="quick-actions-card">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Link to="/repositories">
                    <Button variant="outline" className="w-full justify-between border-white/10 hover:bg-white/5" data-testid="add-repo-btn">
                      <span className="flex items-center gap-2">
                        <FolderGit2 className="w-4 h-4" />
                        Add Repository
                      </span>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/generate">
                    <Button className="w-full justify-between" data-testid="generate-docs-btn">
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Generate Documentation
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/documentation">
                    <Button variant="outline" className="w-full justify-between border-white/10 hover:bg-white/5" data-testid="view-docs-btn">
                      <span className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        View Documentation
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Recent Jobs */}
              <Card className="bg-card border-white/5 lg:col-span-2" data-testid="recent-jobs-card">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-heading text-lg">Recent Jobs</CardTitle>
                  <Link to="/documentation">
                    <Button variant="ghost" size="sm" className="text-muted-foreground">
                      View all
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : analytics?.recent_jobs?.length > 0 ? (
                    <div className="space-y-4">
                      {analytics.recent_jobs.map((job) => (
                        <div 
                          key={job.id} 
                          className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                          data-testid={`job-${job.id}`}
                        >
                          <div className="flex items-center gap-4">
                            {getStatusIcon(job.status)}
                            <div>
                              <p className="font-medium text-foreground text-sm">
                                {job.component_path || 'Repository Documentation'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {job.job_type} • {new Date(job.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              job.status === 'completed' ? 'bg-green-400/10 text-green-400' :
                              job.status === 'processing' ? 'bg-blue-400/10 text-blue-400' :
                              job.status === 'failed' ? 'bg-red-400/10 text-red-400' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">No jobs yet</p>
                      <Link to="/generate">
                        <Button data-testid="start-generating-btn">Start Generating</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Documentation Coverage */}
            <Card className="bg-card border-white/5 mt-6" data-testid="coverage-card">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Documentation Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Progress value={analytics?.coverage_percentage || 0} className="flex-1" />
                  <span className="text-2xl font-bold font-heading text-foreground">
                    {analytics?.coverage_percentage || 0}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {analytics?.components_documented_this_month || 0} components documented this month
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
