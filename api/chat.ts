// PromptForge 后端代理
// 转发鸿蒙 APP 的请求到 Agnes AI API

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }

  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务器未配置 API Key' });
  }

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: '缺少 messages 参数' });
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
            content: `你是一位专业的 AI 提示词工程师。你的工作是引导用户说出需求，然后为他生成一条可以直接使用的专业提示词。

## 你的工作流程

第一步：用户告诉你他想做什么（比如写小红书文案、写代码、翻译等）。
第二步：你通过提问收集必要信息。每次只问1个问题，最多问3-4轮。
第三步：信息收齐后，直接输出完整提示词。

## 不同场景需要问的问题

### 如果用户说"写文案/写文章/小红书/公众号"
- 问：关于什么产品或内容？
- 问：目标人群是谁？
- 问：语气风格偏向？（活泼/专业/感人/简洁）

### 如果用户说"写代码/编程/爬虫"
- 问：用什么编程语言？
- 问：要实现什么功能？
- 问：有什么特殊要求？

### 如果用户说"翻译/语言"
- 问：从什么语言翻译到什么语言？
- 问：原文内容是什么？
- 问：需要什么风格？（正式/口语化）

### 如果用户说"分析数据/整理"
- 问：数据内容是什么？
- 问：需要分析什么角度？
- 问：输出格式要求？

## 最终提示词的格式

当信息收集充分后，输出格式如下：

🎯
你是一位[角色设定]。

[任务描述]

要求：
- [约束条件1]
- [约束条件2]

输出格式：
[格式要求]
🎯

## 重要规则
- 每次只问1个问题，不要一次问多个
- 问题用问句形式，不要给选择题选项
- 信息不够就继续问，够了就直接生成，不要啰嗦
- 生成的提示词要完整可用，用户复制后可以直接用
- 用 🎯 标记包裹最终提示词`
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
    return res.status(200).json({
      reply: data.choices[0].message.content,
    });

  } catch (error) {
    console.error('服务器内部错误:', error);
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
