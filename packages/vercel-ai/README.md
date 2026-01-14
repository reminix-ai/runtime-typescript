# @reminix/vercel-ai

Reminix Runtime adapter for the [Vercel AI SDK](https://sdk.vercel.ai/). Supports both:

- **ToolLoopAgent** - Full agents with tools and automatic tool loop handling
- **Model** - Simple completions via `generateText`/`streamText` without tools

## Installation

```bash
npm install @reminix/runtime @reminix/vercel-ai ai @ai-sdk/openai
```

## Quick Start with ToolLoopAgent

For agents with tools, use `ToolLoopAgent`:

```typescript
import { ToolLoopAgent, tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

import { wrap } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const weatherTool = tool({
  description: 'Get the current weather for a city',
  parameters: z.object({
    city: z.string()
  }),
  execute: async ({ city }) => {
    return { city, temp: 72, condition: 'sunny' };
  }
});

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You help users check the weather.',
  tools: { getWeather: weatherTool }
});

const reminixAgent = wrap(agent, { name: 'weather-agent' });

serve([reminixAgent], { port: 8080 });
```

## Quick Start with Model

For simple completions without tools, pass the model directly:

```typescript
import { openai } from '@ai-sdk/openai';

import { wrap } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const model = openai('gpt-4o');

const reminixAgent = wrap(model, { name: 'chat-agent' });

serve([reminixAgent], { port: 8080 });
```

Your agent is now available at:
- `POST /agents/<name>/invoke` - Stateless invocation
- `POST /agents/<name>/chat` - Conversational chat

## API Reference

### `wrap(modelOrAgent, options)`

Wrap a Vercel AI SDK ToolLoopAgent or Model for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modelOrAgent` | `ToolLoopAgent \| LanguageModel` | required | A ToolLoopAgent or language model |
| `options.name` | `string` | `"vercel-ai-agent"` | Name for the agent (used in URL path) |

**Returns:** `VercelAIAdapter` - A Reminix adapter instance

## Using Different Providers

The Vercel AI SDK supports multiple providers:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { wrap } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

const gpt = wrap(openai('gpt-4o'), { name: 'gpt' });
const claude = wrap(anthropic('claude-sonnet-4-20250514'), { name: 'claude' });
const gemini = wrap(google('gemini-pro'), { name: 'gemini' });

serve([gpt, claude, gemini], { port: 8080 });
```

## When to Use Each Option

| Option | Use Case |
|--------|----------|
| **ToolLoopAgent** | Agents that need tools, multi-step reasoning, automatic tool loop |
| **Model** | Simple completions, providers without dedicated adapters (Google, Mistral, etc.) |

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/)

## License

Apache-2.0
