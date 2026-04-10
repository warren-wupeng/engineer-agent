/**
 * LLM 客户端抽象层
 * 使用官方 SDK 作为底层实现
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMConfig, LLMResponse, Result } from '../types.js';
import { ok, err } from '../types.js';

/**
 * LLM 客户端接口 - 纯函数式接口
 */
export interface LLMClient {
  /**
   * 生成文本完成
   * @param prompt 提示词
   * @param systemPrompt 系统提示词（可选）
   * @returns Result 包含响应或错误
   */
  readonly complete: (
    prompt: string,
    systemPrompt?: string
  ) => Promise<Result<LLMResponse>>;

  /**
   * 生成结构化输出（JSON）
   * @param prompt 提示词
   * @param schema JSON Schema
   * @param systemPrompt 系统提示词（可选）
   */
  readonly completeStructured: <T>(
    prompt: string,
    schema: object,
    systemPrompt?: string
  ) => Promise<Result<T>>;
}

/**
 * 创建 LLM 客户端
 * 工厂函数 - 纯函数
 */
export const createLLMClient = (config: LLMConfig): LLMClient => {
  switch (config.provider) {
    case 'openai':
      return createOpenAIClient(config);
    case 'anthropic':
      return createAnthropicClient(config);
    case 'ai-gateway':
      return createAIGatewayClient(config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
};

/**
 * OpenAI 客户端实现
 */
const createOpenAIClient = (config: LLMConfig): LLMClient => {
  // OpenAI SDK 4.x 会自动使用环境变量中的代理设置
  // Node.js 18+ 的全局 fetch 会自动读取 https_proxy/http_proxy 环境变量
  // 如果需要显式配置，可以通过自定义 fetch 实现
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    // 注意：OpenAI SDK 4.x 使用 fetch，Node.js 的 fetch 会自动使用环境变量中的代理
    // 确保在运行测试时设置了 https_proxy 环境变量
  });

  return {
    complete: async (prompt: string, systemPrompt?: string) => {
      try {
        const result = await client.chat.completions.create({
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: prompt },
          ],
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
        });

        const message = result.choices[0]?.message?.content;
        if (!message) {
          return err({ type: 'LLM_ERROR', message: 'Empty response from LLM' });
        }

        return ok({
          content: message,
          usage: result.usage ? {
            promptTokens: result.usage.prompt_tokens,
            completionTokens: result.usage.completion_tokens,
            totalTokens: result.usage.total_tokens,
          } : undefined,
        });
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: cause instanceof Error ? cause.message : 'Unknown LLM error',
          cause,
        });
      }
    },

    completeStructured: async <T>(
      prompt: string,
      schema: object,
      systemPrompt?: string
    ): Promise<Result<T>> => {
      try {
        // 使用 JSON mode 或通过 prompt 工程实现结构化输出
        const structuredPrompt = `${prompt}\n\nPlease respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;

        const result = await client.chat.completions.create({
          model: config.model,
          messages: [
            ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
            { role: 'user' as const, content: structuredPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
        });

        const message = result.choices[0]?.message?.content;
        if (!message) {
          return err({ type: 'LLM_ERROR', message: 'Empty response from LLM' });
        }

        try {
          const parsed = JSON.parse(message) as T;
          return ok(parsed);
        } catch (parseError) {
          return err({
            type: 'LLM_ERROR',
            message: 'Failed to parse JSON response',
            cause: parseError,
          });
        }
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: cause instanceof Error ? cause.message : 'Unknown LLM error',
          cause,
        });
      }
    },
  };
};

/**
 * Anthropic 客户端实现
 */
const createAnthropicClient = (config: LLMConfig): LLMClient => {
  const client = new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  return {
    complete: async (prompt: string, systemPrompt?: string) => {
      try {
        const result = await client.messages.create({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          system: systemPrompt,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 4096,
        });

        const message = result.content[0];
        if (!message || message.type !== 'text') {
          return err({ type: 'LLM_ERROR', message: 'Empty or invalid response from LLM' });
        }

        return ok({
          content: message.text,
          usage: result.usage ? {
            promptTokens: result.usage.input_tokens,
            completionTokens: result.usage.output_tokens,
            totalTokens: result.usage.input_tokens + result.usage.output_tokens,
          } : undefined,
        });
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: cause instanceof Error ? cause.message : 'Unknown LLM error',
          cause,
        });
      }
    },

    completeStructured: async <T>(
      prompt: string,
      schema: object,
      systemPrompt?: string
    ): Promise<Result<T>> => {
      // Anthropic 的结构化输出需要通过 prompt 工程实现
      // 这里使用 JSON 模式在 prompt 中指定
      const structuredPrompt = `${prompt}\n\nPlease respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;

      const result = await client.messages.create({
        model: config.model,
        messages: [{ role: 'user', content: structuredPrompt }],
        system: systemPrompt,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      });

      const message = result.content[0];
      if (!message || message.type !== 'text') {
        return err({ type: 'LLM_ERROR', message: 'Empty or invalid response from LLM' });
      }

      try {
        const parsed = JSON.parse(message.text) as T;
        return ok(parsed);
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: 'Failed to parse JSON response',
          cause,
        });
      }
    },
  };
};

