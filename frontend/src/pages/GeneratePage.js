import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  FileText,
  FolderGit2,
  Settings,
  Home,
  Zap,
  Play,
  Code,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
  GitBranch,
  Cpu
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SAMPLE_CODE = {
  python: `def calculate_fibonacci(n: int) -> list:
    """
    Calculate the Fibonacci sequence up to n numbers.
    
    Args:
        n: The number of Fibonacci numbers to generate
        
    Returns:
        A list containing the first n Fibonacci numbers
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    
    fib_sequence = [0, 1]
    while len(fib_sequence) < n:
        next_num = fib_sequence[-1] + fib_sequence[-2]
        fib_sequence.append(next_num)
    
    return fib_sequence`,
  javascript: `function calculateFibonacci(n) {
  /**
   * Calculate the Fibonacci sequence up to n numbers.
   * @param {number} n - The number of Fibonacci numbers to generate
   * @returns {number[]} An array containing the first n Fibonacci numbers
   */
  if (n <= 0) return [];
  if (n === 1) return [0];
  
  const fibSequence = [0, 1];
  while (fibSequence.length < n) {
    const nextNum = fibSequence[fibSequence.length - 1] + fibSequence[fibSequence.length - 2];
    fibSequence.push(nextNum);
  }
  
  return fibSequence;
}`,
  typescript: `interface FibResult {
  sequence: number[];
  sum: number;
}

function calculateFibonacci(n: number): FibResult {
  if (n <= 0) return { sequence: [], sum: 0 };
  if (n === 1) return { sequence: [0], sum: 0 };
  
  const sequence: number[] = [0, 1];
  while (sequence.length < n) {
    const nextNum = sequence[sequence.length - 1] + sequence[sequence.length - 2];
    sequence.push(nextNum);
  }
  
  return {
    sequence,
    sum: sequence.reduce((a, b) => a + b, 0)
  };
}`
};

const GeneratePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [code, setCode] = useState(SAMPLE_CODE.python);
  const [language, setLanguage] = useState('python');
  const [style, setStyle] = useState('google');
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [componentPath, setComponentPath] = useState('example/fibonacci.py');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState('');
  const [result, setResult] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchRepositories();
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    setCode(SAMPLE_CODE[language] || SAMPLE_CODE.python);
    const extensions = { python: '.py', javascript: '.js', typescript: '.ts' };
    setComponentPath(`example/fibonacci${extensions[language] || '.py'}`);
  }, [language]);

  const fetchRepositories = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/repositories`);
      setRepositories(response.data);
      if (response.data.length > 0) {
        setSelectedRepo(response.data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error);
    }
  };

  const handleGenerate = async () => {
    if (!code.trim()) {
      toast.error('Please enter some code to generate documentation');
      return;
    }

    if (!selectedRepo) {
      toast.error('Please select or create a repository first');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setCurrentStage('Starting...');
    setResult(null);

    try {
      const response = await axios.post(`${API_URL}/api/documentation/generate`, {
        repository_id: selectedRepo,
        component_path: componentPath,
        source_code: code,
        language,
        style
      });

      const jobId = response.data.id;
      
      // Poll for job status
      const pollInterval = setInterval(async () => {
        try {
          const jobResponse = await axios.get(`${API_URL}/api/jobs/${jobId}`);
          const job = jobResponse.data;
          
          setProgress(job.progress || 0);
          setCurrentStage(job.current_stage || job.status);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setResult(job.result);
            setGenerating(false);
            toast.success('Documentation generated successfully!');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setGenerating(false);
            toast.error(job.error || 'Generation failed');
          }
        } catch (e) {
          console.error('Poll error:', e);
        }
      }, 1000);

    } catch (error) {
      console.error('Generate error:', error);
      toast.error('Failed to start generation');
      setGenerating(false);
    }
  };

  const navItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/repositories', icon: FolderGit2, label: 'Repositories' },
    { path: '/documentation', icon: FileText, label: 'Documentation' },
    { path: '/generate', icon: Zap, label: 'Generate' },
    { path: '/models', icon: Cpu, label: 'AI Models' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const stages = [
    { name: 'Analyzing code structure...', icon: Code },
    { name: 'Gathering context...', icon: BookOpen },
    { name: 'Writing documentation...', icon: FileText },
    { name: 'Verifying quality...', icon: CheckCircle2 },
    { name: 'Generating diagrams...', icon: GitBranch },
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/5 bg-card/50 flex items-center px-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-primary" />
            <h1 className="font-heading text-xl font-bold">Generate Documentation</h1>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Code Input */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="w-5 h-5" />
                    Source Code
                  </CardTitle>
                  <CardDescription>
                    Paste your code below or use the sample code
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="bg-muted/50 border-white/10">
                        <SelectValue placeholder="Language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="python">Python</SelectItem>
                        <SelectItem value="javascript">JavaScript</SelectItem>
                        <SelectItem value="typescript">TypeScript</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={style} onValueChange={setStyle}>
                      <SelectTrigger className="bg-muted/50 border-white/10">
                        <SelectValue placeholder="Doc Style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="google">Google Style</SelectItem>
                        <SelectItem value="numpy">NumPy Style</SelectItem>
                        <SelectItem value="sphinx">Sphinx</SelectItem>
                        <SelectItem value="jsdoc">JSDoc</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                      <SelectTrigger className="bg-muted/50 border-white/10">
                        <SelectValue placeholder="Select Repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map(repo => (
                          <SelectItem key={repo.id} value={repo.id}>{repo.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <input
                      type="text"
                      value={componentPath}
                      onChange={(e) => setComponentPath(e.target.value)}
                      placeholder="Component path"
                      className="h-10 px-4 rounded-md bg-muted/50 border border-white/10 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="h-[400px] rounded-lg overflow-hidden border border-white/10">
                    <Editor
                      height="100%"
                      language={language}
                      value={code}
                      onChange={(value) => setCode(value || '')}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                      }}
                    />
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg" 
                    onClick={handleGenerate}
                    disabled={generating || !selectedRepo}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Generate Documentation
                      </>
                    )}
                  </Button>

                  {repositories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      <Link to="/repositories" className="text-primary hover:underline">
                        Create a repository
                      </Link>{' '}
                      first to start generating documentation
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Generation Progress / Result */}
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Generated Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {generating ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{currentStage}</span>
                          <span className="text-sm text-muted-foreground">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>

                      <div className="space-y-3">
                        {stages.map((stage, index) => {
                          const stageProgress = (index + 1) * 20;
                          const isComplete = progress >= stageProgress;
                          const isCurrent = progress >= stageProgress - 20 && progress < stageProgress;
                          
                          return (
                            <div 
                              key={stage.name}
                              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                                isComplete ? 'bg-green-500/10' : isCurrent ? 'bg-primary/10' : 'bg-muted/30'
                              }`}
                            >
                              {isComplete ? (
                                <CheckCircle2 className="w-5 h-5 text-green-400" />
                              ) : isCurrent ? (
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                              ) : (
                                <stage.icon className="w-5 h-5 text-muted-foreground" />
                              )}
                              <span className={isComplete ? 'text-green-400' : isCurrent ? 'text-primary' : 'text-muted-foreground'}>
                                {stage.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : result ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        <span className="text-green-400 font-medium">Documentation generated successfully!</span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Quality Score</h4>
                          <div className="flex items-center gap-3">
                            <Progress value={result.quality_score || 0} className="flex-1" />
                            <span className="text-lg font-bold text-primary">
                              {result.quality_score?.toFixed(0) || 0}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-sm font-medium mb-2">Generated Docstring</h4>
                          <div className="bg-muted/30 rounded-lg p-4 max-h-48 overflow-auto">
                            <pre className="text-sm whitespace-pre-wrap">{result.docstring}</pre>
                          </div>
                        </div>

                        <Button 
                          className="w-full" 
                          onClick={() => navigate(`/documentation/${result.documentation_id}`)}
                        >
                          View Full Documentation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Sparkles className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-2">
                        Paste your code and click generate
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Our multi-agent AI system will analyze, write, verify, and visualize your documentation
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default GeneratePage;
