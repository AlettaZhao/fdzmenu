// /home/ubuntu/fandazi/app/api/chat/route.js
// 后端代理：接收前端的 Claude 格式请求，转换后调用 Kimi API
// 根据是否有图片输入，自动选择 vision 或文本模型

export async function POST(request) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: '服务器未配置 API 密钥' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const maxTokens = Math.min(body.max_tokens || 4096, 4096);

    // 检测消息中是否包含图片
    let hasImage = false;
    const kimiMessages = (body.messages || []).map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }
      const convertedContent = msg.content.map(block => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text };
        }
        if (block.type === 'image' && block.source?.type === 'base64') {
          hasImage = true;
          const mediaType = block.source.media_type || 'image/jpeg';
          return {
            type: 'image_url',
            image_url: {
              url: `data:${mediaType};base64,${block.source.data}`,
            },
          };
        }
        return null;
      }).filter(Boolean);
      return { role: msg.role, content: convertedContent };
    });

    // 有图片用 vision 模型（OCR 优化），没图片用普通模型（便宜、快）
    const model = hasImage 
      ? 'moonshot-v1-128k-vision-preview' 
      : 'kimi-k2-0905-preview';

    const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        temperature: 0.3,
        messages: kimiMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Kimi API error:', response.status, errText);
      return Response.json(
        { error: `AI 服务错误: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const kimiContent = data.choices?.[0]?.message?.content || '';
    const claudeFormatResponse = {
      content: [{ type: 'text', text: kimiContent }],
      stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
      model: data.model,
      usage: data.usage,
    };

    return Response.json(claudeFormatResponse);

  } catch (error) {
    console.error('API route error:', error);
    return Response.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
