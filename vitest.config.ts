import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // 加载环境变量，优先加载 .env.local（本地开发配置）
  const env = loadEnv(mode, process.cwd(), '');
  
  // 如果 .env.local 中有代理配置，自动设置到 process.env
  // 这样 Node.js 的 fetch 会自动使用这些代理设置
  if (env.https_proxy && !process.env.https_proxy) {
    process.env.https_proxy = env.https_proxy;
  }
  if (env.http_proxy && !process.env.http_proxy) {
    process.env.http_proxy = env.http_proxy;
  }
  if (env.all_proxy && !process.env.all_proxy) {
    process.env.all_proxy = env.all_proxy;
  }

  return {
    test: {
      env,
      globals: true,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
  };
});

