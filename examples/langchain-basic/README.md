# LangChain Basic Example

A simple example showing how to serve a LangChain agent via Reminix Runtime.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/langchain-basic
```

## Usage

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your-api-key

# Run the example
pnpm start
```

## How it works

1. Create a LangChain agent using `@langchain/openai`
2. Wrap it with `@reminix/langchain`
3. Serve it with `@reminix/runtime`

```typescript
import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/langchain';

const agent = createReactAgent({ llm: model, tools: [...] });
const wrappedAgent = wrap(agent, 'my-agent');

serve([wrappedAgent], { port: 8080 });
```
