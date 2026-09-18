import { Edge } from '@xyflow/react';
import { WorkflowNode } from '@/lib/workflow-validation/validateWorkflow';

export type MockTriggerType = 'form_submitted' | 'tag_added';

export interface MockTriggerPayload {
  triggerType: MockTriggerType;
  data: Record<string, unknown>;
}

export const MOCK_TRIGGER_PRESETS: Record<MockTriggerType, MockTriggerPayload> = {
  form_submitted: {
    triggerType: 'form_submitted',
    data: {
      contact_id: 'cont_8841',
      first_name: 'Jamie',
      email: 'jamie.rivera@example.com',
      phone: '+15125550142',
      service_zip: '78701',
      urgency_level: 'standard',
      source: 'Landing Page Form',
    },
  },
  tag_added: {
    triggerType: 'tag_added',
    data: {
      contact_id: 'cont_9200',
      tag_added: 'hot-lead',
      first_name: 'Morgan',
      email: 'morgan@example.com',
    },
  },
};

export type StepKind = 'entered' | 'paused_wait' | 'branch_choice_needed' | 'completed' | 'dead_end';

export interface SimulationStep {
  order: number;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  kind: StepKind;
  note: string;
  payloadSnapshot: Record<string, unknown>;
}

/** All nodes with no incoming edges are valid entry points (mirrors GHL's OR-logic multi-trigger behavior). */
export function getEntryNodes(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  const targets = new Set(edges.map((e) => e.target));
  return nodes.filter((n) => n.type === 'trigger' && !targets.has(n.id));
}

export function getOutgoingEdges(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter((e) => e.source === nodeId);
}

/**
 * Builds the initial step when a mock trigger fires. Does not advance further —
 * the caller (TestFlightPanel) drives step-by-step advancement so the learner
 * can watch each node light up individually rather than seeing the whole path
 * resolve instantly.
 */
export function startSimulation(
  triggerNode: WorkflowNode,
  mockPayload: MockTriggerPayload
): SimulationStep {
  return {
    order: 0,
    nodeId: triggerNode.id,
    nodeLabel: triggerNode.data.label,
    nodeType: triggerNode.type ?? 'trigger',
    kind: 'entered',
    note: `Trigger fired: ${mockPayload.triggerType}. Contact enters the workflow.`,
    payloadSnapshot: mockPayload.data,
  };
}

/**
 * Determines what happens when advancing from a given node.
 * - 0 outgoing edges: dead end (workflow finished for this thread).
 * - 1 outgoing edge: auto-advance, no ambiguity.
 * - 2+ outgoing edges (filter/if-else branch points): we cannot know which
 *   branch the contact would actually take, because conditions in this canvas
 *   are free-text labels, not executable expressions. The caller must ask the
 *   learner to pick a branch — this is intentional, not a missing feature: it
 *   turns the ambiguity into a teaching moment about what the condition means.
 */
export function getAdvanceOptions(
  currentNode: WorkflowNode,
  nodes: WorkflowNode[],
  edges: Edge[]
): { requiresChoice: boolean; options: { edge: Edge; targetNode: WorkflowNode }[] } {
  const outgoing = getOutgoingEdges(edges, currentNode.id);

  const options = outgoing
    .map((edge) => {
      const targetNode = nodes.find((n) => n.id === edge.target);
      return targetNode ? { edge, targetNode } : null;
    })
    .filter((o): o is { edge: Edge; targetNode: WorkflowNode } => o !== null);

  const isBranchPoint = currentNode.type === 'filter' || currentNode.type === 'ifelse';

  return {
    requiresChoice: isBranchPoint && options.length > 1,
    options,
  };
}

export function buildStepForNode(
  order: number,
  node: WorkflowNode,
  payloadSnapshot: Record<string, unknown>
): SimulationStep {
  if (node.type === 'wait') {
    return {
      order,
      nodeId: node.id,
      nodeLabel: node.data.label,
      nodeType: node.type,
      kind: 'paused_wait',
      note:
        node.data.waitType === 'until_condition'
          ? `Paused: waiting for a condition to be met. In production, this contact sits here until the condition fires (or forever, if it never does).`
          : `Paused: waiting ${node.data.waitDurationMinutes ?? '?'} minute(s) before continuing.`,
      payloadSnapshot,
    };
  }

  return {
    order,
    nodeId: node.id,
    nodeLabel: node.data.label,
    nodeType: node.type ?? 'action',
    kind: 'entered',
    note: describeNodeEntry(node),
    payloadSnapshot,
  };
}

function describeNodeEntry(node: WorkflowNode): string {
  switch (node.type) {
    case 'filter':
      return `Filter checked: "${node.data.condition ?? node.data.label}".`;
    case 'ifelse':
      return `Branch evaluated: "${node.data.label}".`;
    case 'action':
      return node.data.sendsMessage
        ? `Action fired: ${node.data.label} (outbound message sent).`
        : `Action fired: ${node.data.label}.`;
    case 'webhook':
      return `Webhook fired: ${node.data.label} (outbound HTTP request sent).`;
    default:
      return `Entered: ${node.data.label}.`;
  }
}
