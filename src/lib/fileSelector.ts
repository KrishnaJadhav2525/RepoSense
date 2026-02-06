import { FileObject } from '@/types/analysis';

const MAX_FILE_SIZE = 100 * 1024; // 100KB
const MAX_TOTAL_CONTENT = 50 * 1024; // 50KB total

// Priority file patterns
const PRIORITY_1_FILES = ['README.md', 'README.txt', 'README', 'CONTRIBUTING.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'];
const PRIORITY_2_PATTERNS = [
  'package.json',
  'tsconfig.json',
  'next.config.js',
  'next.config.mjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  'eslint.config.js',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  'jest.config.js',
  'jest.config.ts',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example',
  '.gitignore',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js'
];

const ENTRY_POINT_PATTERNS = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js'];
const PRIORITY_DIRECTORIES = ['/src/', '/lib/', '/app/', '/components/', '/pages/', '/api/'];

/**
 * Select the most important files from a repository for analysis
 */
export function selectKeyFiles(files: FileObject[]): FileObject[] {
  const selectedFiles: FileObject[] = [];
  let totalSize = 0;

  // Helper function to add file if under size limits
  const addFile = (file: FileObject): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      // Truncate large files
      const truncatedContent = file.content.substring(0, MAX_FILE_SIZE) + '\n... (truncated)';
      selectedFiles.push({
        ...file,
        content: truncatedContent,
        size: truncatedContent.length
      });
      totalSize += truncatedContent.length;
      return totalSize < MAX_TOTAL_CONTENT;
    }

    if (totalSize + file.size > MAX_TOTAL_CONTENT) {
      return false;
    }

    selectedFiles.push(file);
    totalSize += file.size;
    return true;
  };

  // Priority 1: Documentation files
  const priority1 = files.filter(f => {
    const fileName = f.path.split('/').pop() || '';
    return PRIORITY_1_FILES.includes(fileName);
  });

  for (const file of priority1) {
    if (!addFile(file)) break;
  }

  // Priority 2: Configuration files
  const priority2 = files.filter(f => {
    const fileName = f.path.split('/').pop() || '';
    return PRIORITY_2_PATTERNS.includes(fileName);
  });

  for (const file of priority2) {
    if (!addFile(file)) break;
  }

  // Priority 3: Entry points
  const entryPoints = files.filter(f => {
    const fileName = f.path.split('/').pop() || '';
    return ENTRY_POINT_PATTERNS.includes(fileName);
  }).sort((a, b) => {
    // Prioritize files in root or src directory
    const aDepth = a.path.split('/').length;
    const bDepth = b.path.split('/').length;
    return aDepth - bDepth;
  });

  for (const file of entryPoints) {
    if (!addFile(file)) break;
  }

  // Priority 4: Important source files from key directories
  const sourceFiles = files.filter(f => {
    return PRIORITY_DIRECTORIES.some(dir => f.path.includes(dir));
  }).sort((a, b) => {
    // Sort by directory importance and then by path depth
    const aDirIndex = PRIORITY_DIRECTORIES.findIndex(dir => a.path.includes(dir));
    const bDirIndex = PRIORITY_DIRECTORIES.findIndex(dir => b.path.includes(dir));
    if (aDirIndex !== bDirIndex) {
      return aDirIndex - bDirIndex;
    }
    return a.path.split('/').length - b.path.split('/').length;
  });

  // Add up to 20 source files
  let sourceFileCount = 0;
  for (const file of sourceFiles) {
    if (sourceFileCount >= 20) break;
    if (selectedFiles.some(sf => sf.path === file.path)) continue; // Skip if already added
    if (!addFile(file)) break;
    sourceFileCount++;
  }

  // If we still have space and no files from priority directories, add some files from root
  if (selectedFiles.length < 5) {
    const rootFiles = files
      .filter(f => !selectedFiles.some(sf => sf.path === f.path))
      .filter(f => f.path.split('/').length <= 2)
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, 20);

    for (const file of rootFiles) {
      if (!addFile(file)) break;
    }
  }

  return selectedFiles;
}

/**
 * Estimate programming languages used in the repository
 */
export function estimateLanguages(files: FileObject[]): string[] {
  const extensionMap: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.rs': 'Rust',
    '.scala': 'Scala',
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.vue': 'Vue',
    '.svelte': 'Svelte'
  };

  const languageCounts: Record<string, number> = {};

  for (const file of files) {
    const ext = file.path.substring(file.path.lastIndexOf('.')).toLowerCase();
    const language = extensionMap[ext];
    if (language) {
      languageCounts[language] = (languageCounts[language] || 0) + 1;
    }
  }

  // Sort by count and return language names
  return Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);
}
