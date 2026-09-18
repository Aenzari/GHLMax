'use client';

import { useState } from 'react';
import { Edge } from '@xyflow/react';
import { WorkflowNode } from '@/lib/workflow-validation/validateWorkflow';
import {
  MockTriggerType,
  MOCK_TRIGGER_PRESETS,
  SimulationStep,
  getEntryNodes,
  getAdvanceOptions,
  startSimulation,
  buildStepForNode,
} from '@/lib/workflow-simulation/simulateWorkflow';

interface Props {
  nodes: WorkflowNode[];
  edges: Edge[];
  onActiveNodeChange: (nodeId: string | null) => void;
}

type FlightState =
  | { status: 'setup' }
  | { status: 'no_entry_points' }
  | { status: 'running'; steps: SimulationStep[]; currentNode: WorkflowNode }
  | { status: 'awaiting_branch_choice'; steps: SimulationStep[]; currentNode: WorkflowNode }
  | { status: 'paused_wait'; steps: SimulationStep[]; currentNode: WorkflowNode }
  | { status: 'finished'; steps: SimulationStep[] };

export default function TestFlightPanel({ nodes, edges, onActiveNodeChange }: Props) {
  const [triggerType, setTriggerType] = useState<MockTriggerType>('form_submitted');
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(MOCK_TRIGGER_PRESETS.form_submitted.data, null, 2)
  );
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [flight, setFlight] = useState<FlightState>({ status: 'setup' });

  function handleTriggerTypeChange(type: MockTriggerType) {
    setTriggerType(type);
    setPayloadText(JSON.stringify(MOCK_TRIGGER_PRESETS[type].data, null, 2));
    setPayloadError(null);
  }

  function handleStart() {
    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadText);
    } catch {
      setPayloadError('Payload is not valid JSON — fix it before launching.');
      return;
    }
    setPayloadError(null);

    const entryNodes = getEntryNodes(nodes, edges);
    if (entryNodes.length === 0) {
      setFlight({ status: 'no_entry_points' });
      return;
    }

    // If multiple trigger nodes exist (OR logic), fire the first one for this test flight.
    const triggerNode = entryNodes[0];
    const firstStep = startSimulation(triggerNode, { triggerType, data: parsedPayload });

    onActiveNodeChange(triggerNode.id);
    advanceFrom(triggerNode, [firstStep]);
  }

  function advanceFrom(node: WorkflowNode, stepsSoFar: SimulationStep[]) {
    const { requiresChoice, options } = getAdvanceOptions(node, nodes, edges);

    if (options.length === 0) {
      setFlight({ status: 'finished', steps: stepsSoFar });
      onActiveNodeChange(null);
      return;
    }

    if (requiresChoice) {
      setFlight({ status: 'awaiting_branch_choice', steps: stepsSoFar, currentNode: node });
      return;
    }

    // Single unambiguous path — advance automatically to keep the flow moving.
    const next = options[0].targetNode;
    const lastPayload = stepsSoFar[stepsSoFar.length - 1].payloadSnapshot;
    const nextStep = buildStepForNode(stepsSoFar.length, next, lastPayload);
    const newSteps = [...stepsSoFar, nextStep];

    onActiveNodeChange(next.id);

    if (next.type === 'wait') {
      setFlight({ status: 'paused_wait', steps: newSteps, currentNode: next });
    } else {
      setFlight({ status: 'running', steps: newSteps, currentNode: next });
    }
  }

  function handleChooseBranch(targetNode: WorkflowNode, steps: SimulationStep[]) {
    const lastPayload = steps[steps.length - 1].payloadSnapshot;
    const nextStep = buildStepForNode(steps.length, targetNode, lastPayload);
    const newSteps = [...steps, nextStep];
    onActiveNodeChange(targetNode.id);

    if (targetNode.type === 'wait') {
      setFlight({ status: 'paused_wait', steps: newSteps, currentNode: targetNode });
    } else {
      setFlight({ status: 'running', steps: newSteps, currentNode: targetNode });
    }
  }

  function handleSkipWait() {
    if (flight.status !== 'paused_wait') return;
    advanceFrom(flight.currentNode, flight.steps);
  }

  function handleContinue() {
    if (flight.status !== 'running') return;
    advanceFrom(flight.currentNode, flight.steps);
  }

  function handleReset() {
    setFlight({ status: 'setup' });
    onActiveNodeChange(null);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <h2 className="text-sm font-semibold text-slate-800">Test Flight Mode</h2>
      <p className="mt-1 text-xs text-slate-500">
        Fire a mock trigger and watch the contact&apos;s path through the workflow, one node at a
        time.
      </p>

      {flight.status === 'setup' && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600">Mock Trigger</label>
            <div className="mt-1 flex gap-2">
              {(['form_submitted', 'tag_added'] as MockTriggerType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTriggerTypeChange(t)}
                  className={`rounded-md border px-2.5 py-1 text-xs ${
                    triggerType === t
                      ? 'border-blue-400 bg-blue-50 text-blue-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  {t === 'form_submitted' ? 'Form Submitted' : 'Tag Added'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Mock Payload (editable JSON)</label>
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className="mt-1 h-40 w-full resize-none rounded-md border border-slate-200 p-2 font-mono text-xs focus:border-blue-400 focus:outline-none"
            />
            {payloadError && <p className="mt-1 text-xs text-red-600">{payloadError}</p>}
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="w-full rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            🚀 Launch Test Flight
          </button>
        </div>
      )}

      {flight.status === 'no_entry_points' && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          No Trigger node found on the canvas. Add a Trigger node before running a Test Flight.
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 block text-xs font-medium underline"
          >
            Back to setup
          </button>
        </div>
      )}

      {(flight.status === 'running' ||
        flight.status === 'awaiting_branch_choice' ||
        flight.status === 'paused_wait' ||
        flight.status === 'finished') && (
        <div className="mt-4 flex flex-1 flex-col">
          {/* Live payload viewer */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current Payload
            </h3>
            <pre className="mt-1 max-h-32 overflow-auto rounded-md bg-slate-900 p-2 text-[11px] text-slate-100">
              {JSON.stringify(flight.steps[flight.steps.length - 1].payloadSnapshot, null, 2)}
            </pre>
          </div>

          {/* Branch choice UI */}
          {flight.status === 'awaiting_branch_choice' && (
            <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3">
              <p className="text-xs font-semibold text-purple-800">
                Branch point reached at &quot;{flight.currentNode.data.label}&quot;
              </p>
              <p className="mt-1 text-[11px] text-purple-700">
                Conditions here are descriptive labels, not executable logic — you decide which
                path this mock contact takes based on what the payload above would realistically
                satisfy.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {getAdvanceOptions(flight.currentNode, nodes, edges).options.map(
                  ({ edge, targetNode }) => (
                    <button
                      key={edge.id}
                      type="button"
                      onClick={() => handleChooseBranch(targetNode, flight.steps)}
                      className="rounded-md border border-purple-300 bg-white px-3 py-1.5 text-left text-xs text-purple-900 hover:bg-purple-100"
                    >
                      → {targetNode.data.label}
                      {edge.label ? ` (${edge.label})` : ''}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Wait pause UI */}
          {flight.status === 'paused_wait' && (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-800">
                Paused at &quot;{flight.currentNode.data.label}&quot;
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                {flight.currentNode.data.waitType === 'until_condition'
                  ? 'This is exactly the ghost-deadlock risk flagged in the Validation Report — in production, if the condition never fires, the contact never leaves this step.'
                  : 'In production, this contact waits here for real time to pass.'}
              </p>
              <button
                type="button"
                onClick={handleSkipWait}
                className="mt-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
              >
                ⏩ Simulate time passing
              </button>
            </div>
          )}

          {/* Continue button for straight-line running state */}
          {flight.status === 'running' && (
            <button
              type="button"
              onClick={handleContinue}
              className="mt-3 rounded-md bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Continue →
            </button>
          )}

          {flight.status === 'finished' && (
            <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              ✓ Thread finished — no more outgoing paths from the last node.
            </div>
          )}

          {/* Step history */}
          <div className="mt-4 flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Step History
            </h3>
            <ol className="mt-2 space-y-2">
              {flight.steps.map((step) => (
                <li key={step.order} className="rounded-md border border-slate-200 p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{step.nodeLabel}</span>
                    <span className="text-[10px] uppercase text-slate-400">{step.nodeType}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{step.note}</p>
                </li>
              ))}
            </ol>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-4 rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Reset Test Flight
          </button>
        </div>
      )}
    </div>
  );
}
