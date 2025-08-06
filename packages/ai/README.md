# @formbricks/ai

A model-agnostic AI package for Formbricks, providing a unified interface for LLM operations across different providers.

## Features

- **Multi-Provider Support**: OpenAI and Anthropic models with easy switching
- **Type-Safe**: Full TypeScript support with schema validation
- **Environment-Based Configuration**: Automatic provider selection via environment variables
- **Structured Output**: Generate validated JSON objects from prompts using schemas
- **Helper Functions**: Built-in summarization and translation utilities

## Installation

This package is part of the Formbricks monorepo and is intended for internal use.

```bash
pnpm install @formbricks/ai
```

## Quick Start

### Environment Configuration

Set up your environment variables:

```bash
# Provider selection (defaults to "openai")
AI_PROVIDER=openai  # or "anthropic"

# Model selection (uses sensible defaults if not specified)
AI_MODEL=gpt-4  # or "claude-3-sonnet-20240229"

# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: Custom base URL
AI_BASE_URL=https://your-custom-endpoint.com
```

### Basic Usage

#### Text Generation

```typescript
import { generateText } from "@formbricks/ai";

const result = await generateText({
  prompt: "Explain quantum computing in simple terms",
  system: "You are a helpful science teacher",
  temperature: 0.7,
  maxTokens: 200,
});

console.log(result.text);
```

#### Structured Object Generation

```typescript
import { z } from "zod";
import { generateObject } from "@formbricks/ai";

const analysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  summary: z.string(),
  keyTopics: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const result = await generateObject({
  prompt: "Analyze this customer feedback: 'The product is amazing but delivery was slow'",
  schema: analysisSchema,
  temperature: 0.3,
});

console.log(result.object.sentiment); // Type-safe access
console.log(result.object.keyTopics);
```

#### Helper Functions

```typescript
import { summarizeText, translateText } from "@formbricks/ai";

// Summarization
const summary = await summarizeText(longText, 150);

// Translation
const translated = await translateText("Hello, how are you?", "Spanish", "English");
```

## Configuration

### Programmatic Configuration

You can override environment configuration programmatically:

```typescript
import { createAIModel, generateText } from "@formbricks/ai";

const customConfig = {
  provider: "anthropic" as const,
  model: "claude-3-haiku-20240307",
  apiKey: "your-api-key",
};

// Use custom config for specific calls
const result = await generateText(
  {
    prompt: "Hello world",
  },
  customConfig
);

// Or create a reusable model instance
const aiModel = createAIModel(customConfig);
```

### Supported Models

#### OpenAI

- `gpt-4` (default)
- `gpt-4-turbo`
- `gpt-3.5-turbo`

#### Anthropic

- `claude-3-sonnet-20240229` (default)
- `claude-3-haiku-20240307`
- `claude-3-opus-20240229`

## Error Handling

The package provides clear error messages for common issues:

```typescript
import { generateText, isAIConfigured } from "@formbricks/ai";

// Check if AI is properly configured
if (!isAIConfigured()) {
  throw new Error("AI is not properly configured. Please check your environment variables.");
}

try {
  const result = await generateText({
    prompt: "Your prompt here",
  });
} catch (error) {
  console.error("AI generation failed:", error.message);
}
```

## Usage in Formbricks

This package is designed to be used across the Formbricks ecosystem:

- **NextJS API Routes**: For server-side AI operations
- **Background Jobs**: For processing surveys and responses
- **Future NestJS Backend**: Modular design allows easy integration

## Development

### Building

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

### Code Quality

```bash
pnpm lint
```

## Architecture

The package follows a layered architecture:

1. **Types Layer** (`types.ts`): TypeScript definitions and interfaces
2. **Configuration Layer** (`config.ts`): Provider setup and validation
3. **Abstraction Layer** (`ai.ts`): Main API functions
4. **Export Layer** (`index.ts`): Public API exports

This design ensures:

- Easy testing and mocking
- Provider-agnostic implementation
- Type safety throughout
- Consistent error handling
