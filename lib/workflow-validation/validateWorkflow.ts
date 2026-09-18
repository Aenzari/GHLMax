import { Edge, Node } from '@xyflow/react';

export type WorkflowNodeType = 'trigger' | 'filter' | 'wait' | 'ifelse' | 'action' | 'webhook';

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  /** Wait-specific: duration in minutes. Undefined/0 with waitType 'until' = unbounded risk. */
  waitDurationMinutes?: number;
  waitType?: 'delay' | 'until_condition' | 'until_datetime';
  /** Action-specific: does this send an SMS/email (subject to quiet-hours + re-entry rules)? */
  sendsMessage?: boolean;
  /** Trigger-specific: does re-entry allow duplicate threads? */
  reEntryAllowed?: boolean;
  /** Filter-specific: what field/condition is being checked, for reporting only. */
  condition?: string;
}

export type WorkflowNode = Node<WorkflowNodeData>;

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  nodeId?: string;
  severity: ValidationSeverity;
  rule: string;
  message: string;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  isSafeToPublish: boolean; // true only if errorCount === 0
}

function findIncoming(edges: Edge[], nodeId: string): string[] {
  return edges.filter((e) => e.target === nodeId).map((e) => e.source);
}

function findOutgoing(edges: Edge[], nodeId: string): string[] {
  return edges.filter((e) => e.source === nodeId).map((e) => e.target);
}

/**
 * Runs the full rule set against a workflow graph and returns a structured report.
 * Rules mirror the real-world production edge cases documented in the GHL curriculum:
 * unbounded waits, missing quiet-hour/timezone guards on outbound messages, re-entry
 * collisions on time-based sequences, and orphaned/disconnected nodes.
 */
export function validateWorkflow(nodes: WorkflowNode[], edges: Edge[]): ValidationReport {
  const issues: ValidationIssue[] = [];
  const push = (issue: Omit<ValidationIssue, 'id'>) =>
    issues.push({ ...issue, id: `${issue.rule}-${issue.nodeId ?? 'graph'}-${issues.length}` });

  if (nodes.length === 0) {
    push({
      severity: 'info',
      rule: 'empty_canvas',
      message: 'Canvas is empty — add a Trigger node to begin.',
    });
    return { issues, errorCount: 0, warningCount: 0, isSafeToPublish: false };
  }

  const triggers = nodes.filter((n) => n.type === 'trigger');
  const waits = nodes.filter((n) => n.type === 'wait');
  const actions = nodes.filter((n) => n.type === 'action' || n.type === 'webhook');
  const filters = nodes.filter((n) => n.type === 'filter');

  // RULE 1: Must have exactly one entry trigger (multiple triggers = OR logic, which is
  // valid in GHL, but zero triggers means the workflow can never execute).
  if (triggers.length === 0) {
    push({
      severity: 'error',
      rule: 'missing_trigger',
      message: 'No Trigger node found. Every workflow must start with at least one Trigger.',
    });
  }

  // RULE 2: Unbounded Wait step — "wait until condition" with no fallback/timeout path
  // and no Goal to escape it. This is the #1 cause of ghost-stuck contacts in production.
  for (const wait of waits) {
    const isConditionWait = wait.data.waitType === 'until_condition';
    const outgoing = findOutgoing(edges, wait.id);

    if (isConditionWait && outgoing.length <= 1) {
      push({
        nodeId: wait.id,
        severity: 'error',
        rule: 'unbounded_wait',
        message: `Wait node "${wait.data.label}" waits for a condition with no timeout/fallback branch. If the condition never fires, contacts are stuck here indefinitely, silently consuming an execution slot.`,
      });
    }

    if (wait.data.waitType === 'delay' && (!wait.data.waitDurationMinutes || wait.data.waitDurationMinutes <= 0)) {
      push({
        nodeId: wait.id,
        severity: 'error',
        rule: 'invalid_wait_duration',
        message: `Wait node "${wait.data.label}" has no valid duration configured.`,
      });
    }
  }

  // RULE 3: Outbound message actions downstream of a Wait "until datetime" should have
  // a quiet-hours/timezone guard upstream (a Filter checking business hours or contact
  // timezone). We approximate this by checking whether ANY filter node with a condition
  // mentioning hours/timezone exists anywhere upstream of the action.
  const hasTimezoneGuard = filters.some((f) =>
    /hour|timezone|time zone|quiet/i.test(f.data.condition ?? '')
  );

  for (const action of actions) {
    if (action.data.sendsMessage) {
      const upstream = findIncoming(edges, action.id);
      const hasWaitUpstream = upstream.some((id) =>
        waits.some((w) => w.id === id && w.data.waitType === 'until_datetime')
      );

      if (hasWaitUpstream && !hasTimezoneGuard) {
        push({
          nodeId: action.id,
          severity: 'warning',
          rule: 'missing_quiet_hours_check',
          message: `Action "${action.data.label}" sends a message after a date/time Wait step, but no Filter checking business hours or contact timezone was found on the canvas. "Wait Until" resolves against the sub-account's default timezone unless explicitly guarded — this risks off-hours sends.`,
        });
      }
    }
  }

  // RULE 4: Re-entry allowed + Wait step present = race condition / duplicate-thread risk.
  for (const trigger of triggers) {
    if (trigger.data.reEntryAllowed && waits.length > 0) {
      push({
        nodeId: trigger.id,
        severity: 'warning',
        rule: 're_entry_race_condition',
        message: `Trigger "${trigger.data.label}" allows re-entry and this workflow contains Wait steps. A contact re-triggering mid-wait will spawn a second parallel thread, risking duplicate/overlapping messages.`,
      });
    }
  }

  // RULE 5: Orphaned nodes — not reachable from any trigger.
  const reachable = new Set<string>();
  const queue = [...triggers.map((t) => t.id)];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    queue.push(...findOutgoing(edges, current));
  }
  for (const node of nodes) {
    if (node.type !== 'trigger' && !reachable.has(node.id)) {
      push({
        nodeId: node.id,
        severity: 'warning',
        rule: 'orphaned_node',
        message: `Node "${node.data.label}" is not reachable from any Trigger and will never execute.`,
      });
    }
  }

  // RULE 6: Filter with no outgoing "fail" path — silently drops contacts with no record.
  // Heuristic: a filter node should have >= 1 outgoing edge; if it has exactly 1, warn that
  // there is no explicit handling for contacts who fail the condition.
  for (const filter of filters) {
    const outgoing = findOutgoing(edges, filter.id);
    if (outgoing.length === 1) {
      push({
        nodeId: filter.id,
        severity: 'info',
        rule: 'filter_no_fail_branch',
        message: `Filter "${filter.data.label}" has only one outgoing path. Confirm contacts who fail this condition are intentionally meant to simply exit, rather than needing an explicit fail-branch (e.g. "outside service area" auto-reply).`,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    issues,
    errorCount,
    warningCount,
    isSafeToPublish: errorCount === 0,
  };
}
