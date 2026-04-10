/**
 * AI Gateway LLM 客户端集成测试
 * 真实调用 Cloudflare AI Gateway API，不使用 mock
 */

import { describe, it, expect } from 'vitest';
import { createLLMClient } from './llm-client.js';
import type { LLMConfig } from '../types.js';

// 注意：环境变量由 vitest.config.ts 自动加载
// 代理配置应该在 .env.local 文件中设置（仅本地环境）

describe('AI Gateway LLM Client Integration Tests', () => {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_GATEWAY_BASE_URL;
  
  // 调试：检查环境变量
  console.log('Environment check:');
  console.log('AI_GATEWAY_API_KEY exists:', !!apiKey);
  console.log('AI_GATEWAY_BASE_URL:', baseUrl || 'using default');
  console.log('All env vars with AI_GATEWAY:', Object.keys(process.env).filter(k => k.includes('AI_GATEWAY')));
  
  // 如果没有 API key，跳过所有测试
  const shouldSkip = !apiKey;
  
  if (shouldSkip) {
    console.warn('AI_GATEWAY_API_KEY or OPENAI_API_KEY not set, skipping integration tests');
  }

  const config: LLMConfig = {
    provider: 'ai-gateway',
    model: 'gpt-3.5-turbo', // 使用更便宜的模型进行测试
    apiKey: apiKey!,
    baseURL: baseUrl,
    temperature: 0.7,
    maxTokens: 100,
  };

  it.skipIf(shouldSkip)('should create AI Gateway client successfully', () => {
    const client = createLLMClient(config);
    expect(client).toBeDefined();
    expect(client.complete).toBeDefined();
    expect(client.completeStructured).toBeDefined();
  });

  it.skipIf(shouldSkip)('should complete a simple prompt via AI Gateway', async () => {
    const client = createLLMClient(config);
    
    // 启用调试模式
    process.env.DEBUG_AI_GATEWAY = '1';
    
    console.log('Starting AI Gateway API call...');
    console.log('Configuration:');
    console.log('  Base URL:', config.baseURL || 'using default');
    console.log('  Model:', config.model);
    console.log('  API Key prefix:', config.apiKey?.substring(0, 10) + '...');
    console.log('Proxy settings:', {
      https_proxy: process.env.https_proxy,
      http_proxy: process.env.http_proxy,
      all_proxy: process.env.all_proxy,
    });
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        client.complete('Say "Hello, World!" in one sentence.'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000)
        )
      ]) as Awaited<ReturnType<typeof client.complete>>;

      const duration = Date.now() - startTime;
      console.log(`AI Gateway API call completed in ${duration}ms`);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBeDefined();
        expect(result.value.content.length).toBeGreaterThan(0);
        expect(result.value.content.toLowerCase()).toContain('hello');
        
        // 验证 usage 信息（如果 AI Gateway 返回）
        if (result.value.usage) {
          expect(result.value.usage.promptTokens).toBeGreaterThan(0);
          expect(result.value.usage.completionTokens).toBeGreaterThan(0);
          expect(result.value.usage.totalTokens).toBeGreaterThan(0);
        }
      } else {
        console.error('API call failed!');
        console.error('Error type:', result.error.type);
        console.error('Error message:', result.error.message);
        if ('cause' in result.error) {
          console.error('Error cause:', result.error.cause);
          console.error('Full error cause (first 500 chars):', 
            typeof result.error.cause === 'string' 
              ? result.error.cause.substring(0, 500) 
              : JSON.stringify(result.error.cause).substring(0, 500));
        }
        console.error('Full error object:', JSON.stringify(result.error, null, 2));
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`API call failed after ${duration}ms:`, error);
      throw error;
    }
  }, 60000); // 60秒超时（代理可能需要更长时间）

  it.skipIf(shouldSkip)('should complete with system prompt via AI Gateway', async () => {
    const client = createLLMClient(config);
    const result = await client.complete(
      'What is 2+2?',
      'You are a helpful math assistant. Always respond with just the number.'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBeDefined();
      // 应该包含数字 4
      expect(result.value.content).toMatch(/\b4\b/);
    } else {
      console.error('API call failed:', result.error);
    }
  }, 60000);

  it.skipIf(shouldSkip)('should handle structured output via AI Gateway', async () => {
    const client = createLLMClient(config);
    const schema = {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        confidence: { type: 'number' },
      },
      required: ['answer', 'confidence'],
    };

    const result = await client.completeStructured<{
      answer: string;
      confidence: number;
    }>(
      'What is the capital of France? Respond with answer and confidence (0-1).',
      schema,
      'You are a geography expert.'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answer).toBeDefined();
      expect(result.value.answer.toLowerCase()).toContain('paris');
      expect(result.value.confidence).toBeGreaterThanOrEqual(0);
      expect(result.value.confidence).toBeLessThanOrEqual(1);
    } else {
      console.error('API call failed:', result.error);
    }
  }, 60000);

  it.skipIf(shouldSkip)('should handle errors gracefully', async () => {
    const invalidConfig: LLMConfig = {
      provider: 'ai-gateway',
      model: 'gpt-3.5-turbo',
      apiKey: 'invalid-key',
      baseURL: config.baseURL,
      temperature: 0.7,
    };

    const client = createLLMClient(invalidConfig);
    const result = await client.complete('Test prompt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('LLM_ERROR');
      expect(result.error.message).toBeDefined();
      console.log('Expected error received:', result.error.message);
    }
  }, 30000);

  it.skipIf(shouldSkip)('should use custom baseURL when provided', async () => {
    const customConfig: LLMConfig = {
      ...config,
      baseURL: baseUrl || 'https://gateway.ai.cloudflare.com/v1',
    };

    const client = createLLMClient(customConfig);
    const result = await client.complete('Say "test" in one word.');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBeDefined();
      expect(result.value.content.toLowerCase()).toContain('test');
    }
  }, 60000);
});

