# LangChain Basic Example

A simple example showing how to serve a LangChain chat model via Reminix Runtime.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/langchain-basic
```

## Environment

Create a `.env` file in the repository root with your API key:

```bash
OPENAI_API_KEY=your-api-key
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
| `/info` | GET | Agent discovery |
| `/agents/langchain-basic/invoke` | POST | Stateless invocation |
| `/agents/langchain-basic/chat` | POST | Conversational chat |

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Discovery
curl http://localhost:8080/info

# Invoke
curl -X POST http://localhost:8080/agents/langchain-basic/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": {"input": "What is AI?"}}'

# Chat
curl -X POST http://localhost:8080/agents/langchain-basic/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

## How it works

1. Create a LangChain chat model using `@langchain/openai`
2. Wrap it with `@reminix/langchain`
3. Serve it with `@reminix/runtime`

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { wrapAgent } from '@reminix/langchain';
import { serve } from '@reminix/runtime';

const model = new ChatOpenAI({ model: 'gpt-4o-mini' });
const agent = wrapAgent(model, 'langchain-basic');

serve({ agents: [agent], port: 8080 });
```
