# Agent Friday's Intelligence Router

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)

Automatically routes AI tasks to the optimal language model based on capability matching, cost awareness, latency requirements, and reliability tracking. Features circuit breakers for failing providers, monthly budget enforcement, local-first model policies, and complete audit trails.

Extracted from [Agent Friday](https://github.com/FutureSpeakAI/Agent-Friday) (AGI Desktop OS) for standalone use.

## Why This Matters

If your application uses multiple LLM providers — Claude for reasoning, GPT-4o for vision, a local Llama for simple tasks — you're probably hardcoding which model handles what. That breaks the moment a provider goes down, your budget runs out, or you add a new model.

This router replaces hardcoded model selection with **automatic multi-dimensional scoring**. Every incoming task is classified by category (code, reasoning, creative, factual), complexity, and latency requirements, then scored against every available model across five dimensions: capability match, cost, speed, context window fit, and recent reliability. The highest-scoring model wins.

What makes this different from simple fallback chains:
- **Circuit breakers** automatically stop routing to models that are failing, and recover when they come back
- **Budget enforcement** tracks monthly spending and automatically falls back to cheaper models when you're approaching your cap
- **Local-first policies** give you five granular levels of preference for local models, from "never use" to "always prefer" — so you can run cheap tasks on Llama and expensive tasks on Claude without writing routing logic
- **Full audit trail** records every routing decision with the complete score breakdown, so you can see exactly why the router chose what it chose

If you're building an AI application that needs to be cost-aware, reliable, and model-agnostic, this handles the routing layer so you can focus on the application logic.

## Key Features

- **Multi-dimensional model scoring** -- capability, cost, speed, context window, and reliability weighted into a single score
- **Circuit breaker pattern** -- consecutive failures automatically downgrade models; recovers when issues are resolved
- **Budget enforcement** -- monthly spending caps and per-request cost limits with automatic cheaper-model fallback
- **Local model preference policies** -- five levels from `disabled` to `preferred`, with minimum capability thresholds
- **Fallback chains** -- when no model meets requirements, gracefully degrades to a configurable fallback
- **Routing audit log** -- every routing decision is recorded with full score breakdowns and queryable history
- **Task profiling** -- automatic classification by category (code, reasoning, creative, etc.), complexity, and latency tier
- **Built-in model registry** -- ships with capability profiles for Claude, GPT-4o, Gemini, Llama, DeepSeek, Qwen, and more
- **Persistent state** -- saves models, decisions, and config to disk; survives restarts

## Installation

```bash
npm install github:FutureSpeakAI/agent-fridays-intelligence-router
```

## Quick Start

```typescript
import { IntelligenceRouter, classifyTask } from '@agent-friday/intelligence-router';

// 1. Create the router
const router = new IntelligenceRouter({
  dataDir: './data',
  getApiKey: (provider) => process.env[`${provider.toUpperCase()}_API_KEY`] ?? null,
  config: {
    monthlyBudgetUsd: 50,
    maxRequestCostUsd: 0.50,
    localModelPolicy: 'preferred',
  },
});

// 2. Initialize (loads persisted state from disk)
await router.initialize();

// 3. Classify and route a task
const task = classifyTask({
  messageContent: 'Analyze this contract for liability risks',
  toolCount: 0,
  hasImages: false,
  hasAudio: false,
  systemPromptLength: 500,
  conversationLength: 0,
});

const decision = router.selectModel(task);
console.log(decision.selectedModelId); // e.g. 'anthropic/claude-opus-4'
console.log(decision.reason);          // score breakdown

// 4. Record outcome after the request completes
router.recordOutcome(decision.id, {
  success: true,
  durationMs: 2340,
  inputTokens: 1200,
  outputTokens: 800,
});

// 5. Check budget
const stats = router.getStats();
console.log(`Budget: $${stats.monthlySpentUsd.toFixed(2)} / $${stats.monthlyBudgetUsd}`);

// 6. View audit log
const recent = router.getRecentDecisions(10);
recent.forEach(d => console.log(d.selectedModelId, d.reason));
```

## Architecture

### Scoring Formula

Each model is scored against the task profile using a weighted composite:

```
totalScore = capability * 0.35
           + cost      * 0.20
           + speed     * 0.20
           + context   * 0.10
           + reliability * 0.15
           + localBonus   (0.3 when policy is 'preferred')
```

| Dimension | What it measures | Range |
|-----------|-----------------|-------|
| Capability | Task-category strength vs. complexity required | 0--1 |
| Cost | Estimated request cost vs. budget ceiling | 0--1 |
| Speed | Estimated generation time vs. latency tier | 0--1 |
| Context | Input token count vs. model context window | 0--1 |
| Reliability | Inverse of consecutive failure count | 0--1 |

Hard disqualifiers (score = 0): missing required capability (vision, audio, tool-use), insufficient context window, model unavailable, or circuit breaker open (3+ consecutive failures).

### Local Model Policies

| Policy | Behavior |
|--------|----------|
| `disabled` | Local models never selected by router |
| `background` | Only for non-interactive tasks (extraction, embedding) |
| `conservative` | Simple/moderate tasks in safe categories only |
| `all` | Local models compete equally with cloud models |
| `preferred` | Local models get a 0.3 scoring bonus (default) |

All policies (except `disabled`) enforce a minimum capability threshold (default: 0.55) to prevent local models from winning on cost alone.

## API Reference

### `IntelligenceRouter`

#### Constructor

```typescript
new IntelligenceRouter(options: IntelligenceRouterOptions)
```

| Option | Type | Description |
|--------|------|-------------|
| `dataDir` | `string` | Directory for persisting router state |
| `getApiKey` | `(provider: string) => string | null` | Optional callback to check API key availability |
| `getPreferredProvider` | `() => string | null` | Optional callback for preferred provider |
| `localModelProvider` | `LocalModelProvider` | Optional local model endpoint for discovery |
| `config` | `Partial<RoutingConfig>` | Optional config overrides |

#### Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Load persisted state and merge default models |
| `stop()` | Cancel pending save timers |
| `selectModel(task)` | Route a task to the optimal model |
| `recordOutcome(id, outcome)` | Record success/failure after request completes |
| `registerModel(model)` | Add or update a model in the registry |
| `setModelAvailability(id, available)` | Mark a model available/unavailable |
| `resetModelFailures(id)` | Reset circuit breaker for a model |
| `discoverLocalModels()` | Probe local endpoint for available models |
| `getStats()` | Get routing statistics |
| `getConfig()` | Get current config |
| `updateConfig(partial)` | Update config fields |
| `getRecentDecisions(limit?)` | Query recent routing decisions |
| `getPromptContext()` | Get routing context for system prompt injection |

### Pure Functions

These are exported for direct use and testing:

| Function | Description |
|----------|-------------|
| `classifyTask(params)` | Classify a message into a TaskProfile |
| `scoreModel(model, task, config)` | Score a model against a task (0--1) |
| `estimateRequestCost(model, inputTokens, outputTokens)` | Estimate cost in USD |
| `buildRoutingExplanation(score, task, budgetConstrained, isFallback)` | Human-readable decision explanation |

## Origin

This package is extracted from [Agent Friday](https://github.com/FutureSpeakAI/Agent-Friday), an AGI desktop operating system. The intelligence router is the core decision engine that Agent Friday uses to automatically select the best model for each task.

## License

[MIT](LICENSE) -- Copyright (c) 2025 FutureSpeakAI
