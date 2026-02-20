import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  User,
  Bell,
  Shield,
  Palette,
  Code,
  Save,
  Building2,
  CreditCard,
  Key,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Layout,
  Plug,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Star,
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
  const { theme } = useTheme();
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

  // API Keys state
  const [apiKeys, setApiKeys] = useState([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState(['read', 'write']);
  const [createdKey, setCreatedKey] = useState(null);
  const [showCreatedKeyDialog, setShowCreatedKeyDialog] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '', description: '', language: 'python', content: '', sections: ['overview', 'parameters', 'returns', 'examples']
  });

  // Integrations state
  const [integrations, setIntegrations] = useState([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);

  useEffect(() => {
    fetchOrganization();
    // Load saved user preferences from localStorage
    const savedSettings = localStorage.getItem('docagent_settings');
    if (savedSettings) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
      } catch {}
    }
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
    try {
      // Persist user preferences to localStorage
      localStorage.setItem('docagent_settings', JSON.stringify(settings));

      // If organization data changed, update via API
      if (organization) {
        await axios.put(`${API_URL}/api/organizations/${organization.id}`, {
          name: organization.name,
          subdomain: organization.subdomain,
        });
      }

      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ===== API KEYS =====
  const fetchApiKeys = useCallback(async () => {
    setApiKeysLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/api-keys`);
      setApiKeys(res.data || []);
    } catch { setApiKeys([]); }
    finally { setApiKeysLoading(false); }
  }, []);

  const createApiKey = async () => {
    if (!newKeyName.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/api/api-keys`, {
        name: newKeyName.trim(),
        scopes: newKeyScopes,
      });
      setCreatedKey(res.data);
      setShowCreateKeyDialog(false);
      setShowCreatedKeyDialog(true);
      setNewKeyName('');
      fetchApiKeys();
    } catch { toast.error('Failed to create API key'); }
  };

  const deleteApiKey = async (keyId) => {
    if (!window.confirm('Delete this API key? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/api/api-keys/${keyId}`);
      setApiKeys(prev => prev.filter(k => k.id !== keyId));
      toast.success('API key deleted');
    } catch { toast.error('Failed to delete API key'); }
  };

  const rotateApiKey = async (keyId) => {
    if (!window.confirm('Rotate this API key? The old key will stop working.')) return;
    try {
      const res = await axios.post(`${API_URL}/api/api-keys/${keyId}/rotate`);
      setCreatedKey(res.data);
      setShowCreatedKeyDialog(true);
      fetchApiKeys();
    } catch { toast.error('Failed to rotate API key'); }
  };

  // ===== TEMPLATES =====
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/templates`);
      setTemplates(res.data || []);
    } catch { setTemplates([]); }
    finally { setTemplatesLoading(false); }
  }, []);

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', language: 'python', content: '', sections: ['overview', 'parameters', 'returns', 'examples'] });
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      language: template.language || 'python',
      content: template.content || '',
      sections: template.sections || [],
    });
    setShowTemplateDialog(true);
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    try {
      if (editingTemplate) {
        await axios.put(`${API_URL}/api/templates/${editingTemplate.id}`, templateForm);
        toast.success('Template updated');
      } else {
        await axios.post(`${API_URL}/api/templates`, templateForm);
        toast.success('Template created');
      }
      setShowTemplateDialog(false);
      fetchTemplates();
    } catch { toast.error('Failed to save template'); }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await axios.delete(`${API_URL}/api/templates/${templateId}`);
      setTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template deleted');
    } catch { toast.error('Failed to delete template'); }
  };

  const setDefaultTemplate = async (templateId) => {
    try {
      await axios.post(`${API_URL}/api/templates/${templateId}/set-default`);
      fetchTemplates();
      toast.success('Default template updated');
    } catch { toast.error('Failed to set default template'); }
  };

  // ===== INTEGRATIONS =====
  const fetchIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/integrations`);
      setIntegrations(res.data || []);
    } catch { setIntegrations([]); }
    finally { setIntegrationsLoading(false); }
  }, []);

  const connectSlack = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/integrations/slack/connect`);
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch { toast.error('Failed to start Slack connection'); }
  };

  const disconnectSlack = async () => {
    if (!window.confirm('Disconnect Slack?')) return;
    try {
      await axios.post(`${API_URL}/api/integrations/slack/disconnect`);
      setIntegrations(prev => prev.filter(i => i.type !== 'slack'));
      toast.success('Slack disconnected');
    } catch { toast.error('Failed to disconnect Slack'); }
  };

  const testSlack = async () => {
    try {
      await axios.post(`${API_URL}/api/integrations/slack/test`);
      toast.success('Test message sent to Slack');
    } catch { toast.error('Slack test failed'); }
  };

  const slackIntegration = integrations.find(i => i.type === 'slack');

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <TopBar title="Settings" />

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
                <TabsTrigger value="billing" className="gap-2">
                  <CreditCard className="w-4 h-4" />
                  Billing
                </TabsTrigger>
                <TabsTrigger value="apikeys" className="gap-2">
                  <Key className="w-4 h-4" />
                  API Keys
                </TabsTrigger>
                <TabsTrigger value="templates" className="gap-2" onClick={() => { if (templates.length === 0) fetchTemplates(); }}>
                  <Layout className="w-4 h-4" />
                  Templates
                </TabsTrigger>
                <TabsTrigger value="integrations" className="gap-2" onClick={() => { if (integrations.length === 0) fetchIntegrations(); }}>
                  <Plug className="w-4 h-4" />
                  Integrations
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
                        <Select value={settings.docStyle} onValueChange={(v) => setSettings({ ...settings, docStyle: v })}>
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
                        <Select value={settings.defaultLanguage} onValueChange={(v) => setSettings({ ...settings, defaultLanguage: v })}>
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
                        onCheckedChange={(v) => setSettings({ ...settings, autoGenerate: v })}
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
                        onCheckedChange={(v) => setSettings({ ...settings, emailNotifications: v })}
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
                        onCheckedChange={(v) => setSettings({ ...settings, browserNotifications: v })}
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
                        onCheckedChange={(v) => setSettings({ ...settings, darkMode: v })}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Editor Font Size</label>
                      <Select value={settings.editorFontSize} onValueChange={(v) => setSettings({ ...settings, editorFontSize: v })}>
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
                        onCheckedChange={(v) => setSettings({ ...settings, showLineNumbers: v })}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Billing Tab */}
              <TabsContent value="billing">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Billing & Subscription</CardTitle>
                    <CardDescription>Manage your plan and usage</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Current Plan</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {organization?.subscription?.tier || user?.subscription_tier || 'Free'} Plan
                          </p>
                        </div>
                        <Link to="/pricing">
                          <Button variant="outline" className="border-white/10">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Upgrade Plan
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="font-medium text-sm">Usage This Month</p>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Components</span>
                            <span>{organization?.usage?.components_this_month || 0} / {organization?.quotas?.components_per_month || 100}</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(((organization?.usage?.components_this_month || 0) / (organization?.quotas?.components_per_month || 100)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Repositories</span>
                            <span>- / {organization?.quotas?.max_repositories || 1}</span>
                          </div>
                          <div className="w-full bg-muted/50 rounded-full h-2">
                            <div className="bg-primary h-2 rounded-full" style={{ width: '10%' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* API Keys Tab */}
              <TabsContent value="apikeys">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>API Keys</CardTitle>
                        <CardDescription>Manage API keys for programmatic access</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => { setShowCreateKeyDialog(true); if (apiKeys.length === 0) fetchApiKeys(); }}>
                        <Plus className="w-4 h-4 mr-1" />
                        Create Key
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {apiKeysLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : apiKeys.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No API keys yet</p>
                        <p className="text-xs mt-1">Create a key to access the DocAgent API</p>
                        <Button size="sm" className="mt-3" onClick={() => { setShowCreateKeyDialog(true); fetchApiKeys(); }}>
                          <Plus className="w-4 h-4 mr-1" />
                          Create Your First Key
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {apiKeys.map((key) => (
                          <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div>
                              <p className="font-medium text-sm">{key.name}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <code className="text-xs bg-muted/50 px-2 py-0.5 rounded font-mono">{key.key_prefix}...</code>
                                <span className="text-xs text-muted-foreground">
                                  Created {key.created_at ? new Date(key.created_at).toLocaleDateString() : 'N/A'}
                                </span>
                                {key.last_used_at && (
                                  <span className="text-xs text-muted-foreground">
                                    Last used {new Date(key.last_used_at).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-1 mt-1">
                                {(key.scopes || []).map(scope => (
                                  <Badge key={scope} variant="outline" className="text-[10px] h-5">{scope}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => rotateApiKey(key.id)} title="Rotate key">
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteApiKey(key.id)} title="Delete key">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-4 text-sm text-muted-foreground">
                      <p>Include the key in the Authorization header: <code className="text-xs bg-muted/50 px-1 py-0.5 rounded">Bearer YOUR_API_KEY</code></p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Templates Tab */}
              <TabsContent value="templates">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Documentation Templates</CardTitle>
                        <CardDescription>Manage templates for documentation generation</CardDescription>
                      </div>
                      <Button size="sm" onClick={openCreateTemplate}>
                        <Plus className="w-4 h-4 mr-1" />
                        Create Template
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {templatesLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : templates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Layout className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No templates yet</p>
                        <Button size="sm" className="mt-3" onClick={openCreateTemplate}>
                          <Plus className="w-4 h-4 mr-1" />
                          Create First Template
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {templates.map((template) => (
                          <div key={template.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{template.name}</p>
                                {template.is_default && (
                                  <Badge className="bg-primary/20 text-primary text-[10px] h-5">
                                    <Star className="w-3 h-3 mr-0.5" />
                                    Default
                                  </Badge>
                                )}
                                {template.language && (
                                  <Badge variant="outline" className="text-[10px] h-5">{template.language}</Badge>
                                )}
                              </div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-1 truncate">{template.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {!template.is_default && (
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setDefaultTemplate(template.id)}>
                                  Set Default
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(template)}>
                                <Code className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteTemplate(template.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integrations Tab */}
              <TabsContent value="integrations">
                <Card className="bg-card border-white/5">
                  <CardHeader>
                    <CardTitle>Integrations</CardTitle>
                    <CardDescription>Connect third-party services</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
                            <MessageSquare className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium">Slack</p>
                            <p className="text-sm text-muted-foreground">
                              {slackIntegration
                                ? `Connected to ${slackIntegration.metadata?.team_name || 'workspace'}`
                                : 'Send notifications to your Slack workspace'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {slackIntegration ? (
                            <>
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                              <Button variant="outline" size="sm" onClick={testSlack}>
                                Test
                              </Button>
                              <Button variant="outline" size="sm" className="text-destructive" onClick={disconnectSlack}>
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" onClick={connectSlack}>
                              <Plug className="w-4 h-4 mr-1" />
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                      {slackIntegration?.metadata?.channel && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">
                            Channel: <span className="font-medium text-foreground">{slackIntegration.metadata.channel}</span>
                          </p>
                        </div>
                      )}
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

      {/* Create API Key Dialog */}
      <Dialog open={showCreateKeyDialog} onOpenChange={setShowCreateKeyDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Key Name</Label>
              <Input
                placeholder="e.g., Production API"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Scopes</Label>
              <div className="flex gap-3 mt-2">
                {['read', 'write', 'admin'].map(scope => (
                  <label key={scope} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes(scope)}
                      onChange={(e) => {
                        if (e.target.checked) setNewKeyScopes(prev => [...prev, scope]);
                        else setNewKeyScopes(prev => prev.filter(s => s !== scope));
                      }}
                      className="rounded"
                    />
                    <span className="capitalize">{scope}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKeyDialog(false)}>Cancel</Button>
            <Button onClick={createApiKey} disabled={!newKeyName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created Key Display Dialog */}
      <Dialog open={showCreatedKeyDialog} onOpenChange={setShowCreatedKeyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Copy your API key now. You won't be able to see it again.
            </p>
            <div className="p-3 bg-muted/50 rounded-lg">
              <code className="text-xs font-mono break-all">{createdKey?.key}</code>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(createdKey?.key || '');
                toast.success('API key copied');
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy to Clipboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Create/Edit Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Template name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Language</Label>
                <Select value={templateForm.language} onValueChange={(v) => setTemplateForm(prev => ({ ...prev, language: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="python">Python</SelectItem>
                    <SelectItem value="javascript">JavaScript</SelectItem>
                    <SelectItem value="typescript">TypeScript</SelectItem>
                    <SelectItem value="java">Java</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Template Content</Label>
              <div className="mt-1 border border-border rounded-md overflow-hidden h-[200px]">
                <Editor
                  height="100%"
                  language="markdown"
                  value={templateForm.content}
                  onChange={(value) => setTemplateForm(prev => ({ ...prev, content: value || '' }))}
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTemplate}>{editingTemplate ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
