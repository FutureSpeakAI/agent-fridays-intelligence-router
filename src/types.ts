/**
 * Type definitions for Agent Friday's Intelligence Router.
 *
 * Extracted from Agent Friday — the world's most trustworthy AI assistant.
 */

export type TaskCategory =
  | 'reasoning'      // Deep analysis, legal review, complex decisions
  | 'code'           // Code generation, review, refactoring
  | 'creative'       // Writing, brainstorming, ideation
  | 'conversation'   // Quick chat, Q&A, simple lookup
  | 'extraction'     // Data parsing, summarization, key point extraction
  | 'vision'         // Image analysis, screenshot interpretation
  | 'audio'          // Voice interaction, transcription
  | 'tool-use'       // Function calling, multi-step agent loops
  | 'embedding'      // Similarity search, semantic matching
  | 'unknown';

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';

export type LatencyTier = 'realtime' | 'fast' | 'standard' | 'batch';

export type ProviderName = 'anthropic' | 'openrouter' | 'google' | 'local' | 'ollama';

export interface TaskProfile {
  /** Primary category */
  category: TaskCategory;
  /** Estimated complexity */
  complexity: TaskComplexity;
  /** Latency requirement */
  latency: LatencyTier;
  /** Approximate input tokens */
  estimatedInputTokens: number;
  /** Whether tool use is required */
  requiresToolUse: boolean;
  /** Whether vision capability is needed */
  requiresVision: boolean;
  /** Whether audio capability is needed */
  requiresAudio: boolean;
  /** Whether long context (>32k) is needed */
  requiresLongContext: boolean;
  /** Optional tags for finer matching */
  tags: string[];
}

export interface ModelCapability {
  /** Unique model identifier (e.g. 'anthropic/claude-opus-4') */
  modelId: string;
  /** Human-readable name */
  name: string;
  /** Provider this model is accessed through */
  provider: ProviderName;
  /** Which provider to route through (may differ for OpenRouter models) */
  routeVia: 'anthropic' | 'openrouter' | 'google' | 'local';
  /** Maximum context window in tokens */
  contextWindow: number;
  /** Cost per million input tokens (USD) */
  inputCostPerMillion: number;
  /** Cost per million output tokens (USD) */
  outputCostPerMillion: number;
  /** Estimated tokens per second output */
  tokensPerSecond: number;
  /** Category-specific strength scores (0-1) */
  strengths: Partial<Record<TaskCategory, number>>;
  /** Supports function/tool calling */
  supportsToolUse: boolean;
  /** Supports vision (image inputs) */
  supportsVision: boolean;
  /** Supports audio input/output */
  supportsAudio: boolean;
  /** Whether this model is currently available */
  available: boolean;
  /** Last time we checked availability */
  lastChecked: number;
  /** Rate limit: max requests per minute (0 = unknown) */
  rateLimit: number;
  /** Current failures in a row (for circuit breaking) */
  consecutiveFailures: number;
}

export interface RoutingDecision {
  id: string;
  timestamp: number;
  /** The task that was analyzed */
  taskProfile: TaskProfile;
  /** Which model was selected */
  selectedModelId: string;
  /** Why this model was chosen */
  reason: string;
  /** Score breakdown */
  scores: ModelScore[];
  /** Whether budget constraint affected the choice */
  budgetConstrained: boolean;
  /** Whether this was a fallback selection */
  isFallback: boolean;
  /** User override (if any) */
  userOverride: string | null;
  /** How long the request took (filled after completion) */
  durationMs: number | null;
  /** Whether the request succeeded */
  success: boolean | null;
  /** Actual tokens used (filled after completion) */
  actualInputTokens: number | null;
  actualOutputTokens: number | null;
  /** Actual cost (filled after completion) */
  actualCost: number | null;
}