/**
 * Cloudflare AI Gateway 客户端实现
 * 通过 AI Gateway 代理 LLM 请求，提供缓存、限流等功能
 */
const createAIGatewayClient = (config: LLMConfig): LLMClient => {
  // 如果 baseURL 是自定义 Worker 端点，使用 /api/v1/chat/completions
  // 如果是官方 Cloudflare AI Gateway，使用 /v1/chat/completions
  const defaultBaseUrl = 'https://gateway.ai.cloudflare.com/v1';
  const baseUrl = config.baseURL || defaultBaseUrl;
  const apiKey = config.apiKey;
  
  // 判断是否为自定义 Worker 端点（不包含 gateway.ai.cloudflare.com）
  const isCustomWorker = baseUrl && !baseUrl.includes('gateway.ai.cloudflare.com');
  const endpoint = isCustomWorker ? '/api/v1/chat/completions' : '/chat/completions';

  return {
    complete: async (prompt: string, systemPrompt?: string) => {
      try {
        const url = `${baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          // 添加 Origin 头以通过 Worker 的 Origin 检查
          'Origin': baseUrl,
        };

        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const body = {
          model: config.model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
        };

        // 调试信息：打印完整请求详情
        if (process.env.DEBUG_AI_GATEWAY) {
          console.log('AI Gateway Request Details:');
          console.log('  URL:', url);
          console.log('  Method: POST');
          console.log('  Headers:', JSON.stringify(headers, null, 2));
          console.log('  Body:', JSON.stringify(body, null, 2));
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = `Failed to read error response: ${e}`;
          }
          
          // 调试信息：打印错误详情
          if (process.env.DEBUG_AI_GATEWAY) {
            console.error('AI Gateway Error Response:');
            console.error('  Status:', response.status, response.statusText);
            console.error('  Error Text:', errorText);
            console.error('  Response Headers:', Object.fromEntries(response.headers.entries()));
          }
          
          return err({
            type: 'LLM_ERROR',
            message: `AI Gateway API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`,
            cause: errorText,
          });
        }
        
        // 调试信息：打印成功响应状态
        if (process.env.DEBUG_AI_GATEWAY) {
          console.log('AI Gateway Success Response:');
          console.log('  Status:', response.status, response.statusText);
        }

        let data: {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };
        
        try {
          data = await response.json() as typeof data;
        } catch (parseError) {
          const responseText = await response.text().catch(() => 'Failed to read response');
          if (process.env.DEBUG_AI_GATEWAY) {
            console.error('Failed to parse JSON response:');
            console.error('  Response Text:', responseText);
          }
          return err({
            type: 'LLM_ERROR',
            message: 'Failed to parse JSON response from AI Gateway',
            cause: responseText,
          });
        }

        if (process.env.DEBUG_AI_GATEWAY) {
          console.log('AI Gateway Response Data:', JSON.stringify(data, null, 2));
        }

        const message = data.choices?.[0]?.message?.content;
        if (!message) {
          if (process.env.DEBUG_AI_GATEWAY) {
            console.error('Empty message in response. Full data:', JSON.stringify(data, null, 2));
          }
          return err({ type: 'LLM_ERROR', message: 'Empty response from AI Gateway' });
        }

        return ok({
          content: message,
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
          } : undefined,
        });
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: cause instanceof Error ? cause.message : 'Unknown AI Gateway error',
          cause,
        });
      }
    },

    completeStructured: async <T>(
      prompt: string,
      schema: object,
      systemPrompt?: string
    ): Promise<Result<T>> => {
      try {
        // AI Gateway 支持 OpenAI 兼容的 JSON mode
        const url = `${baseUrl}${endpoint}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          // 添加 Origin 头以通过 Worker 的 Origin 检查
          'Origin': baseUrl,
        };

        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        
        // 在 prompt 中添加 JSON schema 要求
        const structuredPrompt = `${prompt}\n\nPlease respond with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
        messages.push({ role: 'user', content: structuredPrompt });

        const body = {
          model: config.model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens,
          response_format: { type: 'json_object' },
        };

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = `Failed to read error response: ${e}`;
          }
          
          // 调试信息：打印错误详情
          if (process.env.DEBUG_AI_GATEWAY) {
            console.error('AI Gateway Error Response (structured):');
            console.error('  Status:', response.status, response.statusText);
            console.error('  Error Text:', errorText);
            console.error('  Response Headers:', Object.fromEntries(response.headers.entries()));
          }
          
          return err({
            type: 'LLM_ERROR',
            message: `AI Gateway API request failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText.substring(0, 200)}` : ''}`,
            cause: errorText,
          });
        }

        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };

        const message = data.choices?.[0]?.message?.content;
        if (!message) {
          return err({ type: 'LLM_ERROR', message: 'Empty response from AI Gateway' });
        }

        try {
          const parsed = JSON.parse(message) as T;
          return ok(parsed);
        } catch (parseError) {
          return err({
            type: 'LLM_ERROR',
            message: 'Failed to parse JSON response from AI Gateway',
            cause: parseError,
          });
        }
      } catch (cause) {
        return err({
          type: 'LLM_ERROR',
          message: cause instanceof Error ? cause.message : 'Unknown AI Gateway error',
          cause,
        });
      }
    },
  };
};

