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
| `/manifest` | GET | Tool discovery |
| `/tools/get_weather/call` | POST | Get weather for a city |
| `/tools/calculate/call` | POST | Basic math operations |
| `/tools/string_utils/call` | POST | String manipulation |

## Available Tools

- `get_weather(location, units?)`: Get weather for San Francisco, New York, Los Angeles, Seattle, or Miami
- `calculate(a, b, operation)`: Perform add, subtract, multiply, or divide
- `string_utils(text, operation)`: Perform uppercase, lowercase, reverse, or length

## Testing

```bash
# Health check
curl http://localhost:8080/health

# Discovery (shows all tools with their schemas)
curl http://localhost:8080/manifest

# Get weather
curl -X POST http://localhost:8080/tools/get_weather/call \
  -H "Content-Type: application/json" \
  -d '{"input": {"location": "San Francisco"}}'

# Get weather in Celsius
curl -X POST http://localhost:8080/tools/get_weather/call \
  -H "Content-Type: application/json" \
  -d '{"input": {"location": "New York", "units": "celsius"}}'

# Calculate
curl -X POST http://localhost:8080/tools/calculate/call \
  -H "Content-Type: application/json" \
  -d '{"input": {"a": 10, "b": 5, "operation": "multiply"}}'

# String utils
curl -X POST http://localhost:8080/tools/string_utils/call \
  -H "Content-Type: application/json" \
  -d '{"input": {"text": "Hello World", "operation": "reverse"}}'
```

## How it works

1. Define tools using `tool()` from `@reminix/runtime`
2. Each tool has a name, description, JSON Schema parameters, and execute function
3. Serve tools with `serve({ tools: [...] })`

```typescript
import { tool, serve } from '@reminix/runtime';

const getWeather = tool('get_weather', {
  description: 'Get the current weather for a city',
  parameters: {
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
