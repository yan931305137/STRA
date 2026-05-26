/**
 * LLM Code Generator
 *
 * Calls the same AI model for all frameworks to generate code.
 * Uses OpenAI-compatible API for LLM access (configurable via environment variables).
 * Tracks token usage for efficiency scoring.
 *
 * Environment variables:
 *   LLM_API_KEY   - API key for the LLM service (required)
 *   LLM_BASE_URL  - Base URL for the API (default: https://api.openai.com/v1)
 *   LLM_MODEL     - Default model name (can be overridden per benchmark)
 */
import type { Framework, GenerationResult, EditGenerationResult, PromptTemplate, BenchmarkConfig } from '../types/index.js';

interface LLMResponse {
  content: string;
}

async function invokeLLM(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { model: string; temperature?: number }
): Promise<LLMResponse> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('LLM_API_KEY environment variable is required. Set it before running the benchmark.');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error (${response.status}): ${text}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return { content: data.choices[0]?.message?.content ?? '' };
}

/**
 * Check if generated HTML code appears to be truncated
 */
function isHtmlTruncated(code: string): boolean {
  if (!code) return true;
  const trimmed = code.trim().toLowerCase();
  return !trimmed.includes('</html>');
}

/**
 * Generate code for a single framework + task
 * Automatically retries with a compactness prompt if the output is truncated
 */
export async function generateCode(
  template: PromptTemplate,
  config: BenchmarkConfig
): Promise<GenerationResult> {
  const startTime = Date.now();
  const maxRetries = config.maxRetries ?? 2;

  let lastResult: GenerationResult | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const messages = [
        { role: 'system' as const, content: template.systemPrompt },
        { role: 'user' as const, content: template.userPrompt },
      ];

      // On retry, add a compactness instruction to avoid token limit truncation
      if (attempt > 0) {
        messages.push({
          role: 'user' as const,
          content: 'IMPORTANT: Your previous output was truncated because it exceeded the token limit. Please regenerate the code, but make it MORE COMPACT. Use concise template literals (innerHTML) instead of verbose DOM API calls. Reduce comments and whitespace. The output MUST end with </html>.',
        });
      }

      const response = await invokeLLM(messages, {
        model: config.model,
        temperature: config.temperature,
      });

      const generationTimeMs = Date.now() - startTime;

      // Extract code from response — LLM may wrap in markdown code blocks
      const code = extractCode(response.content);

      // Token estimation
      const promptText = template.systemPrompt + template.userPrompt;
      const promptTokens = Math.ceil(promptText.length / 3);
      const completionTokens = Math.ceil(code.length / 3);

      lastResult = {
        framework: template.framework,
        taskId: template.taskId,
        code,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        generationTimeMs,
      };

      // If code is complete, return immediately
      if (!isHtmlTruncated(code)) {
        return lastResult;
      }

      // Code is truncated — retry if attempts remain
      if (attempt < maxRetries) {
        console.log(`[RETRY] ${template.framework} output truncated (attempt ${attempt + 1}/${maxRetries}), retrying with compactness prompt...`);
      } else {
        // Final attempt still truncated — mark as error
        lastResult.error = 'Generated HTML appears truncated (missing </html> closing tag) after all retries';
      }
    } catch (error) {
      lastResult = {
        framework: template.framework,
        taskId: template.taskId,
        code: '',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        generationTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
      return lastResult;
    }
  }

  return lastResult!;
}

/**
 * Generate edit code (follow-up modification request)
 */
