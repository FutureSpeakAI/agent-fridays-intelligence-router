/**
 * Agent Friday's Intelligence Router
 *
 * Multi-dimensional LLM routing with circuit breakers, budget enforcement,
 * and local-first policies.
 *
 * @packageDocumentation
 */

// Re-export all types
export type {
  TaskCategory,
  TaskComplexity,
  LatencyTier,
  ProviderName,
  TaskProfile,
  ModelCapability,
  RoutingDecision,
  ModelScore,
  RoutingConfig,
  CircuitBreakerState,
  RouterStats,
  LocalModelProvider,
  IntelligenceRouterOptions,
} from './types';

// Re-export the router class and pure functions
export {
  IntelligenceRouter,
  classifyTask,
  scoreModel,
  estimateRequestCost,
  buildRoutingExplanation,
} from './intelligence-router';
