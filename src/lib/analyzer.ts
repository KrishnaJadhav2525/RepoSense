import { FileObject, RepoMetadata, AnalysisData, KeyDirectory, EntryPoint } from '@/types/analysis';
import { estimateLanguages } from './fileSelector';

/**
 * Generate a tree view of the directory structure
 */
export function generateTreeView(files: FileObject[]): string {
  const MAX_DEPTH = 3;
  const tree: Record<string, any> = {};

  // Build tree structure
  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length > MAX_DEPTH + 1) continue; // Skip deeply nested files

    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // Leaf node (file)
        if (!current.__files) current.__files = [];
        current.__files.push(part);
      } else {
        // Directory node
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    }
  }

  // Convert tree to string representation
  function renderTree(node: any, prefix: string = '', isLast: boolean = true): string {
    let result = '';
    const entries = Object.entries(node).filter(([key]) => key !== '__files');
    const files = node.__files || [];

    // Render directories
    entries.forEach(([name, subtree], index) => {
      const isLastEntry = index === entries.length - 1 && files.length === 0;
      const connector = isLastEntry ? '└── ' : '├── ';
      const newPrefix = prefix + (isLastEntry ? '    ' : '│   ');

      result += prefix + connector + name + '/\n';
      result += renderTree(subtree, newPrefix, isLastEntry);
    });

    // Render files
    files.forEach((file: string, index: number) => {
      const isLastFile = index === files.length - 1;
      const connector = isLastFile ? '└── ' : '├── ';
      result += prefix + connector + file + '\n';
    });

    return result;
  }

  return renderTree(tree).trim();
}

/**
 * Detect frameworks used in the repository
 */
export function detectFrameworks(files: FileObject[]): string[] {
  const frameworks: Set<string> = new Set();

  // Check for package.json
  const packageJsonFile = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Common framework detection
      if (deps['next']) frameworks.add('Next.js');
      if (deps['react']) frameworks.add('React');
      if (deps['vue']) frameworks.add('Vue.js');
      if (deps['@angular/core']) frameworks.add('Angular');
      if (deps['svelte']) frameworks.add('Svelte');
      if (deps['express']) frameworks.add('Express');
      if (deps['fastify']) frameworks.add('Fastify');
      if (deps['nestjs']) frameworks.add('NestJS');
      if (deps['@nestjs/core']) frameworks.add('NestJS');
      if (deps['gatsby']) frameworks.add('Gatsby');
      if (deps['nuxt']) frameworks.add('Nuxt.js');
    } catch (error) {
      // Invalid JSON, skip
    }
  }

  // Check for config files
  const fileNames = files.map(f => f.path.split('/').pop() || '');
  if (fileNames.includes('next.config.js') || fileNames.includes('next.config.mjs')) {
    frameworks.add('Next.js');
  }
  if (fileNames.includes('vue.config.js')) frameworks.add('Vue.js');
  if (fileNames.includes('angular.json')) frameworks.add('Angular');
  if (fileNames.includes('gatsby-config.js')) frameworks.add('Gatsby');
  if (fileNames.includes('nuxt.config.js') || fileNames.includes('nuxt.config.ts')) {
    frameworks.add('Nuxt.js');
  }
  if (fileNames.includes('vite.config.js') || fileNames.includes('vite.config.ts')) {
    frameworks.add('Vite');
  }

  // Check for Python frameworks
  const requirementsFile = files.find(f => f.path.includes('requirements.txt'));
  if (requirementsFile) {
    const content = requirementsFile.content.toLowerCase();
    if (content.includes('django')) frameworks.add('Django');
    if (content.includes('flask')) frameworks.add('Flask');
    if (content.includes('fastapi')) frameworks.add('FastAPI');
  }

  // Check for Go frameworks
  const goModFile = files.find(f => f.path.includes('go.mod'));
  if (goModFile) {
    const content = goModFile.content;
    if (content.includes('gin-gonic/gin')) frameworks.add('Gin');
    if (content.includes('gorilla/mux')) frameworks.add('Gorilla');
  }

  return Array.from(frameworks);
}

/**
 * Extract key findings from AI responses
 */
