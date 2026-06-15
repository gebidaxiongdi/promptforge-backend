// PromptForge 后端代理

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { return res.status(405).json({ error: '仅支持 POST' }); }

  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) { return res.status(500).json({ error: '未配置 API Key' }); }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) { return res.status(400).json({ error: '缺少 messages' }); }

  // 计算当前是第几轮（统计 user 消息数）
  let userCount = 0;
  for (let m of messages) {
    if (m.role === 'user') { userCount++; }
  }
  let roundNum = userCount;
  let isLastRound = roundNum >= 5;

  let aiMessages: Object[] = [
    {
      role: 'system',
      content: `你是Prompt架构师。通过选择题把需求转成专业提示词。

## 格式（仅JSON，无其他文字）

choice：{"type":"choice","round":1,"context_summary":"口语化提问","options":[{"id":"A","text":"选项1","reason":""},{"id":"B","text":"选项2","reason":""},{"id":"C","text":"选项3","reason":""},{"id":"D","text":"选项4","reason":""},{"id":"E","text":"","reason":"请在此输入你的具体需求"}]}

final：{"type":"final","prompt":"完整提示词","prompt_title":"标题"}

## 核心规则
1. 最多5轮，第5轮用户回复后必须直接出final，不准再出choice
2. 每轮的选项必须基于用户上一轮的选择"往深挖"。比如用户选了"美妆护肤"，下次就该问"洗面奶/精华/防晒/面膜"，而不是又问大类
3. context_summary要体现上轮关键信息，比如"收到！你要写美妆类的洗面奶文案~"
4. 第5轮必须出final，信息不够也要基于已收集的信息生成最佳提示词
5. E的text固定为""`
    }
  ];

  // 如果是最后一轮，在用户消息前插一条强制final指令
  for (let i = 0; i < messages.length; i++) {
    if (i === messages.length - 1 && messages[i].role === 'user') {
      if (isLastRound) {
        aiMessages.push({
          role: 'system',
          content: '这是第5轮了，用户的最后一次选择已给出。现在必须输出final类型，不要再出choice。根据已收集的所有信息，生成一条完整的专业提示词。'
        });
      } else {
        aiMessages.push({
          role: 'system',
          content: '输出choice格式。选项必须基于用户上轮回复往深挖细化。如果信息已足够可直接出final。只输出JSON。'
        });
      }
    }
    aiMessages.push(messages[i]);
  }

  try {
    const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: aiMessages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) { return res.status(502).json({ error: 'AI 服务调用失败' }); }

    const data = await response.json();
    let reply = data.choices[0].message.content;

    // JSON修复
    try { JSON.parse(reply); } catch (e) {
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
