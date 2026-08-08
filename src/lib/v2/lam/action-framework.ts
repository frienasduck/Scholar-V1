/**
 * LAM/FICA action framework (pure, unit-testable).
 *
 * The model's output is always an untrusted PROPOSAL. Nothing executes
 * because "the AI generated it". Pipeline:
 *   model proposes structured action
 *   → allowlist + schema validation
 *   → ownership check (profile scoped)
 *   → entitlement check
 *   → risk classification + confirmation policy
 *   → execution (audited, idempotent where possible)
 *
 * Custom commands map to approved action templates only — they can never
 * execute arbitrary JavaScript or shell code.
 */

export type LamActionType =
  | "create_reminder"
  | "change_reminder"
  | "create_study_plan"
  | "start_focus_session"
  | "open_chapter"
  | "generate_quiz"
  | "prepare_revision_sequence"
  | "summarize_file"
  | "schedule_homework"
  | "organize_study_day"
  | "create_recurring_routine"
  | "prepare_nigtube_playlist"
  | "prepare_study_music_focus";

export const LAM_ACTION_TYPES: LamActionType[] = [
  "create_reminder", "change_reminder", "create_study_plan", "start_focus_session",
  "open_chapter", "generate_quiz", "prepare_revision_sequence", "summarize_file",
  "schedule_homework", "organize_study_day", "create_recurring_routine",
  "prepare_nigtube_playlist", "prepare_study_music_focus",
];

export type LamRiskLevel = "low" | "medium" | "high";

export interface LamActionDefinition {
  type: LamActionType;
  risk: LamRiskLevel;
  /** HIGH-risk actions ALWAYS require explicit confirmation. */
  confirmationRequired: boolean;
  description: string;
}

export const LAM_ACTION_REGISTRY: Record<LamActionType, LamActionDefinition> = {
  open_chapter: { type: "open_chapter", risk: "low", confirmationRequired: false, description: "Open a chapter or view" },
  create_reminder: { type: "create_reminder", risk: "medium", confirmationRequired: false, description: "Create a reminder" },
  change_reminder: { type: "change_reminder", risk: "medium", confirmationRequired: false, description: "Modify an existing reminder" },
  create_study_plan: { type: "create_study_plan", risk: "medium", confirmationRequired: false, description: "Create a study plan" },
  start_focus_session: { type: "start_focus_session", risk: "medium", confirmationRequired: false, description: "Start a focus session" },
  generate_quiz: { type: "generate_quiz", risk: "medium", confirmationRequired: false, description: "Generate a quiz (consumes quota)" },
  prepare_revision_sequence: { type: "prepare_revision_sequence", risk: "medium", confirmationRequired: false, description: "Prepare a revision sequence" },
  summarize_file: { type: "summarize_file", risk: "medium", confirmationRequired: false, description: "Summarize an approved file" },
  schedule_homework: { type: "schedule_homework", risk: "medium", confirmationRequired: false, description: "Schedule homework" },
  organize_study_day: { type: "organize_study_day", risk: "medium", confirmationRequired: false, description: "Organize the study day" },
  create_recurring_routine: { type: "create_recurring_routine", risk: "medium", confirmationRequired: false, description: "Create a recurring routine" },
  prepare_nigtube_playlist: { type: "prepare_nigtube_playlist", risk: "medium", confirmationRequired: false, description: "Prepare a Nigtube playlist" },
  prepare_study_music_focus: { type: "prepare_study_music_focus", risk: "medium", confirmationRequired: false, description: "Prepare a Study Music focus session" },
};

export function classifyActionRisk(type: LamActionType): LamRiskLevel {
  return LAM_ACTION_REGISTRY[type]?.risk ?? "high"; // unknown types fail safe
}

export type AutonomyLevel = "manual" | "suggest" | "ask_before_acting" | "trusted_routine";

export const DEFAULT_AUTONOMY_LEVEL: AutonomyLevel = "ask_before_acting";

