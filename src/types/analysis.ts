// TypeScript type definitions for RepoSense analysis data structures

export interface FileObject {
  path: string;
  content: string;
  size: number;
  type: 'file' | 'dir';
}

export interface RepoMetadata {
  name: string;
  owner: string;
  description: string;
  primaryLanguage: string;
  stars: number;
  topics: string[];
}

export interface ContentChunk {
  content: string;
  fileCount: number;
  totalSize: number;
}

export interface Overview {
  name: string;
  owner: string;
  primaryLanguage: string;
  filesAnalyzed: number;
  description: string;
}

export interface TechStack {
  languages: string[];
  frameworks: string[];
  tools: string[];
  dependencies: string[];
}

export interface KeyDirectory {
  path: string;
  purpose: string;
}

export interface Structure {
  treeView: string;
  keyDirectories: KeyDirectory[];
}

export interface EntryPoint {
  file: string;
  description: string;
}

export interface KeyFindings {
  entryPoints: EntryPoint[];
  patterns: string[];
  notable: string[];
}

export interface CodeQuality {
  hasTests: boolean;
  hasTypeScript: boolean;
  hasLinting: boolean;
  configFiles: string[];
}

export interface AnalysisData {
  overview: Overview;
  techStack: TechStack;
  structure: Structure;
  keyFindings: KeyFindings;
  codeQuality: CodeQuality;
}

export interface AnalysisResponse {
  success: boolean;
  data?: AnalysisData;
  error?: string;
}

export interface AnalyzeRequest {
  repoUrl: string;
}
