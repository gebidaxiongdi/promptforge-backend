// =============================================
// PromptForge 后端代理
// 用途：转发鸿蒙 APP 的请求到 Agnes AI API
// 部署到 Vercel（免费）
// =============================================

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只接受 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  // 从环境变量读取 API Key（在 Vercel 后台设置）
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务器未配置 API Key' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages 参数' });
  }

  try {
    // 调用 Agnes AI（兼容 OpenAI 格式）
    const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          // 系统提示词：让 AI 扮演提示词工程师
          {
            role: 'system',
            content: `你是一位专业的 AI 提示词工程师（Prompt Engineer）。
你的工作流程：
1. 用户会告诉你他想让 AI 帮他做什么（写文案、写代码、翻译、分析数据等）
2. 你通过提问收集必要信息，每次只问 1-2 个问题，不要一次性问太多
3. 当信息收集充分时（一般 3-5 轮对话），自动生成一条结构完整、专业可用的 AI 提示词
4. 生成的提示词必须包含：角色设定、任务描述、具体约束条件、输出格式要求
5. 生成提示词后，用 🎯 标记包裹最终提示词，方便用户识别和复制
6. 生成后询问用户是否需要调整

注意：
- 保持对话简洁，不要啰嗦
- 问问题要有针对性
- 如果用户的信息充足了，就不要继续追问，直接生成提示词
- 生成的提示词要完整可用，用户复制后可以直接粘贴到任何 AI 工具中使用`
          },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Agnes API 错误:', response.status, errorText);
      return res.status(502).json({ error: 'AI 服务调用失败', detail: errorText });
    }

    const data = await response.json();
    
    // 返回给鸿蒙 APP
    return res.status(200).json({
      reply: data.choices[0].message.content,
    });

  } catch (error) {
    console.error('服务器内部错误:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
