# Contributing to RAG Studio

Thank you for contributing! 🎉

## Quick Start

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/rag-studio.git
cd rag-studio

# Install dependencies
cd apps/web && npm install
cd ../api && pip install -r requirements-dev.txt

# Start development
docker-compose -f docker/docker-compose.dev.yml up -d
```

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test
3. Commit: `git commit -m "feat: add feature"`
4. Push and create PR

## Commit Convention

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Tests
- `refactor`: Code refactoring

## Code Style

**TypeScript/React:**
- Use functional components
- Type everything
- Follow ESLint rules

**Python:**
- Follow PEP 8
- Use type hints
- Black formatting

## Testing

```bash
# Frontend
cd apps/web && npm test

# Backend  
cd apps/api && pytest
```

## Questions?

- Discord: https://discord.gg/ragstudio
- Issues: https://github.com/yourusername/rag-studio/issues
