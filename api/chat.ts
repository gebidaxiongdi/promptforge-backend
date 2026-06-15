// PromptForge 后端代理 - v2 统一响应格式

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { return res.status(405).json({ error: '仅支持 POST' }); }

  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) { return res.status(500).json({ error: '未配置 API Key' }); }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) { return res.status(400).json({ error: '缺少 messages' }); }

  // 从APP发送的摘要消息中提取实际轮次
  let roundCount = 0;
  for (let m of messages) {
    if (m.role === 'user') { 
      roundCount++;
    }
    if (m.role === 'system' && typeof m.content === 'string') {
      let match = m.content.match(/第(\d+)轮/);
      if (match) {
        roundCount = parseInt(match[1]) - 1; // 减1因为当前轮还没算
      }
    }
  }
  let isLastRound = roundCount >= 5;

  let aiMessages: Object[] = [
    {
      role: 'system',
      content: `你是Prompt架构师。通过选择题把需求转成专业提示词。

## 格式（仅JSON，无其他文字）

choice：{"type":"choice","round":1,"context_summary":"口语化提问","options":[{"id":"A","text":"选项1","reason":""},{"id":"B","text":"选项2","reason":""},{"id":"C","text":"选项3","reason":""},{"id":"D","text":"选项4","reason":""},{"id":"E","text":"","reason":"请在此输入你的具体需求"}]}

final：{"type":"final","prompt":"完整提示词","prompt_title":"标题"}

## 核心规则
1. 最多5轮，第5轮用户回复后必须直接出final
2. 每轮选项必须基于用户上轮选择往深挖
3. E的text固定为""，每次只输出一行JSON`
    }
  ];

  for (let i = 0; i < messages.length; i++) {
    if (i === messages.length - 1 && messages[i].role === 'user') {
      if (isLastRound) {
        aiMessages.push({ role: 'system', content: '已到第5轮，必须输出final类型，不要再出choice。' });
      } else {
        aiMessages.push({ role: 'system', content: '输出choice格式，每项基于上轮往深挖。只输出JSON。' });
      }
    }
    aiMessages.push(messages[i]);
  }

  try {
    const response = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'agnes-2.0-flash', messages: aiMessages, temperature: 0.7, max_tokens: 2000 }),
    });

    if (!response.ok) {
      return res.status(200).json({ replyType: 'text', text: 'AI服务暂时不可用，请稍后重试' });
    }

    const data = await response.json();
    let rawReply = data.choices[0].message.content || '';

    // ----- 后端统一解析AI的JSON，返回简单结构给APP -----
    // 尝试从rawReply中提取最外层完整的JSON对象
    let jsonStr = '';
    let firstBrace = rawReply.indexOf('{');
    let lastBrace = rawReply.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = rawReply.substring(firstBrace, lastBrace + 1);
    }

    if (!jsonStr) {
      return res.status(200).json({ replyType: 'text', text: rawReply.substring(0, 200) });
    }

    // JSON修复：补全缺失括号
    let opens = (jsonStr.match(/\{/g) || []).length;
    let closes = (jsonStr.match(/\}/g) || []).length;
    while (opens > closes) { jsonStr += '}'; closes++; }

    let parsed: any;
    try { parsed = JSON.parse(jsonStr); } catch (e) {
      return res.status(200).json({ replyType: 'text', text: rawReply.substring(0, 200) });
    }

    // 处理嵌套格式 {choice: {...}} 或 {final: {...}}
    let inner = parsed;
    if (parsed.choice && typeof parsed.choice === 'object') inner = parsed.choice;
    if (parsed.final && typeof parsed.final === 'object') inner = parsed.final;

    if (inner.type === 'choice' && Array.isArray(inner.options)) {
      // 返回清洗后的选项数据
      let cleanedOptions = inner.options.map((o: any) => ({
        id: o.id || '',
        text: o.text || '',
        reason: o.reason || ''
      }));
      // 确保有5个选项，E的text为空
      while (cleanedOptions.length < 5) {
        cleanedOptions.push({ id: String.fromCharCode(65 + cleanedOptions.length), text: '', reason: '' });
      }
      if (cleanedOptions.length >= 5) {
        cleanedOptions[4] = { id: 'E', text: '', reason: '请在此输入你的具体需求' };
      }

      return res.status(200).json({
        replyType: 'choice',
        summary: inner.context_summary || '请选择：',
        options: cleanedOptions
      });

    } else if (inner.type === 'final') {
      return res.status(200).json({
        replyType: 'final',
        title: inner.prompt_title || 'AI提示词',
        prompt: inner.prompt || ''
      });
    }

    // 无法识别，返回文本
    return res.status(200).json({ replyType: 'text', text: rawReply.substring(0, 200) });

  } catch (error) {
    return res.status(200).json({ replyType: 'text', text: '服务器内部错误' });
  }
}
