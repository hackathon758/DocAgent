import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  Settings,
  Home,
  Zap,
  Users,
  Shield,
  Activity,
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Edit,
  MoreHorizontal,
  Search,
  Filter,
  Download,
  Calendar,
  User,
  Bell,
  LogOut,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Eye,
  UserPlus,
  UserMinus,
  Key,
  Globe,
  BarChart3
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminPage = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [searchTerm, setSearchTerm] = useState('');
  const [auditFilter, setAuditFilter] = useState('all');

  // Mock team members data
  const [teamMembers, setTeamMembers] = useState([
    { id: '1', name: 'John Doe', email: 'john@example.com', role: 'owner', status: 'active', lastActive: '2 hours ago', avatar: null },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'admin', status: 'active', lastActive: '5 hours ago', avatar: null },
    { id: '3', name: 'Bob Wilson', email: 'bob@example.com', role: 'member', status: 'active', lastActive: '1 day ago', avatar: null },
    { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'member', status: 'pending', lastActive: 'Never', avatar: null },
  ]);

  // Mock audit logs
  const [auditLogs, setAuditLogs] = useState([
    { id: '1', action: 'user_invited', user: 'John Doe', target: 'alice@example.com', timestamp: '2025-07-15 10:30:00', ip: '192.168.1.1', status: 'success' },
    { id: '2', action: 'documentation_generated', user: 'Jane Smith', target: 'auth.py', timestamp: '2025-07-15 09:15:00', ip: '192.168.1.2', status: 'success' },
    { id: '3', action: 'repository_connected', user: 'John Doe', target: 'my-project', timestamp: '2025-07-14 16:45:00', ip: '192.168.1.1', status: 'success' },
    { id: '4', action: 'api_key_created', user: 'Jane Smith', target: 'production-key', timestamp: '2025-07-14 14:20:00', ip: '192.168.1.2', status: 'success' },
    { id: '5', action: 'user_removed', user: 'John Doe', target: 'old-user@example.com', timestamp: '2025-07-13 11:00:00', ip: '192.168.1.1', status: 'success' },
    { id: '6', action: 'login_failed', user: 'Unknown', target: 'admin@example.com', timestamp: '2025-07-13 08:30:00', ip: '10.0.0.1', status: 'failed' },
    { id: '7', action: 'subscription_upgraded', user: 'System', target: 'Professional Plan', timestamp: '2025-07-12 15:00:00', ip: 'N/A', status: 'success' },
    { id: '8', action: 'documentation_exported', user: 'Bob Wilson', target: 'api-docs.docx', timestamp: '2025-07-12 10:45:00', ip: '192.168.1.3', status: 'success' },
  ]);

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/organizations/current`);
      setOrganization(response.data);
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    toast.success('Logged out successfully');
  };

  const handleInviteMember = () => {
    if (!inviteEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    // Mock invite
    const newMember = {
      id: String(teamMembers.length + 1),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'pending',
      lastActive: 'Never',
      avatar: null
    };
    setTeamMembers([...teamMembers, newMember]);
    setShowInviteDialog(false);
    setInviteEmail('');
    setInviteRole('member');
    toast.success(`Invitation sent to ${inviteEmail}`);
  };

  const handleRemoveMember = (memberId) => {
    if (!window.confirm('Are you sure you want to remove this team member?')) return;
    setTeamMembers(teamMembers.filter(m => m.id !== memberId));
    toast.success('Team member removed');
  };

  const handleChangeRole = (memberId, newRole) => {
    setTeamMembers(teamMembers.map(m => 
      m.id === memberId ? { ...m, role: newRole } : m
    ));
    toast.success('Role updated successfully');
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/admin', icon: Shield, label: 'Admin' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const filteredMembers = teamMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = auditLogs.filter(log => {
    if (auditFilter === 'all') return true;
    if (auditFilter === 'success') return log.status === 'success';
    if (auditFilter === 'failed') return log.status === 'failed';
    return true;
  });

  const getActionIcon = (action) => {
    switch (action) {
      case 'user_invited':
      case 'user_added':
        return <UserPlus className="w-4 h-4 text-green-400" />;
      case 'user_removed':
        return <UserMinus className="w-4 h-4 text-red-400" />;
      case 'documentation_generated':
      case 'documentation_exported':
        return <FileText className="w-4 h-4 text-blue-400" />;
      case 'repository_connected':
        return <FolderGit2 className="w-4 h-4 text-purple-400" />;
      case 'api_key_created':
        return <Key className="w-4 h-4 text-yellow-400" />;
      case 'login_failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'subscription_upgraded':
        return <CreditCard className="w-4 h-4 text-green-400" />;
      default:
        return <Activity className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'admin':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-muted text-muted-foreground border-white/10';
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
            <p className="text-sm font-medium text-foreground mb-1">Organization</p>
            <p className="text-xs text-muted-foreground">{organization?.name || 'Loading...'}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-white/5 bg-card/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Admin Panel</h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-medium">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-400">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Tabs defaultValue="users" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="users" className="gap-2">
                  <Users className="w-4 h-4" />
                  Team Members
                </TabsTrigger>
                <TabsTrigger value="audit" className="gap-2">
                  <Activity className="w-4 h-4" />
                  Audit Logs
                </TabsTrigger>
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="organization" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Organization
                </TabsTrigger>
              </TabsList>

              {/* Team Members Tab */}
              <TabsContent value="users">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>Manage your organization's team members and their roles</CardDescription>
                      </div>
                      <Button onClick={() => setShowInviteDialog(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Invite Member
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Search */}
                    <div className="mb-4">
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search members..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 bg-muted/50 border-white/10"
                        />
                      </div>
                    </div>

                    {/* Members Table */}
                    <div className="border border-white/5 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Member</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Role</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Last Active</th>
                            <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredMembers.map((member) => (
                            <tr key={member.id} className="border-t border-white/5 hover:bg-muted/20">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{member.name}</p>
                                    <p className="text-sm text-muted-foreground">{member.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                                  {member.role}
                                </Badge>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {member.status === 'active' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-yellow-400" />
                                  )}
                                  <span className={member.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                                    {member.status}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground text-sm">{member.lastActive}</td>
                              <td className="p-4 text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="w-4 h-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'admin')}>
                                      <Shield className="w-4 h-4 mr-2" />
                                      Make Admin
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleChangeRole(member.id, 'member')}>
                                      <User className="w-4 h-4 mr-2" />
                                      Make Member
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      onClick={() => handleRemoveMember(member.id)}
                                      className="text-red-400"
                                      disabled={member.role === 'owner'}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Audit Logs Tab */}
              <TabsContent value="audit">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Audit Logs</CardTitle>
                        <CardDescription>Track all activities in your organization</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={auditFilter} onValueChange={setAuditFilter}>
                          <SelectTrigger className="w-32 bg-muted/50 border-white/10">
                            <Filter className="w-4 h-4 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="gap-2 border-white/10">
                          <Download className="w-4 h-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-3">
                        {filteredLogs.map((log) => (
                          <div key={log.id} className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                              {getActionIcon(log.action)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                                {log.status === 'failed' && (
                                  <Badge variant="destructive" className="text-xs">Failed</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                by <span className="text-foreground">{log.user}</span> • Target: <span className="text-foreground">{log.target}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">{log.timestamp}</p>
                              <p className="text-xs text-muted-foreground">IP: {log.ip}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Current Plan */}
                  <Card className="bg-card border-white/5 lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Current Subscription</CardTitle>
                      <CardDescription>Manage your billing and subscription</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <div>
                          <p className="text-lg font-bold capitalize">{organization?.subscription?.tier || 'Free'} Plan</p>
                          <p className="text-sm text-muted-foreground">Renews on {organization?.subscription?.current_period_end || 'N/A'}</p>
                        </div>
                        <Link to="/pricing">
                          <Button>Upgrade Plan</Button>
                        </Link>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-primary">{organization?.usage?.components_this_month || 0}</p>
                          <p className="text-sm text-muted-foreground">Components Used</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-primary">{organization?.quotas?.components_per_month || 100}</p>
                          <p className="text-sm text-muted-foreground">Monthly Limit</p>
                        </div>
                        <div className="p-4 bg-muted/30 rounded-lg text-center">
                          <p className="text-2xl font-bold text-primary">${organization?.quotas?.price || 0}</p>
                          <p className="text-sm text-muted-foreground">Per Month</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Payment Method */}
                  <Card className="bg-card border-white/5">
                    <CardHeader>
                      <CardTitle>Payment Method</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-muted/30 rounded-lg flex items-center gap-4">
                        <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-muted-foreground">Expires 12/25</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full border-white/10">
                        Update Payment Method
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Invoices */}
                <Card className="bg-card border-white/5 mt-6">
                  <CardHeader>
                    <CardTitle>Invoice History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border border-white/5 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/30">
                          <tr>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Invoice</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                            <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                            <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-white/5">
                            <td className="p-4">INV-001</td>
                            <td className="p-4 text-muted-foreground">July 1, 2025</td>
                            <td className="p-4">$29.00</td>
                            <td className="p-4"><Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Paid</Badge></td>
                            <td className="p-4 text-right">
                              <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                            </td>
                          </tr>
                          <tr className="border-t border-white/5">
                            <td className="p-4">INV-002</td>
                            <td className="p-4 text-muted-foreground">June 1, 2025</td>
                            <td className="p-4">$29.00</td>
                            <td className="p-4"><Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">Paid</Badge></td>
                            <td className="p-4 text-right">
                              <Button variant="ghost" size="sm"><Download className="w-4 h-4" /></Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Organization Tab */}
              <TabsContent value="organization">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Organization Settings</CardTitle>
                    <CardDescription>Configure your organization details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Organization Name</Label>
                        <Input
                          defaultValue={organization?.name}
                          className="bg-muted/50 border-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Subdomain</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            defaultValue={organization?.subdomain}
                            className="bg-muted/50 border-white/10"
                          />
                          <span className="text-muted-foreground">.docagent.io</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Organization Logo</Label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-muted/50 rounded-lg flex items-center justify-center border border-white/10">
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <Button variant="outline" className="border-white/10">Upload Logo</Button>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <h3 className="font-medium mb-4 flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        Danger Zone
                      </h3>
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-3">Deleting your organization will remove all data, including repositories, documentation, and team members. This action cannot be undone.</p>
                        <Button variant="destructive">Delete Organization</Button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button>Save Changes</Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Invite Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new member to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-muted/50 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteMember}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
