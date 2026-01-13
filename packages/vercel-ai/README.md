# @reminix/vercel-ai

Reminix Runtime adapter for the [Vercel AI SDK](https://sdk.vercel.ai/). Deploy AI models as a REST API.

## Installation

```bash
npm install @reminix/runtime @reminix/vercel-ai ai @ai-sdk/openai
```

## Quick Start

```typescript
import { openai } from '@ai-sdk/openai';
import { wrap } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

// Create a model using Vercel AI SDK
const model = openai('gpt-4o');

// Wrap it with the Reminix adapter
const agent = wrap(model, { name: 'my-chatbot' });

// Serve it as a REST API
serve([agent], { port: 8080 });
```

Your agent is now available at:
- `POST /my-chatbot/invoke` - Single-turn invocation
- `POST /my-chatbot/chat` - Multi-turn chat

## API Reference

### `wrap(model, options)`

Wrap a Vercel AI SDK model for use with Reminix Runtime.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | `LanguageModel` | required | A Vercel AI SDK language model |
| `options.name` | `string` | `"vercel-ai-agent"` | Name for the agent (used in URL path) |

**Returns:** `VercelAIAdapter` - A Reminix adapter instance

### Using Different Providers

The Vercel AI SDK supports multiple providers:

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { wrap } from '@reminix/vercel-ai';
import { serve } from '@reminix/runtime';

// Use different providers
const gpt = wrap(openai('gpt-4o'), { name: 'gpt' });
const claude = wrap(anthropic('claude-sonnet-4-20250514'), { name: 'claude' });
const gemini = wrap(google('gemini-pro'), { name: 'gemini' });

// Serve all of them
serve([gpt, claude, gemini], { port: 8080 });
```

## Runtime Documentation

For information about the server, endpoints, request/response formats, and more, see the [`@reminix/runtime`](https://www.npmjs.com/package/@reminix/runtime) package.

## Links

- [GitHub Repository](https://github.com/reminix-ai/runtime-typescript)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/)

## License

Apache-2.0
