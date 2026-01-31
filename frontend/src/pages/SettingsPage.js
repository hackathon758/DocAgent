import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  Settings,
  Home,
  Zap,
  User,
  Bell,
  Shield,
  Palette,
  Code,
  Save,
  Building2,
  CreditCard,
  Key,
  Cpu
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state
  const [settings, setSettings] = useState({
    docStyle: 'google',
    defaultLanguage: 'python',
    autoGenerate: false,
    emailNotifications: true,
    browserNotifications: true,
    darkMode: true,
    editorFontSize: '14',
    showLineNumbers: true,
  });

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

  const handleSave = async () => {
    setSaving(true);
    // Mock save - in production this would call an API
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success('Settings saved successfully');
    setSaving(false);
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/models', icon: Cpu, label: 'AI Models' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b border-white/5 bg-card/50 flex items-center px-6">
          <h1 className="font-heading text-xl font-bold">Settings</h1>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="bg-muted/50">
                <TabsTrigger value="profile" className="gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="organization" className="gap-2">
                  <Building2 className="w-4 h-4" />
                  Organization
                </TabsTrigger>
                <TabsTrigger value="documentation" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Documentation
                </TabsTrigger>
                <TabsTrigger value="notifications" className="gap-2">
                  <Bell className="w-4 h-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="appearance" className="gap-2">
                  <Palette className="w-4 h-4" />
                  Appearance
                </TabsTrigger>
              </TabsList>

              {/* Profile Tab */}
              <TabsContent value="profile">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Profile Settings</CardTitle>
                    <CardDescription>Manage your personal information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center">
                        <User className="w-10 h-10 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-lg">{user?.name}</h3>
                        <p className="text-muted-foreground">{user?.email}</p>
                        <p className="text-sm text-muted-foreground capitalize mt-1">
                          {user?.role} • {user?.subscription_tier} Plan
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Name</label>
                        <input
                          type="text"
                          defaultValue={user?.name}
                          className="w-full h-10 px-4 rounded-md bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email</label>
                        <input
                          type="email"
                          defaultValue={user?.email}
                          disabled
                          className="w-full h-10 px-4 rounded-md bg-muted/30 border border-white/5 text-sm text-muted-foreground"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Organization Tab */}
              <TabsContent value="organization">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Organization Settings</CardTitle>
                    <CardDescription>Manage your organization details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {organization && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium mb-2 block">Organization Name</label>
                            <input
                              type="text"
                              defaultValue={organization.name}
                              className="w-full h-10 px-4 rounded-md bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Subdomain</label>
                            <input
                              type="text"
                              defaultValue={organization.subdomain}
                              className="w-full h-10 px-4 rounded-md bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                            />
                          </div>
                        </div>

                        <div className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Current Plan</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {organization.subscription?.tier} - ${organization.quotas?.price || 0}/month
                              </p>
                            </div>
                            <Link to="/pricing">
                              <Button variant="outline" className="border-white/10">
                                <CreditCard className="w-4 h-4 mr-2" />
                                Manage Subscription
                              </Button>
                            </Link>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <p className="text-2xl font-bold text-primary">
                              {organization.usage?.components_this_month || 0}
                            </p>
                            <p className="text-sm text-muted-foreground">Components Used</p>
                          </div>
                          <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <p className="text-2xl font-bold text-primary">
                              {organization.quotas?.components_per_month || 100}
                            </p>
                            <p className="text-sm text-muted-foreground">Monthly Limit</p>
                          </div>
                          <div className="p-4 bg-muted/30 rounded-lg text-center">
                            <p className="text-2xl font-bold text-primary">
                              {organization.quotas?.max_repositories || 1}
                            </p>
                            <p className="text-sm text-muted-foreground">Max Repositories</p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Documentation Tab */}
              <TabsContent value="documentation">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Documentation Preferences</CardTitle>
                    <CardDescription>Configure default documentation settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Default Documentation Style</label>
                        <Select value={settings.docStyle} onValueChange={(v) => setSettings({...settings, docStyle: v})}>
                          <SelectTrigger className="bg-muted/50 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="google">Google Style</SelectItem>
                            <SelectItem value="numpy">NumPy Style</SelectItem>
                            <SelectItem value="sphinx">Sphinx</SelectItem>
                            <SelectItem value="jsdoc">JSDoc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Default Language</label>
                        <Select value={settings.defaultLanguage} onValueChange={(v) => setSettings({...settings, defaultLanguage: v})}>
                          <SelectTrigger className="bg-muted/50 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="python">Python</SelectItem>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="typescript">TypeScript</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Auto-generate on Push</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically generate documentation when code is pushed
                        </p>
                      </div>
                      <Switch 
                        checked={settings.autoGenerate}
                        onCheckedChange={(v) => setSettings({...settings, autoGenerate: v})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications Tab */}
              <TabsContent value="notifications">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Notification Settings</CardTitle>
                    <CardDescription>Manage how you receive notifications</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Email Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Receive email updates about documentation generation
                        </p>
                      </div>
                      <Switch 
                        checked={settings.emailNotifications}
                        onCheckedChange={(v) => setSettings({...settings, emailNotifications: v})}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Browser Notifications</p>
                        <p className="text-sm text-muted-foreground">
                          Show desktop notifications when jobs complete
                        </p>
                      </div>
                      <Switch 
                        checked={settings.browserNotifications}
                        onCheckedChange={(v) => setSettings({...settings, browserNotifications: v})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Appearance Settings</CardTitle>
                    <CardDescription>Customize the look and feel</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Dark Mode</p>
                        <p className="text-sm text-muted-foreground">
                          Use dark theme for the interface
                        </p>
                      </div>
                      <Switch 
                        checked={settings.darkMode}
                        onCheckedChange={(v) => setSettings({...settings, darkMode: v})}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Editor Font Size</label>
                      <Select value={settings.editorFontSize} onValueChange={(v) => setSettings({...settings, editorFontSize: v})}>
                        <SelectTrigger className="w-48 bg-muted/50 border-white/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12px</SelectItem>
                          <SelectItem value="14">14px</SelectItem>
                          <SelectItem value="16">16px</SelectItem>
                          <SelectItem value="18">18px</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium">Show Line Numbers</p>
                        <p className="text-sm text-muted-foreground">
                          Display line numbers in code editor
                        </p>
                      </div>
                      <Switch 
                        checked={settings.showLineNumbers}
                        onCheckedChange={(v) => setSettings({...settings, showLineNumbers: v})}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
