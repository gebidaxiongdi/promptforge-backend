// PromptForge 后端代理

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

  let aiMessages: Object[] = [
    {
      role: 'system',
      content: `你是Prompt架构师。通过选择题把需求转成专业提示词。

输出格式（仅JSON，无其他文字）：

choice轮次：{"type":"choice","round":1,"context_summary":"口语化提问","options":[{"id":"A","text":"选项","reason":""},{"id":"B","text":"选项","reason":""},{"id":"C","text":"选项","reason":""},{"id":"D","text":"选项","reason":""},{"id":"E","text":"","reason":"请在此输入你的具体需求"}]}

final轮次：{"type":"final","prompt":"完整提示词","prompt_title":"标题"}

规则：
- 每轮5个选项，E固定text为""
- context_summary用亲切口语（好哒~、明白啦！、收到～）
- 信息不够出choice，够了出final
- 每次只输出一行JSON，不要其他文字`
    }
  ];

  for (let i = 0; i < messages.length; i++) {
    if (i === messages.length - 1 && messages[i].role === 'user') {
      aiMessages.push({
        role: 'system',
        content: '记住：输出choice必须有5个选项，E的text为空。信息够了就出final。只输出JSON。'
      });
    }
    aiMessages.push(messages[i]);
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
        messages: aiMessages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'AI 服务调用失败' });
    }

    const data = await response.json();
    let reply = data.choices[0].message.content;

    try {
      JSON.parse(reply);
    } catch (e) {
      let first = reply.indexOf('{');
      let last = reply.lastIndexOf('}');
      if (first >= 0 && last > first) {
        let c = reply.substring(first, last + 1);
        let opens = (c.match(/\{/g) || []).length;
        let closes = (c.match(/\}/g) || []).length;
        while (opens > closes) { c += '}'; closes++; }
        try { JSON.parse(c); reply = c; } catch (e2) {}
      }
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
