export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export type ExampleType =
  | 'merge_tag_tester'
  | 'payload_inspector'
  | 'logic_tree'
  | 'field_comparison'
  | 'quiz_prompt';

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  week_number: number;
  day_range: string;
  day_start: number;
  day_end: number;
  reading_time_minutes: number;
  learning_objectives: string[];
  content_markdown: string;
  prerequisite_slugs: string[];
  sort_order: number;
}

export interface InteractiveExample {
  id: string;
  lesson_id: string;
  example_type: ExampleType;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  sort_order: number;
}

export interface LessonProgress {
  lesson_id: string;
  status: LessonStatus;
  last_viewed_at: string | null;
  completed_at: string | null;
}

/** Config shape for the 'merge_tag_tester' example type. */
export interface MergeTagTesterConfig {
  sample_contact_fields: Record<string, string>;
  sample_custom_values: Record<string, string>;
  test_cases: { tag: string; renders_to: string; explanation: string }[];
}

/** Config shape for the 'payload_inspector' example type. */
export interface PayloadInspectorConfig {
  sample_payload: Record<string, unknown>;
  annotations: Record<string, string>;
}

/** Config shape for the 'field_comparison' example type. */
export interface FieldComparisonConfig {
  scenario: string;
  custom_field_result: { field_key: string; structure_copied: boolean; data_copied: boolean; note: string };
  custom_value_result: { value_key: string; structure_copied: boolean; data_copied: boolean; note: string };
}
