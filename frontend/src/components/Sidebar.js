import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  FileText,
  FolderGit2,
  Settings,
  Home,
  Zap,
  BarChart3,
  Shield,
  Cpu
} from 'lucide-react';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Add admin link for owners/admins
  if (user?.role === 'owner' || user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: Shield, label: 'Admin' });
  }

  return (
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
            const isActive = location.pathname === item.path || 
              (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
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
  );
};

export default Sidebar;
