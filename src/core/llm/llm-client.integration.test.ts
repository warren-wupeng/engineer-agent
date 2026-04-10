/**
 * LLM 客户端集成测试
 * 真实调用 OpenAI API，不使用 mock
 */

import { describe, it, expect } from 'vitest';
import { createLLMClient } from './llm-client.js';
import type { LLMConfig } from '../types.js';

// 注意：环境变量由 vitest.config.ts 自动加载
// 代理配置应该在 .env.local 文件中设置（仅本地环境）

describe('LLM Client Integration Tests', () => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // 调试：检查环境变量
  console.log('Environment check:');
  console.log('OPENAI_API_KEY exists:', !!apiKey);
  console.log('OPENAI_API_KEY length:', apiKey?.length || 0);
  console.log('OPENAI_API_KEY prefix:', apiKey?.substring(0, 7) || 'N/A');
  console.log('All env vars with OPENAI:', Object.keys(process.env).filter(k => k.includes('OPENAI')));
  
  // 如果没有 API key，跳过所有测试
  const shouldSkip = !apiKey;
  
  if (shouldSkip) {
    console.warn('OPENAI_API_KEY not set, skipping integration tests');
  }

  const config: LLMConfig = {
    provider: 'openai',
    model: 'gpt-3.5-turbo', // 使用更便宜的模型进行测试
    apiKey: apiKey!, // 使用非空断言，因为 shouldSkip 已经检查了 apiKey
    temperature: 0.7,
    maxTokens: 100,
  };

  it.skipIf(shouldSkip)('should create OpenAI client successfully', () => {
    const client = createLLMClient(config);
    expect(client).toBeDefined();
    expect(client.complete).toBeDefined();
    expect(client.completeStructured).toBeDefined();
  });

  it.skipIf(shouldSkip)('should complete a simple prompt', async () => {
    const client = createLLMClient(config);
    
    console.log('Starting API call...');
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
      console.log(`API call completed in ${duration}ms`);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBeDefined();
        expect(result.value.content.length).toBeGreaterThan(0);
        expect(result.value.content.toLowerCase()).toContain('hello');
        
        // 验证 usage 信息
        if (result.value.usage) {
          expect(result.value.usage.promptTokens).toBeGreaterThan(0);
          expect(result.value.usage.completionTokens).toBeGreaterThan(0);
          expect(result.value.usage.totalTokens).toBeGreaterThan(0);
        }
      } else {
        // 如果失败，输出错误信息以便调试
        console.error('API call failed:', result.error);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`API call failed after ${duration}ms:`, error);
      throw error;
    }
  }, 60000); // 60秒超时（代理可能需要更长时间）

  it.skipIf(shouldSkip)('should complete with system prompt', async () => {
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

  it.skipIf(shouldSkip)('should handle structured output', async () => {
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
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      apiKey: 'invalid-key',
      temperature: 0.7,
    };

    const client = createLLMClient(invalidConfig);
    const result = await client.complete('Test prompt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe('LLM_ERROR');
      expect(result.error.message).toBeDefined();
    }
  }, 30000);
});

