import axios from 'axios';
import { FileObject, RepoMetadata } from '@/types/analysis';

const GITHUB_API_BASE = 'https://api.github.com';
const MAX_DEPTH = 5;

/**
 * Get GitHub API headers with optional authentication
 */
function getGitHubHeaders() {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Add authentication token if available
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Parse GitHub URL and extract owner and repository name
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Handle various GitHub URL formats
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?\/?$/,
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Fetch repository metadata from GitHub
 */
export async function getRepositoryMetadata(
  owner: string,
  repo: string
): Promise<RepoMetadata> {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers: getGitHubHeaders() }
    );
    const data = response.data;

    return {
      name: data.name,
      owner: data.owner.login,
      description: data.description || '',
      primaryLanguage: data.language || 'Unknown',
      stars: data.stargazers_count || 0,
      topics: data.topics || []
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Repository not found or is private');
    }
    if (error.response?.status === 403) {
      throw new Error('GitHub rate limit exceeded. Try again later.');
    }
    throw new Error('Failed to fetch repository metadata');
  }
}

/**
 * Recursively fetch repository contents from GitHub
 */
export async function fetchRepositoryContents(
  owner: string,
  repo: string
): Promise<FileObject[]> {
  const files: FileObject[] = [];
  const directoriesToSkip = ['node_modules', 'vendor', 'dist', 'build', '.git', '__pycache__', '.next'];
  const binaryExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];

  async function fetchDirectory(path: string = '', depth: number = 0): Promise<void> {
    // Stop if max depth reached
    if (depth > MAX_DEPTH) {
      return;
    }

    try {
      const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
      const response = await axios.get(url, { headers: getGitHubHeaders() });
      const items = Array.isArray(response.data) ? response.data : [response.data];

      for (const item of items) {
        // Skip directories in the skip list
        if (item.type === 'dir' && directoriesToSkip.includes(item.name)) {
          continue;
        }

        // Skip symlinks
        if (item.type === 'symlink') {
          continue;
        }

        if (item.type === 'file') {
          // Skip binary files
          const ext = item.name.substring(item.name.lastIndexOf('.'));
          if (binaryExtensions.includes(ext.toLowerCase())) {
            continue;
          }

          // Fetch file content
          try {
            const fileResponse = await axios.get(item.url, { headers: getGitHubHeaders() });
            const content = fileResponse.data.content
              ? Buffer.from(fileResponse.data.content, 'base64').toString('utf-8')
              : '';

            files.push({
              path: item.path,
              content,
              size: item.size,
              type: 'file'
            });
          } catch (error) {
            // Skip files that can't be fetched
            console.error(`Failed to fetch file: ${item.path}`);
          }
        } else if (item.type === 'dir') {
          // Recursively fetch directory contents
          await fetchDirectory(item.path, depth + 1);
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error('Repository not found');
      }
      if (error.response?.status === 403) {
        throw new Error('GitHub rate limit exceeded. Try again later.');
      }
      throw new Error(`Failed to fetch repository contents: ${error.message}`);
    }
  }

  await fetchDirectory('', 0);
  return files;
}
