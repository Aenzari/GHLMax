'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import TestFlightPanel from './TestFlightPanel';
import {
  validateWorkflow,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
  ValidationIssue,
} from '@/lib/workflow-validation/validateWorkflow';

let idCounter = 0;
const nextId = () => `node-${++idCounter}-${Date.now()}`;

const PALETTE: { type: WorkflowNodeType; label: string; defaultData: WorkflowNodeData }[] = [
  { type: 'trigger', label: '+ Trigger', defaultData: { label: 'Form Submitted', reEntryAllowed: false } },
  { type: 'filter', label: '+ Filter', defaultData: { label: 'Zip in Service Area', condition: 'service_zip IN approved_list' } },
  { type: 'wait', label: '+ Wait', defaultData: { label: 'Wait 3 Days', waitType: 'delay', waitDurationMinutes: 4320 } },
  { type: 'ifelse', label: '+ If/Else', defaultData: { label: 'Urgency = Emergency?' } },
  { type: 'action', label: '+ Action', defaultData: { label: 'Send SMS', sendsMessage: true } },
  { type: 'webhook', label: '+ Webhook', defaultData: { label: 'POST to Make.com', sendsMessage: false } },
];

const INITIAL_NODES: WorkflowNode[] = [
  {
    id: 'start',
    type: 'trigger',
    position: { x: 250, y: 20 },
    data: { label: 'Form Submitted', reEntryAllowed: false },
  },
];

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

const SEVERITY_BADGE: Record<string, string> = {
  error: 'bg-red-100 text-red-700 border-red-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-slate-100 text-slate-600 border-slate-200',
};

function CanvasInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowNode>(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<'validation' | 'test_flight'>('validation');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const addNode = useCallback(
    (type: WorkflowNodeType, defaultData: WorkflowNodeData) => {
      const id = nextId();
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position: { x: 100 + Math.random() * 300, y: 100 + nds.length * 90 },
          data: { ...defaultData },
        },
      ]);
    },
    [setNodes]
  );

  const report = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);

  const sortedIssues = useMemo(
    () => [...report.issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    [report.issues]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Derived, non-persisted view of nodes carrying the isActive flag for Test
  // Flight highlighting. We never write isActive into the real `nodes` state —
  // that would pollute the graph data that gets saved/exported.
  const displayNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, isActive: n.id === activeNodeId },
      })),
    [nodes, activeNodeId]
  );

  function handleModeChange(mode: 'validation' | 'test_flight') {
    setPanelMode(mode);
    setActiveNodeId(null); // leaving/entering test flight always resets the highlight
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        {PALETTE.map((p) => (
          <button
            key={p.type}
            type="button"
            onClick={() => addNode(p.type, p.defaultData)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {p.label}
          </button>
        ))}

        <div className="ml-2 flex items-center gap-1 rounded-md border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => handleModeChange('validation')}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              panelMode === 'validation' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Validation
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('test_flight')}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              panelMode === 'test_flight' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            🚀 Test Flight
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-3 py-1 font-semibold ${
              report.isSafeToPublish
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {report.isSafeToPublish ? '✓ Safe to publish' : `✗ ${report.errorCount} blocking error(s)`}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>

        {/* Right panel: swaps between Validation report and Test Flight */}
        <aside className="w-96 shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
          {panelMode === 'test_flight' ? (
            <TestFlightPanel nodes={nodes} edges={edges} onActiveNodeChange={setActiveNodeId} />
          ) : (
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-800">Validation Report</h2>

              {sortedIssues.length === 0 && (
                <p className="mt-3 text-sm text-slate-400">No issues detected. Build out the workflow.</p>
              )}

              <ul className="mt-3 space-y-2">
                {sortedIssues.map((issue: ValidationIssue) => (
                  <li
                    key={issue.id}
                    className={`cursor-pointer rounded-md border p-3 text-xs ${SEVERITY_BADGE[issue.severity]}`}
                    onClick={() => issue.nodeId && setSelectedNodeId(issue.nodeId)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold uppercase tracking-wide">{issue.severity}</span>
                      <span className="opacity-60">{issue.rule}</span>
                    </div>
                    <p className="mt-1 leading-relaxed">{issue.message}</p>
                  </li>
                ))}
              </ul>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-800">Selected Node</h3>
                {!selectedNode && (
                  <p className="mt-2 text-xs text-slate-400">Click a node on the canvas to inspect it.</p>
                )}
                {selectedNode && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-900 p-3 text-[11px] text-slate-100">
                    {JSON.stringify(selectedNode.data, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
