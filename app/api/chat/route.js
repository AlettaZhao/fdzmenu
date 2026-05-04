const PROVIDERS = {
  moonshot: {
    keyEnv: 'MOONSHOT_API_KEY',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    textModelEnv: 'MOONSHOT_TEXT_MODEL',
    visionModelEnv: 'MOONSHOT_VISION_MODEL',
    defaultTextModel: 'moonshot-v1-8k',
    defaultVisionModel: 'moonshot-v1-128k-vision-preview',
  },
  openai: {
    keyEnv: 'OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    textModelEnv: 'OPENAI_TEXT_MODEL',
    visionModelEnv: 'OPENAI_VISION_MODEL',
    defaultTextModel: 'gpt-4.1-mini',
    defaultVisionModel: 'gpt-4.1-mini',
  },
};

function getProvider() {
  const name = (process.env.AI_PROVIDER || 'moonshot').trim().toLowerCase();
  const provider = PROVIDERS[name];

  if (!provider) {
    const supported = Object.keys(PROVIDERS).join(', ');
    const error = new Error(`AI_PROVIDER 只支持: ${supported}`);
    error.status = 400;
    throw error;
  }

  return { name, provider };
}

function toChatMessages(messages, providerName) {
  let hasImage = false;

  const converted = messages.map((msg) => {
    const role = ['system', 'user', 'assistant'].includes(msg.role) ? msg.role : 'user';

    if (typeof msg.content === 'string') {
      return { role, content: msg.content };
    }

    if (!Array.isArray(msg.content)) {
      return { role, content: '' };
    }

    const content = msg.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text', text: block.text || '' };
      }

      if (block.type === 'image' && block.source?.type === 'base64') {
        hasImage = true;
        const mediaType = block.source.media_type || 'image/jpeg';
        const image_url = {
          url: `data:${mediaType};base64,${block.source.data}`,
        };

        if (providerName === 'openai') {
          image_url.detail = process.env.OPENAI_IMAGE_DETAIL || 'auto';
        }

        return { type: 'image_url', image_url };
      }

      return null;
    }).filter(Boolean);

    return { role, content };
  });

  return { messages: converted, hasImage };
}

function getTemperature(providerName, model) {
  const raw = process.env.AI_TEMPERATURE;
  const configured = Number(raw);
  if (raw !== undefined && raw.trim() !== '' && !Number.isNaN(configured)) {
    return configured;
  }

  if (providerName === 'moonshot' && model.startsWith('kimi-k2.')) {
    return 1;
  }

  return 0.2;
}

async function readProviderError(response) {
  const text = await response.text();
  if (!text) return '';

  try {
    const data = JSON.parse(text);
    return data.error?.message || data.message || '';
  } catch {
    return text.slice(0, 240);
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.messages)) {
      return Response.json({ error: '缺少 messages' }, { status: 400 });
    }

    const { name, provider } = getProvider();
    const apiKey = process.env[provider.keyEnv];

    if (!apiKey) {
      return Response.json(
        { error: `服务器未配置 ${provider.keyEnv}` },
        { status: 500 }
      );
    }

    const maxTokens = Math.min(Number(body.max_tokens) || 2048, 4096);
    const { messages, hasImage } = toChatMessages(body.messages, name);
    const model = hasImage
      ? (process.env[provider.visionModelEnv] || provider.defaultVisionModel)
      : (process.env[provider.textModelEnv] || provider.defaultTextModel);
    const temperature = getTemperature(name, model);
    const timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 85000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(provider.endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          messages,
        }),
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        return Response.json(
          { error: 'AI 服务响应超时，请稍后重试' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const providerMessage = await readProviderError(response);
      console.error(`${name} API error:`, response.status, providerMessage);
      return Response.json(
        { error: `AI 服务错误: ${response.status}${providerMessage ? ` - ${providerMessage}` : ''}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return Response.json({
      content: [{ type: 'text', text }],
      stop_reason: data.choices?.[0]?.finish_reason || 'end_turn',
      model: data.model,
      usage: data.usage,
    });

  } catch (error) {
    console.error('API route error:', error.message);
    return Response.json(
      { error: error.status === 400 ? error.message : '服务器内部错误' },
      { status: error.status || 500 }
    );
  }
}
