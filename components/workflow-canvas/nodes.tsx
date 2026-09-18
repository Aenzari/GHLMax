'use client';

import { Handle, Position, NodeProps } from '@xyflow/react';
import { WorkflowNodeData } from '@/lib/workflow-validation/validateWorkflow';

const BASE_CLASSES =
  'rounded-lg border-2 px-4 py-2.5 text-sm font-medium shadow-sm min-w-[160px] text-center';

const STYLE_BY_TYPE: Record<string, string> = {
  trigger: 'border-emerald-400 bg-emerald-50 text-emerald-900',
  filter: 'border-blue-400 bg-blue-50 text-blue-900',
  wait: 'border-amber-400 bg-amber-50 text-amber-900',
  ifelse: 'border-purple-400 bg-purple-50 text-purple-900',
  action: 'border-slate-400 bg-slate-50 text-slate-900',
  webhook: 'border-pink-400 bg-pink-50 text-pink-900',
};

function GenericNode({ data, type }: NodeProps) {
  const nodeData = data as WorkflowNodeData & { isActive?: boolean };
  const style = STYLE_BY_TYPE[type ?? ''] ?? 'border-slate-300 bg-white text-slate-800';
  const activeRing = nodeData.isActive ? 'ring-4 ring-offset-2 ring-emerald-400 scale-105' : '';

  return (
    <div className={`${BASE_CLASSES} ${style} ${activeRing} transition-all duration-300`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <div className="text-[10px] uppercase tracking-wide opacity-60">{type}</div>
      <div>{nodeData.label}</div>
      {nodeData.condition && (
        <div className="mt-1 text-[10px] italic opacity-70">{nodeData.condition}</div>
      )}
      {nodeData.waitType === 'delay' && nodeData.waitDurationMinutes ? (
        <div className="mt-1 text-[10px] opacity-70">{nodeData.waitDurationMinutes} min</div>
      ) : null}
      {nodeData.waitType === 'until_condition' && (
        <div className="mt-1 text-[10px] opacity-70">until condition met</div>
      )}
      {nodeData.waitType === 'until_datetime' && (
        <div className="mt-1 text-[10px] opacity-70">until date/time</div>
      )}
      {nodeData.isActive && (
        <div className="mt-1 text-[10px] font-bold text-emerald-700">● ACTIVE</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
}

export const nodeTypes = {
  trigger: GenericNode,
  filter: GenericNode,
  wait: GenericNode,
  ifelse: GenericNode,
  action: GenericNode,
  webhook: GenericNode,
};
