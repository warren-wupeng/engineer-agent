/**
 * 基本使用示例
 * 展示如何使用核心 Agent 模块
 */

import { Agent, createAgent } from '../index.js';
import type { AgentConfig } from '../core/types.js';

async function main() {
  // 配置 Agent
  const config: AgentConfig = {
    llm: {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: process.env.OPENAI_API_KEY || '',
      temperature: 0.7,
      maxTokens: 2000,
    },
    maxConcurrentTasks: 3,
    retryAttempts: 3,
  };

  // 创建 Agent 实例
  const agent = createAgent(config);

  // 创建初始状态
  let state = Agent.createInitialState();

  // 添加新任务
  state = agent.addTask(state, {
    title: 'Create a new API endpoint',
    description: 'Create a REST API endpoint for user authentication with JWT tokens',
    source: 'email_123',
    priority: 'medium',
  });

  // 获取任务
  const task = agent.getTask(state, state.tasks[0].id);
  console.log('Created task:', task);

  // 分析任务
  const analysisResult = await agent.analyzeTask(state, task!.id);
  if (analysisResult.ok) {
    state = analysisResult.value;
    console.log('Task analyzed:', agent.getTask(state, task!.id));
  } else {
    console.error('Analysis failed:', analysisResult.error);
    return;
  }

  // 规划任务
  const planningResult = await agent.planTask(state, task!.id);
  if (planningResult.ok) {
    state = planningResult.value.state;
    console.log('Planning result:', planningResult.value.planningResult);
    console.log('Task with plan:', agent.getTask(state, task!.id));
  } else {
    console.error('Planning failed:', planningResult.error);
  }

  // 获取待处理任务
  const pendingTasks = agent.getPendingTasks(state);
  console.log('Pending tasks:', pendingTasks.length);
}

// 运行示例（如果直接执行）
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

