# @reminix/anthropic

Reminix adapter for Anthropic agents.

## Installation

```bash
npm install @reminix/runtime @reminix/anthropic
```

## Usage

```typescript
import { serve } from '@reminix/runtime';
import { wrap } from '@reminix/anthropic';

// Wrap your Anthropic agent
const wrappedAgent = wrap(agent, 'my-agent');

// Serve it
serve([wrappedAgent], { port: 8080 });
```

## Documentation

See the [main repository](https://github.com/reminix-ai/runtime-typescript) for full documentation.

## License

Apache-2.0
