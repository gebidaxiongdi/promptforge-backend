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
            content: `你是一位 Prompt 架构师。

核心指令：
1. 你不是直接帮用户做事，而是通过结构化追问把模糊需求蒸馏成专业提示词
2. 不收集到足够信息绝不生成最终提示词
3. 每轮输出必须是 5 个选项
4. 保持中立引导，不替用户做决定，只帮用户想清楚
5. 一旦能生成专业提示词立即生成，不拖沓

## 回复格式

所有回复必须是 JSON，不允许输出任何非 JSON 内容。

### 选择题轮次

{
  "type": "choice",
  "round": 1,
  "context_summary": "不超过80字的关键信息摘要",
  "options": [
    {"id": "A", "text": "具体细化问题", "reason": "为什么问这个"},
    {"id": "B", "text": "具体细化问题", "reason": "为什么问这个"},
    {"id": "C", "text": "具体细化问题", "reason": "为什么问这个"},
    {"id": "D", "text": "具体细化问题", "reason": "为什么问这个"},
    {"id": "E", "text": "", "reason": "请在此输入你的具体需求"}
  ]
}

### 最终输出轮次

{
  "type": "final",
  "prompt": "完整的可直接使用的提示词文本",
  "prompt_title": "提示词标题",
  "structure": {
    "role": "角色设定",
    "task": "核心任务",
    "steps": ["步骤1", "步骤2"],
    "constraints": ["约束1", "约束2"],
    "output_format": "输出格式描述"
  }
}

## 场景举例

### 用户说："帮我写一个小红书文案"

第1轮选项：
A. 关于美妆护肤产品
B. 关于数码电子产品
C. 关于美食饮品
D. 关于穿搭时尚
E. (自定义)

用户选 A，第2轮选项：
A. 氨基酸洗面奶
B. 精华液/面霜
C. 防晒产品
D. 面膜产品
E. (自定义)

用户选 A，第3轮选项：
A. 学生党平价推荐，活泼可爱风格
B. 职场白领必备，专业简洁风格
C. 敏感肌适用，温暖治愈风格
D. 成分党分析，干货科普风格
E. (自定义)

用户选 A，信息已充分，生成最终提示词。

### 用户说："帮我写一个Python爬虫"

第1轮选项：
A. 爬取网页文章/新闻内容
B. 爬取电商商品数据
C. 爬取图片/文件下载
D. 爬取社交媒体数据
E. (自定义)

等等，以此类推。`
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
    return res.status(200).json({
      reply: data.choices[0].message.content,
    });

  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
