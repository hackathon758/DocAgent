import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'docagent')

# Bytez API
BYTEZ_API_KEY = os.environ.get('BYTEZ_API_KEY', '')
BYTEZ_API_URL = "https://api.bytez.com/models/v2"

# JWT
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 15
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30

# GitHub OAuth
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '')
GITHUB_CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

# CORS
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(',')

# AI Models via Bytez
AI_MODELS = {
    "reader": {
        "id": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "name": "Qwen 2.5 Coder 7B (Reader)",
        "description": "Qwen code-focused model for code analysis and understanding (Reader Agent)",
        "tasks": ["code-analysis", "code-understanding", "documentation"]
    },
    "qwen-coder-7b": {
        "id": "Qwen/Qwen2.5-Coder-7B-Instruct",
        "name": "Qwen 2.5 Coder 7B",
        "description": "Qwen code-focused model for search and context retrieval (Search Agent)",
        "tasks": ["code-analysis", "documentation", "code-generation"]
    },
    "writer": {
        "id": "Qwen/Qwen2.5-Coder-3B-Instruct",
        "name": "Qwen 2.5 Coder 3B (Writer)",
        "description": "Qwen code-focused model for documentation writing (Writer Agent)",
        "tasks": ["code-generation", "documentation", "text-generation"]
    },
    "llama-3.1-8b": {
        "id": "meta-llama/Meta-Llama-3.1-8B-Instruct",
        "name": "Llama 3.1 8B Instruct",
        "description": "Meta Llama 3.1 for verification and diagram generation (Verifier & Diagram Agents)",
        "tasks": ["chat", "verification", "reasoning", "documentation"]
    }
}

# Subscription Tiers
SUBSCRIPTION_TIERS = {
    "free": {
        "price": 0,
        "components_per_month": 100,
        "max_repositories": 1,
        "max_team_members": 1,
        "rate_limit_per_min": 120,
        "features": ["Basic docstrings", "CLI only"]
    },
    "starter": {
        "price": 29,
        "components_per_month": 1000,
        "max_repositories": 5,
        "max_team_members": 5,
        "rate_limit_per_min": 100,
        "features": ["Web UI", "Diagrams", "GitHub integration"]
    },
    "professional": {
        "price": 99,
        "components_per_month": 10000,
        "max_repositories": 20,
        "max_team_members": 20,
        "rate_limit_per_min": 1000,
        "features": ["Advanced diagrams", "Priority support", "API access"]
    },
    "team": {
        "price": 299,
        "components_per_month": 50000,
        "max_repositories": -1,
        "max_team_members": 50,
        "rate_limit_per_min": 5000,
        "features": ["Custom templates", "SSO", "Analytics dashboard"]
    },
    "enterprise": {
        "price": -1,
        "components_per_month": -1,
        "max_repositories": -1,
        "max_team_members": -1,
        "rate_limit_per_min": 10000,
        "features": ["On-premises option", "SLA", "Dedicated support"]
    }
}

# Available local models for Ollama
AVAILABLE_LOCAL_MODELS = [
    {
        "id": "llama3.2:1b",
        "name": "Llama 3.2 1B",
        "description": "Meta's smallest Llama 3.2 model - fast and efficient for code analysis",
        "size": "1.3GB",
        "tasks": ["code-analysis", "chat", "documentation"],
        "recommended_for": ["Reader Agent", "Verifier Agent"],
        "free": True
    },
    {
        "id": "llama3.2:3b",
        "name": "Llama 3.2 3B",
        "description": "Balanced Llama 3.2 model - good quality and speed",
        "size": "2.0GB",
        "tasks": ["code-analysis", "documentation", "chat"],
        "recommended_for": ["Writer Agent", "Searcher Agent"],
        "free": True
    },
    {
        "id": "codellama:7b",
        "name": "Code Llama 7B",
        "description": "Specialized for code understanding and generation",
        "size": "3.8GB",
        "tasks": ["code-analysis", "code-generation", "documentation"],
        "recommended_for": ["Reader Agent", "Writer Agent"],
        "free": True
    },
    {
        "id": "qwen2.5-coder:1.5b",
        "name": "Qwen 2.5 Coder 1.5B",
        "description": "Alibaba's code-optimized model - excellent for documentation",
        "size": "1.0GB",
        "tasks": ["code-analysis", "documentation", "code-generation"],
        "recommended_for": ["All Agents"],
        "free": True
    },
    {
        "id": "qwen2.5-coder:7b",
        "name": "Qwen 2.5 Coder 7B",
        "description": "Larger Qwen coder model for better quality documentation",
        "size": "4.7GB",
        "tasks": ["code-analysis", "documentation", "code-generation"],
        "recommended_for": ["Writer Agent", "Diagram Agent"],
        "free": True
    },
    {
        "id": "deepseek-coder:1.3b",
        "name": "DeepSeek Coder 1.3B",
        "description": "Efficient coding model from DeepSeek",
        "size": "0.8GB",
        "tasks": ["code-analysis", "code-generation"],
        "recommended_for": ["Reader Agent"],
        "free": True
    },
    {
        "id": "deepseek-coder:6.7b",
        "name": "DeepSeek Coder 6.7B",
        "description": "Powerful coding model for complex documentation tasks",
        "size": "3.8GB",
        "tasks": ["code-analysis", "code-generation", "documentation"],
        "recommended_for": ["All Agents"],
        "free": True
    },
    {
        "id": "phi3:mini",
        "name": "Phi-3 Mini",
        "description": "Microsoft's compact but powerful model",
        "size": "2.3GB",
        "tasks": ["chat", "documentation", "reasoning"],
        "recommended_for": ["Verifier Agent"],
        "free": True
    },
    {
        "id": "mistral:7b",
        "name": "Mistral 7B",
        "description": "High-quality open model from Mistral AI",
        "size": "4.1GB",
        "tasks": ["chat", "documentation", "code-analysis"],
        "recommended_for": ["Writer Agent", "Diagram Agent"],
        "free": True
    },
    {
        "id": "gemma2:2b",
        "name": "Gemma 2 2B",
        "description": "Google's efficient open model",
        "size": "1.6GB",
        "tasks": ["chat", "documentation"],
        "recommended_for": ["Searcher Agent"],
        "free": True
    }
]
