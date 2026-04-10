/**
 * Engineer Agent - 主入口
 * 核心 Agent 模块示例
 */

import { Agent } from './core/agent.js';
import type { AgentConfig } from './core/types.js';

/**
 * 创建并配置 Agent
 */
export const createAgent = (config: AgentConfig): Agent => {
  return new Agent(config);
};

/**
 * 导出核心类型和类
 */
export { Agent } from './core/agent.js';
export * from './core/types.js';
export { createLLMClient } from './core/llm/llm-client.js';
export type { LLMClient } from './core/llm/llm-client.js';
export { createLLMPlanner } from './core/planner/planner.js';
export type { Planner } from './core/planner/planner.js';

