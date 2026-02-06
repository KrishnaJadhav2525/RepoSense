import axios from 'axios';
import { FileObject, ContentChunk } from '@/types/analysis';

const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models';
const MODEL_NAME = 'bigcode/starcoder';
const MAX_CHUNK_TOKENS = 4000; // Conservative estimate for free tier
const CHARS_PER_TOKEN = 4; // Rough estimate

/**
 * Chunk file contents for AI processing
 */
export function chunkContent(files: FileObject[]): ContentChunk[] {
  const chunks: ContentChunk[] = [];
  let currentChunk = '';
  let currentFileCount = 0;
  let currentSize = 0;
  const maxChunkSize = MAX_CHUNK_TOKENS * CHARS_PER_TOKEN;

  for (const file of files) {
    const fileContent = `=== ${file.path} ===\n${file.content}\n\n`;

    // If adding this file would exceed the chunk size, start a new chunk
    if (currentChunk.length + fileContent.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk,
        fileCount: currentFileCount,
        totalSize: currentSize
      });
      currentChunk = '';
      currentFileCount = 0;
      currentSize = 0;
    }

    currentChunk += fileContent;
    currentFileCount++;
    currentSize += file.size;
  }

  // Add the last chunk if it has content
  if (currentChunk.length > 0) {
    chunks.push({
      content: currentChunk,
      fileCount: currentFileCount,
      totalSize: currentSize
    });
  }

  return chunks;
}

/**
 * Call HuggingFace Inference API
 */
export async function callHuggingFaceAPI(prompt: string): Promise<string> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new Error('HuggingFace API key not configured');
  }

  try {
    const response = await axios.post(
      `${HUGGINGFACE_API_URL}/${MODEL_NAME}`,
      {
        inputs: prompt,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    // Handle different response formats
    if (Array.isArray(response.data)) {
      return response.data[0]?.generated_text || '';
    } else if (response.data.generated_text) {
      return response.data.generated_text;
    } else if (typeof response.data === 'string') {
      return response.data;
    }

    return '';
  } catch (error: any) {
    // Handle model loading (503)
    if (error.response?.status === 503) {
      const estimatedTime = error.response.data?.estimated_time || 20;

      // Wait for model to load and retry once
      if (estimatedTime < 30) {
        await new Promise(resolve => setTimeout(resolve, estimatedTime * 1000));

        try {
          const retryResponse = await axios.post(
            `${HUGGINGFACE_API_URL}/${MODEL_NAME}`,
            {
              inputs: prompt,
              parameters: {
                max_new_tokens: 500,
                temperature: 0.7,
                return_full_text: false
              }
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              },
              timeout: 60000
            }
          );

          if (Array.isArray(retryResponse.data)) {
            return retryResponse.data[0]?.generated_text || '';
          } else if (retryResponse.data.generated_text) {
            return retryResponse.data.generated_text;
          }

          return '';
        } catch (retryError) {
          throw new Error('AI model unavailable. Please try again in a few minutes.');
        }
      }

      throw new Error('AI model unavailable. Please try again in a few minutes.');
    }

    // Handle rate limiting (429)
    if (error.response?.status === 429) {
      throw new Error('Analysis service temporarily unavailable. Please try again later.');
    }

    // Handle invalid API key
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Analysis service configuration error');
    }

    // Generic error
    throw new Error('Analysis service unavailable');
  }
}

/**
 * Analyze repository content using HuggingFace API
 */
export async function analyzeWithHuggingFace(chunks: ContentChunk[]): Promise<string[]> {
  const responses: string[] = [];

  for (const chunk of chunks) {
    const prompt = `Analyze this code repository content and provide insights:

Repository files:
${chunk.content}

Please identify:
1. Primary programming language and frameworks
2. Project structure and organization
3. Key entry points and important files
4. Code patterns and architectural decisions
5. Dependencies and tools used

Response format: Concise bullet points.`;

    try {
      const response = await callHuggingFaceAPI(prompt);
      if (response) {
        responses.push(response);
      }
    } catch (error) {
      // If one chunk fails, continue with others
      console.error('Failed to analyze chunk:', error);
      responses.push('Analysis unavailable for this section.');
    }
  }

  return responses;
}
