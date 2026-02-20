import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  Code, 
  Zap, 
  GitBranch, 
  BarChart3, 
  Shield,
  ChevronRight,
  Sparkles,
  Bot,
  Check,
  ArrowRight,
  Github
} from 'lucide-react';

const LandingPage = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: Bot,
      title: "Multi-Agent AI System",
      description: "Specialized AI agents work together to analyze, write, verify, and visualize documentation."
    },
    {
      icon: Code,
      title: "Code-Aware Analysis",
      description: "Deep understanding of code structure, dependencies, and architecture for context-rich documentation."
    },
    {
      icon: Zap,
      title: "Real-Time Generation",
      description: "Watch as documentation is generated live with progress tracking and instant previews."
    },
    {
      icon: GitBranch,
      title: "GitHub Integration",
      description: "Connect your repositories and auto-generate docs on push events."
    },
    {
      icon: BarChart3,
      title: "Quality Analytics",
      description: "Track documentation coverage, quality scores, and improvement trends."
    },
    {
      icon: Shield,
      title: "Enterprise Ready",
      description: "Multi-tenant architecture with team management and role-based access."
    }
  ];

  const agentSteps = [
    { name: "Reader Agent", description: "Analyzes code structure & complexity", icon: "🔍" },
    { name: "Searcher Agent", description: "Gathers context & best practices", icon: "🔎" },
    { name: "Writer Agent", description: "Generates comprehensive docs", icon: "✍️" },
    { name: "Verifier Agent", description: "Validates accuracy & completeness", icon: "✅" },
    { name: "Diagram Agent", description: "Creates visual representations", icon: "📊" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-xl text-foreground">DocAgent</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-6">
              <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </Link>
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/dashboard">
                  <Button data-testid="go-to-dashboard-btn" className="rounded-full">
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" data-testid="login-btn" className="text-muted-foreground hover:text-foreground">
                      Log in
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button data-testid="get-started-btn" className="rounded-full glow-blue">
                      Get Started Free
                      <Sparkles className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">Powered by Llama AI</span>
            </div>
            
            <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="text-foreground">Transform Code into</span>
              <br />
              <span className="gradient-text">Beautiful Documentation</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
              DocAgent uses a multi-agent AI system to automatically generate comprehensive, 
              context-aware documentation with diagrams, examples, and quality verification.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button 
                  size="lg" 
                  data-testid="hero-cta-btn"
                  className="rounded-full px-8 py-6 text-lg font-medium glow-blue hover:scale-105 transition-transform"
                >
                  Start Documenting Free
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button 
                  variant="outline" 
                  size="lg"
                  data-testid="view-pricing-btn"
                  className="rounded-full px-8 py-6 text-lg border-white/10 hover:bg-white/5"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mt-16">
              {[
                { value: "85%", label: "Automation Rate" },
                { value: "90%", label: "Accuracy Score" },
                { value: "<5min", label: "Generation Time" }
              ].map((stat, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl md:text-4xl font-heading font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl md:text-5xl font-semibold tracking-tight mb-4">
              How the <span className="gradient-text">Multi-Agent System</span> Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Five specialized AI agents collaborate to produce high-quality documentation
            </p>
          </motion.div>

          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent hidden md:block" />
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {agentSteps.map((step, index) => (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <div className="bg-card border border-white/5 rounded-xl p-6 text-center hover:border-primary/50 transition-colors group">
                    <div className="text-4xl mb-4">{step.icon}</div>
                    <h3 className="font-heading font-semibold text-foreground mb-2">{step.name}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    
                    {/* Step number */}
                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-sm font-bold text-white">
                      {index + 1}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading text-3xl md:text-5xl font-semibold tracking-tight mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete platform for automated documentation generation and management
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card border border-white/5 rounded-xl p-6 hover:border-primary/50 transition-all hover:-translate-y-1 group"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Ready to Transform Your Documentation?
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join thousands of developers who save hours every week with AI-powered documentation.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/register">
                <Button 
                  size="lg" 
                  data-testid="cta-get-started-btn"
                  className="rounded-full px-8 py-6 text-lg font-medium glow-blue hover:scale-105 transition-transform"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  variant="outline"
                  size="lg"
                  data-testid="github-connect-btn"
                  className="rounded-full px-8 py-6 text-lg border-white/10 hover:bg-white/5"
                >
                  <Github className="w-5 h-5 mr-2" />
                  Connect with GitHub
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-8 mt-12">
              {["No credit card required", "14-day free trial", "Cancel anytime"].map((text, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-bold text-lg">DocAgent</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            </div>
            
            <div className="text-sm text-muted-foreground">
              © 2025 DocAgent. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
