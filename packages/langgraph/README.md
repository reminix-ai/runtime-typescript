# @reminix/langgraph

Reminix adapter for LangGraph agents.

## Installation

```bash
npm install @reminix/runtime @reminix/langgraph
```

## Usage

```typescript
import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/langgraph';

// Wrap your LangGraph agent
const wrappedAgent = wrap(graph, 'my-agent');

// Serve it
serve([wrappedAgent], { port: 8080 });
```

## Documentation

See the [main repository](https://github.com/reminix-ai/runtime-typescript) for full documentation.

## License

Apache-2.0
