# Runtime Tools Example

An example showing how to serve standalone tools via Reminix Runtime without any AI framework.

## Setup

```bash
# From the repository root
pnpm install

# Navigate to this example
cd examples/runtime-tools
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
| `/manifest` | GET | Runtime discovery |
| `/mcp` | POST | MCP Streamable HTTP (tool discovery and execution) |

## Available Tools

- `get_weather(location, units?)`: Get weather for San Francisco, New York, Los Angeles, Seattle, or Miami
- `calculate(a, b, operation)`: Perform add, subtract, multiply, or divide
- `string_utils(text, operation)`: Perform uppercase, lowercase, reverse, or length

## Testing

Tools are exposed via MCP at `POST /mcp`. Use JSON-RPC to discover and call tools:

```bash
# Health check
curl http://localhost:8080/health

# Discovery
curl http://localhost:8080/manifest

# List available tools via MCP
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Get weather
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "San Francisco"}}, "id": 2}'

# Get weather in Celsius
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "get_weather", "arguments": {"location": "New York", "units": "celsius"}}, "id": 3}'

# Calculate
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "calculate", "arguments": {"a": 10, "b": 5, "operation": "multiply"}}, "id": 4}'

# String utils
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "string_utils", "arguments": {"text": "Hello World", "operation": "reverse"}}, "id": 5}'
```

## How it works

1. Define tools using `tool()` from `@reminix/runtime`
2. Each tool has a name, description, JSON Schema parameters, and execute function
3. Serve tools with `serve({ tools: [...] })`

```typescript
import { tool, serve } from '@reminix/runtime';

const getWeather = tool('get_weather', {
  description: 'Get the current weather for a city',
  inputSchema: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
      units: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'fahrenheit' },
    },
    required: ['location'],
  },
  handler: async (input) => {
    const location = input.location as string;
    // Fetch weather data...
    return { location, temperature: 72, condition: 'sunny' };
  },
});

serve({ tools: [getWeather] });
```
