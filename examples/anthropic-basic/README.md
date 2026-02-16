# Anthropic Basic Example

A simple example showing how to serve an Anthropic Claude chat agent via Reminix Runtime.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/anthropic-basic
```

## Environment

Create a `.env` file in the repository root with your API key:

```bash
ANTHROPIC_API_KEY=your-api-key
```

## Usage

```bash
pnpm start
```

## Endpoints

Once running, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/manifest` | GET | Agent discovery |
| `/agents/anthropic-basic/invoke` | POST | Execute agent |

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Discovery
curl http://localhost:8080/manifest

# Invoke
curl -X POST http://localhost:8080/agents/anthropic-basic/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"prompt": "What is the capital of France?"}}'

# Chat
curl -X POST http://localhost:8080/agents/anthropic-basic/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "Hello!"}]}}'
```

## How it works

1. Create an Anthropic client using `@anthropic-ai/sdk`
2. Serve it with `@reminix/anthropic`

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AnthropicChatAgent } from '@reminix/anthropic';
import { serve } from '@reminix/runtime';

const client = new Anthropic();

const agent = new AnthropicChatAgent(client, { name: 'anthropic-basic', model: 'claude-sonnet-4-5-20250929' });
serve({ agents: [agent] });
```
