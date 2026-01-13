# @reminix/vercel-ai

Reminix adapter for Vercel AI SDK agents.

## Installation

```bash
npm install @reminix/runtime @reminix/vercel-ai
```

## Usage

```typescript
import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/vercel-ai';

// Wrap your Vercel AI SDK agent
const wrappedAgent = wrap(agent, 'my-agent');

// Serve it
serve([wrappedAgent], { port: 8080 });
```

## Documentation

See the [main repository](https://github.com/reminix-ai/runtime-typescript) for full documentation.

## License

Apache-2.0
