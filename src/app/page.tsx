'use client';

import { useState } from 'react';
import { AnalysisData } from '@/types/analysis';

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateGitHubUrl = (url: string): boolean => {
    const pattern = /^https?:\/\/github\.com\/[^\/]+\/[^\/]+/;
    return pattern.test(url);
  };

  const handleAnalyze = async () => {
    setError(null);
    setAnalysisData(null);

    // Validate URL
    if (!validateGitHubUrl(repoUrl)) {
      setError('Please enter a valid GitHub URL (e.g., https://github.com/facebook/react)');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        setAnalysisData(data.data);
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Unable to connect. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isAnalyzing && repoUrl.trim()) {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-black">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">RepoSense</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">AI-Powered Repository Analysis</p>
        </div>
      </header>

      {/* Input Section */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://github.com/username/repository"
              disabled={isAnalyzing}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !repoUrl.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isAnalyzing && (
        <div className="max-w-6xl mx-auto px-6 py-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Analyzing repository...</p>
        </div>
      )}

      {/* Results Section */}
      {analysisData && !isAnalyzing && (
        <div className="max-w-4xl mx-auto px-6 pb-12">
          <div className="space-y-6">
            {/* Overview */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Overview</h2>
              <div className="space-y-2 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Repository:</span> {analysisData.overview.owner}/{analysisData.overview.name}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Primary Language:</span> {analysisData.overview.primaryLanguage}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Files Analyzed:</span> {analysisData.overview.filesAnalyzed}
                </p>
                {analysisData.overview.description && (
                  <p className="text-gray-700 dark:text-gray-300 mt-3">
                    {analysisData.overview.description}
                  </p>
                )}
              </div>
            </section>

            {/* Technology Stack */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Technology Stack</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysisData.techStack.languages.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Languages</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.techStack.languages.map((lang, idx) => (
                        <span key={idx} className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysisData.techStack.frameworks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frameworks</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.techStack.frameworks.map((fw, idx) => (
                        <span key={idx} className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded-full">
                          {fw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysisData.techStack.tools.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tools</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.techStack.tools.map((tool, idx) => (
                        <span key={idx} className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {analysisData.techStack.dependencies.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Dependencies</h3>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.techStack.dependencies.slice(0, 6).map((dep, idx) => (
                        <span key={idx} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs rounded-full">
                          {dep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Project Structure */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Project Structure</h2>
              {analysisData.structure.keyDirectories.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key Directories</h3>
                  <ul className="space-y-1 text-sm">
                    {analysisData.structure.keyDirectories.map((dir, idx) => (
                      <li key={idx} className="text-gray-700 dark:text-gray-300">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{dir.path}</span>
                        <span className="ml-2 text-gray-600 dark:text-gray-400">- {dir.purpose}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Directory Tree</h3>
                <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-4 rounded overflow-x-auto text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                  {analysisData.structure.treeView}
                </pre>
              </div>
            </section>

            {/* Key Findings */}
            {(analysisData.keyFindings.entryPoints.length > 0 ||
              analysisData.keyFindings.patterns.length > 0 ||
              analysisData.keyFindings.notable.length > 0) && (
              <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Key Findings</h2>
                <div className="space-y-4">
                  {analysisData.keyFindings.entryPoints.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entry Points</h3>
                      <ul className="space-y-1 text-sm list-disc list-inside">
                        {analysisData.keyFindings.entryPoints.map((ep, idx) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">
                            <span className="font-mono text-xs">{ep.file}</span>
                            {ep.description && <span className="ml-2">- {ep.description}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisData.keyFindings.patterns.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Patterns & Architecture</h3>
                      <ul className="space-y-1 text-sm list-disc list-inside">
                        {analysisData.keyFindings.patterns.map((pattern, idx) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">{pattern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisData.keyFindings.notable.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notable Features</h3>
                      <ul className="space-y-1 text-sm list-disc list-inside">
                        {analysisData.keyFindings.notable.map((note, idx) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Code Quality */}
            <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Code Quality</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${analysisData.codeQuality.hasTests ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Tests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${analysisData.codeQuality.hasTypeScript ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">TypeScript</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${analysisData.codeQuality.hasLinting ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Linting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${analysisData.codeQuality.configFiles.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Config Files</span>
                </div>
              </div>
              {analysisData.codeQuality.configFiles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Configuration Files</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysisData.codeQuality.configFiles.map((file, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-mono rounded">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
