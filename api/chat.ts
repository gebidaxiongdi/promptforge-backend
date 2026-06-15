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

  // 构建发送给 AI 的消息列表，在最后一条用户消息前插入格式提醒
  let aiMessages: Object[] = [
    {
      role: 'system',
      content: `你是 Prompt 架构师。通过选择题把需求蒸馏成专业提示词。

## 格式
choice轮次：
{"type":"choice","round":1,"context_summary":"口语化提问","options":[{"id":"A","text":"选项","reason":"原因"},{"id":"B","text":"选项","reason":"原因"},{"id":"C","text":"选项","reason":"原因"},{"id":"D","text":"选项","reason":"原因"},{"id":"E","text":"","reason":"请在此输入你的具体需求"}]}

final轮次：
{"type":"final","prompt":"完整提示词","prompt_title":"标题"}

## 规则
- 每轮5个选项，E固定为空
- context_summary用亲切口语（好哒~、明白啦！、收到～）
- 信息不够继续出choice，信息够了直接出final
- 每次只输出JSON，不要加任何其他文字
- E选项的text必须是空字符串""`
    }
  ];

  // 给最后一条用户消息前加上格式提醒
  for (let i = 0; i < messages.length; i++) {
    if (i === messages.length - 1 && messages[i].role === 'user') {
      // 在用户消息前插入提醒
      aiMessages.push({
        role: 'system',
        content: '记住：输出必须是JSON格式。choice轮次必须有完整5个选项，E的text为空字符串。如果信息够了就出final。只输出JSON，不要其他文字。'
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

    // JSON修复
    try {
      JSON.parse(reply);
    } catch (e) {
      let firstBrace = reply.indexOf('{');
      let lastBrace = reply.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        let candidate = reply.substring(firstBrace, lastBrace + 1);
        try {
          JSON.parse(candidate);
          reply = candidate;
        } catch (e2) {
          let opens = (candidate.match(/\{/g) || []).length;
          let closes = (candidate.match(/\}/g) || []).length;
          while (opens > closes) { candidate += '}'; closes++; }
          try { JSON.parse(candidate); reply = candidate; } catch (e3) {}
        }
      }
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