export async function generateEditCode(
  template: PromptTemplate,
  originalCode: string,
  config: BenchmarkConfig
): Promise<EditGenerationResult> {
  const startTime = Date.now();

  try {
    // First generate the original code
    const baseResult = await generateCode(template, config);

    if (baseResult.error) {
      return {
        ...baseResult,
        editPromptTokens: 0,
        editCompletionTokens: 0,
        editTotalTokens: 0,
        editGenerationTimeMs: 0,
        editCode: '',
        editError: baseResult.error,
        filesChangedOriginal: 1,
        filesChangedAfterEdit: 1,
        structuralDisruption: 1,
      };
    }

    // Then request the edit
    const editStartTime = Date.now();
    const editMessages = [
      { role: 'system' as const, content: template.systemPrompt },
      {
        role: 'user' as const,
        content: template.userPrompt,
      },
      {
        role: 'assistant' as const,
        content: baseResult.code,
      },
      {
        role: 'user' as const,
        content: `Now modify the code you just wrote with this requirement:\n\n${template.editPrompt}\n\nReturn the COMPLETE modified HTML file. Do NOT use diff format.`,
      },
    ];

    const editResponse = await invokeLLM(editMessages, {
      model: config.model,
      temperature: config.temperature,
    });

    const editCode = extractCode(editResponse.content);
    const editGenerationTimeMs = Date.now() - editStartTime;

    // Estimate tokens for edit
    const editPromptText = template.editPrompt;
    const editPromptTokens = Math.ceil(editPromptText.length / 3);
    const editCompletionTokens = Math.ceil(editCode.length / 3);

    // Analyze structural change between original and edit
    const filesChangedOriginal = 1; // single file
    const filesChangedAfterEdit = 1; // still single file
    const structuralDisruption = calculateStructuralDisruption(baseResult.code, editCode);

    return {
      ...baseResult,
      editPromptTokens,
      editCompletionTokens,
      editTotalTokens: editPromptTokens + editCompletionTokens,
      editGenerationTimeMs,
      editCode,
      filesChangedOriginal,
      filesChangedAfterEdit,
      structuralDisruption,
    };
  } catch (error) {
    return {
      framework: template.framework,
      taskId: template.taskId,
      code: originalCode,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      generationTimeMs: Date.now() - startTime,
      editPromptTokens: 0,
      editCompletionTokens: 0,
      editTotalTokens: 0,
      editGenerationTimeMs: 0,
      editCode: '',
      editError: error instanceof Error ? error.message : String(error),
      filesChangedOriginal: 1,
      filesChangedAfterEdit: 1,
      structuralDisruption: 1,
    };
  }
}

/**
 * Extract code from LLM response, stripping markdown fences
 * Handles both complete and truncated (output-limit-hit) responses
 */
function extractCode(content: string): string {
  // Try to extract from complete markdown code block (with closing ```)
  const htmlMatch = content.match(/```html\s*\n([\s\S]*?)```/);
  if (htmlMatch) return htmlMatch[1].trim();

  const codeMatch = content.match(/```\s*\n([\s\S]*?)```/);
  if (codeMatch) return codeMatch[1].trim();

  // Handle truncated response: LLM hit output token limit before closing ```
  // Extract content between opening ```html and end-of-string
  const truncatedHtmlMatch = content.match(/```html\s*\n([\s\S]+)$/);
  if (truncatedHtmlMatch) return truncatedHtmlMatch[1].trim();

  const truncatedCodeMatch = content.match(/```\s*\n([\s\S]+)$/);
  if (truncatedCodeMatch) return truncatedCodeMatch[1].trim();

  // If the content starts with <!DOCTYPE or <html, it's likely the full code
  const trimmed = content.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
    return trimmed;
  }

  // Fallback: return as-is
  return trimmed;
}

/**
 * Calculate how much the edit disrupted the original structure
 * 0 = no disruption (minimal changes), 1 = full rewrite
 */
function calculateStructuralDisruption(original: string, edited: string): number {
  if (!original || !edited) return 1;

  // Line-based diff approximation
  const origLines = original.split('\n').filter((l) => l.trim());
  const editLines = edited.split('\n').filter((l) => l.trim());

  // Count lines that are the same in both
  const origSet = new Set(origLines);
  const editSet = new Set(editLines);
  let commonCount = 0;
  for (const line of origSet) {
    if (editSet.has(line)) commonCount++;
  }

  const totalUnique = new Set([...origLines, ...editLines]).size;
  if (totalUnique === 0) return 0;

  return 1 - commonCount / totalUnique;
}
