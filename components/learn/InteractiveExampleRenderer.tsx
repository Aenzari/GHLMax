'use client';

import { useState } from 'react';
import {
  InteractiveExample,
  MergeTagTesterConfig,
  PayloadInspectorConfig,
  FieldComparisonConfig,
} from '@/lib/types/curriculum';

export default function InteractiveExampleRenderer({ example }: { example: InteractiveExample }) {
  switch (example.example_type) {
    case 'merge_tag_tester':
      return <MergeTagTester config={example.config as unknown as MergeTagTesterConfig} />;
    case 'payload_inspector':
      return <PayloadInspector config={example.config as unknown as PayloadInspectorConfig} />;
    case 'field_comparison':
      return <FieldComparison config={example.config as unknown as FieldComparisonConfig} />;
    default:
      return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
          Interactive widget type &quot;{example.example_type}&quot; is not yet implemented in the UI.
        </div>
      );
  }
}

function MergeTagTester({ config }: { config: MergeTagTesterConfig }) {
  const allTags = { ...config.sample_contact_fields, ...config.sample_custom_values };
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const matchedCase = config.test_cases.find((c) => c.tag.includes(selectedTag ?? '__none__'));

  return (
    <div>
      <p className="text-xs text-slate-500">Click a field to see its merge tag and how it renders:</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.keys(allTags).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSelectedTag(key)}
            className={`rounded-md border px-2.5 py-1 text-xs font-mono transition ${
              selectedTag === key
                ? 'border-blue-400 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {selectedTag && (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="font-mono text-xs text-slate-500">
            {`{{ ${selectedTag} }}`} <span className="text-slate-400">renders to</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{allTags[selectedTag]}</p>
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Try These Test Cases
        </h4>
        <div className="mt-2 space-y-2">
          {config.test_cases.map((tc, i) => (
            <div key={i} className="rounded-md border border-slate-200 p-2.5">
              <p className="font-mono text-xs text-slate-700">{tc.tag}</p>
              <p className="mt-0.5 text-xs text-slate-500">→ {tc.renders_to}</p>
              <p className="mt-1 text-xs italic text-slate-400">{tc.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PayloadInspector({ config }: { config: PayloadInspectorConfig }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <pre className="max-h-80 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
        {JSON.stringify(config.sample_payload, null, 2)}
      </pre>

      <div>
        <p className="text-xs text-slate-500">Click a field key below to see why it matters:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.keys(config.annotations).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={`rounded-md border px-2.5 py-1 text-xs font-mono ${
                activeKey === key
                  ? 'border-blue-400 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {key}
            </button>
          ))}
        </div>
        {activeKey && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            {config.annotations[activeKey]}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldComparison({ config }: { config: FieldComparisonConfig }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{config.scenario}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Custom Field: {config.custom_field_result.field_key}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>Structure copied: {config.custom_field_result.structure_copied ? '✓' : '✗'}</li>
            <li>Data copied: {config.custom_field_result.data_copied ? '✓' : '✗'}</li>
          </ul>
          <p className="mt-2 text-xs italic text-slate-500">{config.custom_field_result.note}</p>
        </div>
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Custom Value: {config.custom_value_result.value_key}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>Structure copied: {config.custom_value_result.structure_copied ? '✓' : '✗'}</li>
            <li>Data copied: {config.custom_value_result.data_copied ? '✓' : '✗'}</li>
          </ul>
          <p className="mt-2 text-xs italic text-slate-500">{config.custom_value_result.note}</p>
        </div>
      </div>
    </div>
  );
}
