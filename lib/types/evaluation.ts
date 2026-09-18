export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type ChallengeDomain =
  | 'relational_schema'
  | 'trigger_logic'
  | 'threading_timing'
  | 'telephony_dns'
  | 'webhooks_api';

export interface Challenge {
  id: string;
  module_id: string;
  title: string;
  severity: Severity;
  domain: ChallengeDomain;
  broken_scenario: string;
  reproduction_logs: Record<string, unknown> | null;
  expected_solution: string;
  hint: string | null;
}

/** Strict JSON contract the AI model MUST return. Enforced via prompt + runtime validation. */
export interface AiEvaluationResult {
  score: number; // 1-10
  passed: boolean; // score >= 7 by convention
  root_cause_identified: boolean;
  critique: string; // 2-5 sentences, specific to the user's answer
  missed_considerations: string[]; // things the expected_solution covers that the user missed
  strengths: string[]; // what the user got right
}

export interface EvaluateRequestBody {
  challengeId: string;
  userSolution: string;
  userId?: string; // optional — anonymous practice allowed, submission just won't persist
}
