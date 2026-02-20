import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  Check,
  Zap,
  Star,
  ArrowLeft,
  Crown,
  Building2,
  Users,
  FolderGit2,
  Sparkles
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PricingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tiers, setTiers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(null);

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/organizations/subscription-tiers`);
      setTiers(response.data);
    } catch (error) {
      console.error('Failed to fetch tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierName) => {
    if (!user) {
      navigate('/register');
      return;
    }

    setUpgrading(tierName);
    try {
      await axios.post(`${API_URL}/api/organizations/upgrade?tier=${tierName}`);
      toast.success(`Upgraded to ${tierName} plan! (Demo mode)`);
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to upgrade');
    } finally {
      setUpgrading(null);
    }
  };

  const pricingPlans = [
    {
      name: 'Free',
      key: 'free',
      price: 0,
      description: 'Perfect for trying out DocAgent',
      icon: Sparkles,
      color: 'text-muted-foreground',
      features: [
        '100 components/month',
        '1 repository',
        '1 team member',
        'Basic docstrings',
        'CLI access only'
      ],
      cta: 'Get Started',
      popular: false
    },
    {
      name: 'Starter',
      key: 'starter',
      price: 29,
      description: 'For individuals and small projects',
      icon: Zap,
      color: 'text-blue-400',
      features: [
        '1,000 components/month',
        '5 repositories',
        '5 team members',
        'Web UI access',
        'Diagram generation',
        'GitHub integration'
      ],
      cta: 'Start Free Trial',
      popular: false
    },
    {
      name: 'Professional',
      key: 'professional',
      price: 99,
      description: 'For growing teams',
      icon: Star,
      color: 'text-primary',
      features: [
        '10,000 components/month',
        '20 repositories',
        '20 team members',
        'Advanced diagrams',
        'Priority support',
        'API access',
        'Custom templates'
      ],
      cta: 'Start Free Trial',
      popular: true
    },
    {
      name: 'Team',
      key: 'team',
      price: 299,
      description: 'For organizations',
      icon: Users,
      color: 'text-purple-400',
      features: [
        '50,000 components/month',
        'Unlimited repositories',
        '50 team members',
        'SSO authentication',
        'Analytics dashboard',
        'Custom templates',
        'Dedicated support'
      ],
      cta: 'Contact Sales',
      popular: false
    },
    {
      name: 'Enterprise',
      key: 'enterprise',
      price: -1,
      description: 'Custom solutions',
      icon: Crown,
      color: 'text-yellow-400',
      features: [
        'Unlimited components',
        'Unlimited repositories',
        'Unlimited team members',
        'On-premises option',
        'SLA guarantee',
        'Dedicated account manager',
        'Custom integrations'
      ],
      cta: 'Contact Sales',
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/5 bg-card/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl">DocAgent</span>
          </Link>
          
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard">
                <Button variant="outline" className="border-white/10">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link to="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4"
        >
          <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that's right for you. All plans include a 14-day free trial.
          </p>
        </motion.div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`bg-card border-white/5 h-full flex flex-col relative ${
                    plan.popular ? 'ring-2 ring-primary' : ''
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className={`w-12 h-12 mx-auto mb-4 rounded-xl bg-white/5 flex items-center justify-center`}>
                      <plan.icon className={`w-6 h-6 ${plan.color}`} />
                    </div>
                    <CardTitle className="font-heading text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    <div className="text-center mb-6">
                      {plan.price === -1 ? (
                        <span className="text-3xl font-heading font-bold">Custom</span>
                      ) : (
                        <>
                          <span className="text-4xl font-heading font-bold">${plan.price}</span>
                          <span className="text-muted-foreground">/month</span>
                        </>
                      )}
                    </div>

                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className={`w-full mt-6 ${plan.popular ? '' : 'variant-outline'}`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={upgrading === plan.key || (user?.subscription_tier === plan.key)}
                    >
                      {upgrading === plan.key ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </span>
                      ) : user?.subscription_tier === plan.key ? (
                        'Current Plan'
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ or Features comparison could go here */}
      <section className="py-20 border-t border-white/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl font-bold mb-4">Need Help Choosing?</h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Our team is here to help you find the perfect plan for your needs.
            Contact us for a personalized recommendation.
          </p>
          <Button size="lg" variant="outline" className="border-white/10">
            <Building2 className="w-5 h-5 mr-2" />
            Contact Sales
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2025 DocAgent. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
