# LangGraph with Tools Example

An example showing how to serve a LangGraph ReAct agent with tool calling via Reminix Runtime.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/langgraph-tools
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
| `/agents/langgraph-tools/execute` | POST | Execute agent |
| `/agents/langgraph-tools/execute` | POST | Execute agent |

## Available Tools

- `get_weather(city)`: Get weather for Paris, London, Tokyo, or New York

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Discovery
curl http://localhost:8080/info

# Invoke (with tool use)
curl -X POST http://localhost:8080/agents/langgraph-tools/execute \
  -H "Content-Type: application/json" \
  -d '{"input": {"messages": [{"role": "user", "content": "What is the weather in Paris?"}]}}'

# Chat
curl -X POST http://localhost:8080/agents/langgraph-tools/execute \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What is the weather in Tokyo?"}]}'
```

## How it works

1. Define tools using `tool` from `@langchain/core/tools`
2. Create a LangGraph ReAct agent using `createReactAgent`
3. Wrap it with `@reminix/langgraph`
4. Serve it with `@reminix/runtime`

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { wrapAgent } from '@reminix/langgraph';
import { serve } from '@reminix/runtime';

const getWeather = tool(
  async ({ city }) => `Weather in ${city}: Sunny, 22°C`,
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    schema: z.object({ city: z.string() }),
  }
);

const llm = new ChatOpenAI({ model: 'gpt-4o-mini' });
const graph = createReactAgent({ llm, tools: [getWeather] });
const agent = wrapAgent(graph, 'langgraph-tools');

serve({ agents: [agent], port: 8080 });
```
