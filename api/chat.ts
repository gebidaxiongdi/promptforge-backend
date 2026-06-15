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
            content: `你是一位 Prompt 架构师。你的工作是通过选择题把用户模糊需求蒸馏成专业提示词。

## 核心规则
1. 每轮必须输出5个选项（A/B/C/D/E），E必须是空的自定义项
2. 每次只出一轮选择题，信息不够继续问，够了立即生成最终提示词
3. 最终提示词必须完整可用，用户复制后直接粘贴到AI中使用

## JSON格式要求（非常重要）
你必须输出严格的JSON，不允许有任何格式错误。
- 每个 { 必须有对应的 }
- 每个 [ 必须有对应的 ]
- 每个 " 必须配对
- 最后一项后面不能有逗号

## 选择题格式（输出 type: choice）

"context_summary" 是直接展示给用户看的，必须用亲切口语的语气写，像这样：
- "好哒~你想写关于哪方面的内容呢？"
- "明白了！那具体是什么产品呢？"
- "收到～最后再确认一下风格偏好就OK啦！"

JSON格式如下：
{"type":"choice","round":1,"context_summary":"好哒～你想写关于哪方面的小红书内容呢？","options":[{"id":"A","text":"选项A","reason":"原因"},{"id":"B","text":"选项B","reason":"原因"},{"id":"C","text":"选项C","reason":"原因"},{"id":"D","text":"选项D","reason":"原因"},{"id":"E","text":"","reason":"请在此输入你的具体需求"}]}

## 最终输出格式（type: final）

{"type":"final","prompt":"完整的提示词","prompt_title":"标题"}

## 场景示例
用户说"帮我写一个小红书文案"，第1轮选项：
A:美妆护肤 B:穿搭时尚 C:美食探店 D:数码家电 E:自定义

用户选A，第2轮：
A:洗面奶 B:精华面霜 C:防晒 D:面膜 E:自定义

用户选A，第3轮：
A:学生党平价 活泼风格 B:白领轻奢 专业风格 C:敏感肌 温和风格 D:成分党 干货风格 E:自定义

用户选A，信息充分，输出 final。

## 重要
- 保持JSON严格正确，不要多括号也不要少括号
- 每次只输出一行JSON，不要加其他文字说明
- E选项的text必须是空字符串""`
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
    let reply = data.choices[0].message.content;

    // JSON修复：AI偶尔会生成格式有问题的JSON
    // 修复常见问题：丢失的闭合括号
    try {
      JSON.parse(reply);
    } catch (e) {
      // 尝试修复：找到最外层 { 和最后一个 } 之间的内容
      let firstBrace = reply.indexOf('{');
      let lastBrace = reply.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        let candidate = reply.substring(firstBrace, lastBrace + 1);
        try {
          JSON.parse(candidate);
          reply = candidate;
        } catch (e2) {
          // 尝试补充缺失的括号
          let cleaned = candidate;
          let opens = (cleaned.match(/\{/g) || []).length;
          let closes = (cleaned.match(/\}/g) || []).length;
          while (opens > closes) {
            cleaned += '}';
            closes++;
          }
          try {
            JSON.parse(cleaned);
            reply = cleaned;
          } catch (e3) {
            // 放弃修复，原样返回
          }
        }
      }
    }

    return res.status(200).json({ reply });

  } catch (error) {
    return res.status(500).json({ error: '服务器内部错误' });
  }
}
