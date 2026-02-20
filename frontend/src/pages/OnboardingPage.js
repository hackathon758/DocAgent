import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  User,
  GitBranch,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  Rocket,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const steps = [
  { number: 1, title: 'Profile Setup', icon: User },
  { number: 2, title: 'Connect Repository', icon: GitBranch },
  { number: 3, title: 'Generate First Doc', icon: FileText },
];

const OnboardingPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(1);
  const [completing, setCompleting] = useState(false);

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await axios.put(
        `${API_URL}/api/auth/me`,
        { settings: { onboarding_completed: true } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Onboarding complete! Welcome to DocAgent.');
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete onboarding. Please try again.');
    } finally {
      setCompleting(false);
    }
  };

  // --- Step indicator progress bar ---
  const StepIndicator = () => (
    <div className="flex items-center justify-center w-full mb-8">
      {steps.map((step, index) => {
        const StepIcon = step.icon;
        const isActive = currentStep === step.number;
        const isCompleted = currentStep > step.number;

        return (
          <div key={step.number} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isCompleted
                    ? 'bg-primary border-primary text-primary-foreground'
                    : isActive
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-white/20 bg-muted/30 text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <StepIcon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`
                  text-xs mt-2 font-medium transition-colors duration-300
                  ${isActive ? 'text-primary' : isCompleted ? 'text-primary/70' : 'text-muted-foreground'}
                `}
              >
                {step.title}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`
                  w-24 h-0.5 mx-3 mb-6 transition-colors duration-300
                  ${currentStep > step.number ? 'bg-primary' : 'bg-white/10'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // --- Step 1: Profile Setup ---
  const ProfileStep = () => (
    <Card className="bg-card border-white/5">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-heading">Set Up Your Profile</CardTitle>
        <CardDescription>
          Review your information and personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden border-2 border-white/10">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-primary" />
              )}
            </div>
            <label
              htmlFor="avatar-upload"
              className="absolute inset-0 rounded-full cursor-pointer flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="text-xs text-white font-medium">Upload</span>
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          {avatarFile && (
            <Badge variant="secondary" className="text-xs">
              {avatarFile.name}
            </Badge>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="onboarding-name">Full Name</Label>
          <Input
            id="onboarding-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="bg-muted/50 border-white/10"
          />
        </div>

        {/* Email (read-only) */}
        <div className="space-y-2">
          <Label htmlFor="onboarding-email">Email Address</Label>
          <Input
            id="onboarding-email"
            type="email"
            value={user?.email || ''}
            disabled
            className="bg-muted/30 border-white/5 text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">
            Your email address cannot be changed here.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // --- Step 2: Connect Repository ---
  const ConnectRepoStep = () => (
    <Card className="bg-card border-white/5">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-heading">Connect a Repository</CardTitle>
        <CardDescription>
          Link a GitHub repository so DocAgent can analyze your codebase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <GitBranch className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <p className="text-sm text-muted-foreground">
              Connect your GitHub repository to enable automatic code analysis and
              documentation generation. You can connect additional repositories later.
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => navigate('/repositories')}
          >
            <GitBranch className="w-4 h-4" />
            Connect GitHub Repository
          </Button>
          <p className="text-xs text-muted-foreground">
            You can skip this step and connect a repository later from the Repositories page.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  // --- Step 3: Generate First Doc ---
  const GenerateDocStep = () => (
    <Card className="bg-card border-white/5">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-heading">Generate Your First Documentation</CardTitle>
        <CardDescription>
          You are all set to start generating documentation for your projects
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="w-10 h-10 text-primary" />
          </div>
          <div className="text-center space-y-2 max-w-md">
            <p className="text-sm text-muted-foreground">
              DocAgent uses AI to analyze your codebase and produce comprehensive, high-quality
              documentation. Click below to generate documentation for a connected repository.
            </p>
          </div>
          <Button
            size="lg"
            className="gap-2"
            onClick={() => navigate('/dashboard')}
          >
            <FileText className="w-4 h-4" />
            Go to Dashboard
          </Button>
          <p className="text-xs text-muted-foreground">
            Paste a GitHub URL on the dashboard to generate documentation.
          </p>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <ProfileStep />;
      case 2:
        return <ConnectRepoStep />;
      case 3:
        return <GenerateDocStep />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Dialog-style centered container */}
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading font-bold tracking-tight">
            Welcome to DocAgent
          </h1>
          <p className="text-muted-foreground mt-2">
            Let's get you set up in just a few steps
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator />

        {/* Step content */}
        <div className="mb-6">
          {renderStep()}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="gap-2 border-white/10"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>

          {currentStep < 3 ? (
            <Button className="gap-2" onClick={handleNext}>
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              className="gap-2"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Completing...
                </span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Complete Setup
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
