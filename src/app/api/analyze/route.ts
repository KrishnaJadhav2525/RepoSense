import { NextRequest, NextResponse } from 'next/server';
import { parseGitHubUrl, fetchRepositoryContents, getRepositoryMetadata } from '@/lib/github';
import { selectKeyFiles } from '@/lib/fileSelector';
import { chunkContent, analyzeWithHuggingFace } from '@/lib/huggingface';
import { aggregateAnalysis } from '@/lib/analyzer';
import { AnalysisResponse, AnalyzeRequest } from '@/types/analysis';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: AnalyzeRequest = await request.json();
    const { repoUrl } = body;

    // Validate GitHub URL
    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid GitHub URL'
        } as AnalysisResponse,
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter a valid GitHub URL (e.g., https://github.com/facebook/react)'
        } as AnalysisResponse,
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;

    // Fetch repository metadata
    let metadata;
    try {
      metadata = await getRepositoryMetadata(owner, repo);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('private')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Repository not found or is private'
          } as AnalysisResponse,
          { status: 404 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'GitHub rate limit exceeded. Try again later.'
          } as AnalysisResponse,
          { status: 429 }
        );
      }
      throw error;
    }

    // Fetch repository contents
    let allFiles;
    try {
      allFiles = await fetchRepositoryContents(owner, repo);
    } catch (error: any) {
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'GitHub rate limit exceeded. Try again later.'
          } as AnalysisResponse,
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch repository data'
        } as AnalysisResponse,
        { status: 500 }
      );
    }

    // Handle empty repository
    if (allFiles.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            overview: {
              name: metadata.name,
              owner: metadata.owner,
              primaryLanguage: metadata.primaryLanguage,
              filesAnalyzed: 0,
              description: metadata.description || 'Repository appears to be empty'
            },
            techStack: {
              languages: [],
              frameworks: [],
              tools: [],
              dependencies: []
            },
            structure: {
              treeView: '(empty)',
              keyDirectories: []
            },
            keyFindings: {
              entryPoints: [],
              patterns: [],
              notable: []
            },
            codeQuality: {
              hasTests: false,
              hasTypeScript: false,
              hasLinting: false,
              configFiles: []
            }
          }
        } as AnalysisResponse,
        { status: 200 }
      );
    }

    // Select key files
    const selectedFiles = selectKeyFiles(allFiles);

    // Handle case where no analyzable files found
    if (selectedFiles.length === 0) {
      return NextResponse.json(
        {
          success: true,
          data: {
            overview: {
              name: metadata.name,
              owner: metadata.owner,
              primaryLanguage: metadata.primaryLanguage,
              filesAnalyzed: 0,
              description: 'No analyzable text files found'
            },
            techStack: {
              languages: [],
              frameworks: [],
              tools: [],
              dependencies: []
            },
            structure: {
              treeView: '(no analyzable files)',
              keyDirectories: []
            },
            keyFindings: {
              entryPoints: [],
              patterns: [],
              notable: []
            },
            codeQuality: {
              hasTests: false,
              hasTypeScript: false,
              hasLinting: false,
              configFiles: []
            }
          }
        } as AnalysisResponse,
        { status: 200 }
      );
    }

    // Chunk content for AI processing
    const chunks = chunkContent(selectedFiles);

    // Analyze with HuggingFace (with fallback)
    let aiResponses: string[] = [];
    try {
      aiResponses = await analyzeWithHuggingFace(chunks);
    } catch (error: any) {
      // If AI analysis fails, continue with file-based analysis only
      console.error('AI analysis failed:', error.message);

      // Return basic analysis without AI insights
      const basicAnalysis = aggregateAnalysis([], selectedFiles, metadata);
      return NextResponse.json(
        {
          success: true,
          data: {
            ...basicAnalysis,
            keyFindings: {
              entryPoints: [],
              patterns: ['AI analysis partially available - using file structure analysis'],
              notable: []
            }
          }
        } as AnalysisResponse,
        { status: 200 }
      );
    }

    // Aggregate analysis results
    const analysisData = aggregateAnalysis(aiResponses, selectedFiles, metadata);

    // Return successful response
    return NextResponse.json(
      {
        success: true,
        data: analysisData
      } as AnalysisResponse,
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Analysis error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred during analysis'
      } as AnalysisResponse,
      { status: 500 }
    );
  }
}