export function extractKeyFindings(aiResponses: string[]): {
  entryPoints: EntryPoint[];
  patterns: string[];
  notable: string[];
} {
  const entryPoints: EntryPoint[] = [];
  const patterns: Set<string> = new Set();
  const notable: Set<string> = new Set();

  for (const response of aiResponses) {
    const lines = response.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    for (const line of lines) {
      // Extract entry points (files mentioned with descriptions)
      if (line.includes('.ts') || line.includes('.js') || line.includes('.py')) {
        const match = line.match(/([a-zA-Z0-9_\-\/\.]+\.(ts|js|py|go|java|rb))/);
        if (match) {
          const file = match[1];
          const description = line.replace(file, '').replace(/^[-*•]\s*/, '').trim();
          if (description.length > 0 && description.length < 100) {
            entryPoints.push({ file, description });
          }
        }
      }

      // Extract patterns (lines mentioning architecture, patterns, conventions)
      if (
        line.toLowerCase().includes('pattern') ||
        line.toLowerCase().includes('architecture') ||
        line.toLowerCase().includes('convention') ||
        line.toLowerCase().includes('uses') ||
        line.toLowerCase().includes('follows')
      ) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned.length > 10 && cleaned.length < 150) {
          patterns.add(cleaned);
        }
      }

      // Extract notable items (other interesting observations)
      if (
        line.toLowerCase().includes('notable') ||
        line.toLowerCase().includes('important') ||
        line.toLowerCase().includes('well-structured') ||
        line.toLowerCase().includes('comprehensive')
      ) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        if (cleaned.length > 10 && cleaned.length < 150) {
          notable.add(cleaned);
        }
      }
    }
  }

  return {
    entryPoints: entryPoints.slice(0, 5), // Limit to 5
    patterns: Array.from(patterns).slice(0, 10), // Limit to 10
    notable: Array.from(notable).slice(0, 5) // Limit to 5
  };
}

/**
 * Aggregate AI responses and file data into structured analysis
 */
export function aggregateAnalysis(
  aiResponses: string[],
  files: FileObject[],
  metadata: RepoMetadata
): AnalysisData {
  // Detect languages
  const languages = estimateLanguages(files);

  // Detect frameworks
  const frameworks = detectFrameworks(files);

  // Extract tools from config files
  const tools: string[] = [];
  const fileNames = files.map(f => f.path.split('/').pop() || '');
  if (fileNames.some(n => n.startsWith('.eslintrc') || n === 'eslint.config.js')) {
    tools.push('ESLint');
  }
  if (fileNames.some(n => n.startsWith('.prettierrc'))) {
    tools.push('Prettier');
  }
  if (fileNames.some(n => n.includes('jest.config'))) {
    tools.push('Jest');
  }
  if (fileNames.some(n => n === 'Dockerfile')) {
    tools.push('Docker');
  }
  if (fileNames.some(n => n === 'docker-compose.yml')) {
    tools.push('Docker Compose');
  }

  // Extract dependencies from package.json
  const dependencies: string[] = [];
  const packageJsonFile = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
  if (packageJsonFile) {
    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      const deps = Object.keys(packageJson.dependencies || {});
      dependencies.push(...deps.slice(0, 10)); // Top 10 dependencies
    } catch (error) {
      // Invalid JSON
    }
  }

  // Generate tree view
  const treeView = generateTreeView(files);

  // Identify key directories
  const keyDirectories: KeyDirectory[] = [];
  const dirPurposes: Record<string, string> = {
    'src': 'Source code',
    'app': 'Application code',
    'lib': 'Library/utility code',
    'components': 'React components',
    'pages': 'Page components',
    'api': 'API routes',
    'public': 'Static assets',
    'tests': 'Test files',
    'docs': 'Documentation'
  };

  const uniqueDirs = new Set<string>();
  files.forEach(f => {
    const parts = f.path.split('/');
    if (parts.length > 1) {
      uniqueDirs.add(parts[0]);
    }
  });

  uniqueDirs.forEach(dir => {
    if (dirPurposes[dir]) {
      keyDirectories.push({
        path: dir,
        purpose: dirPurposes[dir]
      });
    }
  });

  // Extract key findings from AI responses
  const keyFindings = extractKeyFindings(aiResponses);

  // Detect code quality indicators
  const hasTests = files.some(f =>
    f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('/tests/') || f.path.includes('/__tests__/')
  );
  const hasTypeScript = files.some(f => f.path.endsWith('.ts') || f.path.endsWith('.tsx'));
  const hasLinting = fileNames.some(n => n.startsWith('.eslintrc') || n === 'eslint.config.js');

  const configFiles = files
    .filter(f => {
      const name = f.path.split('/').pop() || '';
      return name.includes('config') || name.startsWith('.') || name === 'package.json';
    })
    .map(f => f.path)
    .slice(0, 5);

  return {
    overview: {
      name: metadata.name,
      owner: metadata.owner,
      primaryLanguage: metadata.primaryLanguage || (languages[0] || 'Unknown'),
      filesAnalyzed: files.length,
      description: metadata.description || 'No description available'
    },
    techStack: {
      languages: languages.slice(0, 5),
      frameworks,
      tools,
      dependencies
    },
    structure: {
      treeView,
      keyDirectories
    },
    keyFindings,
    codeQuality: {
      hasTests,
      hasTypeScript,
      hasLinting,
      configFiles
    }
  };
}