export interface ModelScore {
  modelId: string;
  totalScore: number;
  /** Breakdown of how the score was computed */
  breakdown: {
    capabilityScore: number;    // 0-1: how well it handles this task category
    costScore: number;          // 0-1: how budget-friendly (inverted cost)
    speedScore: number;         // 0-1: how fast relative to latency needs
    contextScore: number;       // 0-1: can it handle the input size
    reliabilityScore: number;   // 0-1: recent success rate
  };
}

export interface RoutingConfig {
  /** Whether automatic routing is enabled */
  enabled: boolean;
  /** Monthly budget in USD (0 = unlimited) */
  monthlyBudgetUsd: number;
  /** Spent so far this month */
  monthlySpentUsd: number;
  /** Budget month start (day of month) */
  budgetResetDay: number;
  /** Whether to prefer speed over quality for simple tasks */
  preferSpeed: boolean;
  /** Whether to prefer cost savings over quality */
  preferCost: boolean;
  /** Pinned model ID (overrides routing if set) */
  pinnedModelId: string | null;
  /** Maximum cost per single request in USD */
  maxRequestCostUsd: number;
  /** How many routing decisions to retain in history */
  maxDecisionHistory: number;
  /** Fallback model when primary selection fails */
  fallbackModelId: string;
  /**
   * Controls when local models are eligible for automatic routing.
   * - 'disabled':     Local models never chosen by the router (user can still force via settings)
   * - 'background':   Only non-interactive tasks (memory ops, extraction, summarization)
   * - 'conservative': Simple/moderate tasks only (conversation, extraction, basic creative)
   * - 'all':          Local models compete equally for all task types
   * - 'preferred':    Local models get scoring bonus, cloud is gated escape hatch
   * Default: 'preferred' — local-first with cloud as escape hatch
   */
  localModelPolicy: 'disabled' | 'background' | 'conservative' | 'all' | 'preferred';
  /**
   * Minimum capability score (0-1) a local model must have for the task category
   * to be considered. Prevents local models from winning on cost alone.
   * Default: 0.55 — only tasks where the local model is at least moderately capable
   */
  localMinCapability: number;
}

export interface RouterStats {
  totalDecisions: number;
  successfulRoutes: number;
  failedRoutes: number;
  fallbacksUsed: number;
  totalCostUsd: number;
  monthlySpentUsd: number;
  monthlyBudgetUsd: number;
  budgetUtilization: number;
  modelUsage: Array<{ modelId: string; count: number; totalCost: number }>;
  avgLatencyMs: number;
}

// ── Circuit Breaker ──

export interface CircuitBreakerState {
  /** Model identifier */
  modelId: string;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Whether the circuit breaker is currently open (model disabled) */
  isOpen: boolean;
  /** Timestamp of the last failure */
  lastFailureAt: number | null;
  /** Timestamp when the circuit breaker was opened */
  openedAt: number | null;
}

// ── Initialization Options ──

/**
 * Generic interface for a local model provider, replacing the
 * Electron-specific HuggingFaceProvider dependency.
 */
export interface LocalModelProvider {
  /** Check if the local inference endpoint is healthy */
  checkHealth(): Promise<boolean>;
  /** List available models on the local endpoint */
  listModels(): Promise<Array<{ id: string }>>;
  /** Get the number of in-flight (queued) requests */
  getInflightCount?(): number;
}

export interface IntelligenceRouterOptions {
  /**
   * Directory where the router persists its state.
   * Replaces Electron's app.getPath('userData').
   */
  dataDir: string;
  /**
   * Optional callback to retrieve API keys for providers.
   * Return null if the provider has no API key configured.
   */
  getApiKey?: (provider: string) => string | null;
  /**
   * Optional callback to retrieve the user's preferred provider.
   */
  getPreferredProvider?: () => string | null;
  /**
   * Optional local model provider for discovering local models.
   */
  localModelProvider?: LocalModelProvider;
  /**
   * Optional initial routing config overrides.
   */
  config?: Partial<RoutingConfig>;
}