/** Financial operations are never autonomously completed by an agent. */
export const NEVER_AUTONOMOUS_ACTION_TYPES: readonly string[] = ["purchase", "subscribe", "payment", "refund"];

/** Confirmation policy: financial ops + high-risk always; medium under ask/manual levels. */
export function requiresConfirmation(type: LamActionType, autonomy: AutonomyLevel = DEFAULT_AUTONOMY_LEVEL): boolean {
  if (NEVER_AUTONOMOUS_ACTION_TYPES.includes(type)) return true;
  const definition = LAM_ACTION_REGISTRY[type];
  if (!definition) return true;
  if (definition.risk === "high") return true;
  if (definition.confirmationRequired) return true;
  if (autonomy === "manual" || autonomy === "ask_before_acting") return definition.risk === "medium";
  return false;
}

export interface LamActionRequest<P = Record<string, unknown>> {
  id: string;
  type: LamActionType;
  parameters: P;
  initiatedBy: "user" | "lam" | "scheduled_automation";
  conversationId?: string;
  idempotencyKey: string;
}

/** Allowlist + structural validation of a proposed action. */
export function validateLamAction(input: unknown): { ok: true; request: LamActionRequest } | { ok: false; error: string } {
  if (typeof input !== "object" || input === null) return { ok: false, error: "Action must be an object." };
  const candidate = input as Partial<LamActionRequest>;
  if (typeof candidate.id !== "string" || !candidate.id) return { ok: false, error: "Missing action id." };
  if (typeof candidate.type !== "string" || !(candidate.type in LAM_ACTION_REGISTRY)) {
    return { ok: false, error: "Action type is not allowlisted." };
  }
  if (typeof candidate.parameters !== "object" || candidate.parameters === null || Array.isArray(candidate.parameters)) {
    return { ok: false, error: "Action parameters must be a structured object." };
  }
  if (!["user", "lam", "scheduled_automation"].includes(candidate.initiatedBy ?? "")) {
    return { ok: false, error: "Invalid initiation source." };
  }
  if (typeof candidate.idempotencyKey !== "string" || !candidate.idempotencyKey) {
    return { ok: false, error: "Missing idempotency key." };
  }
  return {
    ok: true,
    request: candidate as LamActionRequest,
  };
}

// ============================================================================
// Agent budgets — stop safely when a run exceeds its limits.
// ============================================================================

export interface AgentUsage {
  actionsExecuted: number;
  aiCalls: number;
  durationMs: number;
  generatedArtifacts: number;
  retries: number;
}

export interface AgentBudget {
  maxActionsPerRun: number;
  maxAiCalls: number;
  maxDurationMs: number;
  maxGeneratedArtifacts: number;
  maxRetries: number;
}

export const DEFAULT_AGENT_BUDGET: AgentBudget = {
  maxActionsPerRun: 8,
  maxAiCalls: 20,
  maxDurationMs: 10 * 60_000,
  maxGeneratedArtifacts: 5,
  maxRetries: 3,
};

export function checkAgentBudget(used: Partial<AgentUsage>, budget: AgentBudget = DEFAULT_AGENT_BUDGET): { ok: boolean; reason?: string } {
  const usage: AgentUsage = {
    actionsExecuted: used.actionsExecuted ?? 0,
    aiCalls: used.aiCalls ?? 0,
    durationMs: used.durationMs ?? 0,
    generatedArtifacts: used.generatedArtifacts ?? 0,
    retries: used.retries ?? 0,
  };
  if (usage.actionsExecuted >= budget.maxActionsPerRun) return { ok: false, reason: "agent_budget_actions" };
  if (usage.aiCalls >= budget.maxAiCalls) return { ok: false, reason: "agent_budget_ai_calls" };
  if (usage.durationMs >= budget.maxDurationMs) return { ok: false, reason: "agent_budget_duration" };
  if (usage.generatedArtifacts >= budget.maxGeneratedArtifacts) return { ok: false, reason: "agent_budget_artifacts" };
  if (usage.retries > budget.maxRetries) return { ok: false, reason: "agent_budget_retries" };
  return { ok: true };
}
