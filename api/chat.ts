import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST' });
  }
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '未配置 API Key' });
  }
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages' });
  }
  try {
    const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的 AI 提示词工程师。用户告诉你他想做什么，你通过提问收集信息，收集充分后自动生成一条完整专业的提示词。提示词需包含：角色设定、任务描述、约束条件、输出格式。用 🎯 标记包裹最终提示词。'
          },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'AI 服务调用失败' });
    }
    const data = await response.json();
    return res.status(200).json({ reply: data.choices[0].message.content });
  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
