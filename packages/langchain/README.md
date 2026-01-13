# @reminix/langchain

Reminix adapter for LangChain agents.

## Installation

```bash
npm install @reminix/runtime @reminix/langchain
```

## Usage

```typescript
import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/langchain';

// Wrap your LangChain agent
const wrappedAgent = wrap(agent, 'my-agent');

// Serve it
serve([wrappedAgent], { port: 8080 });
```

## Documentation

See the [main repository](https://github.com/reminix-ai/runtime-typescript) for full documentation.

## License

Apache-2.0
