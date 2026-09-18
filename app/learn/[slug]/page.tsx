import { notFound } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Lesson, InteractiveExample } from '@/lib/types/curriculum';
import LessonView from '@/components/learn/LessonView';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

async function getLessonBundle(slug: string) {
  const supabase = getSupabaseServerClient();

  const { data: lesson, error: lessonError } = await supabase
    .from('curriculum_lessons')
    .select('*')
    .eq('slug', slug)
    .single<Lesson>();

  if (lessonError || !lesson) return null;

  const { data: examples, error: examplesError } = await supabase
    .from('interactive_examples')
    .select('*')
    .eq('lesson_id', lesson.id)
    .order('sort_order', { ascending: true });

  if (examplesError) {
    console.error('[learn/[slug]] Failed to load examples:', examplesError.message);
  }

  let missingPrerequisites: string[] = [];
  if (lesson.prerequisite_slugs.length > 0) {
    const { data: prereqLessons } = await supabase
      .from('curriculum_lessons')
      .select('title, slug')
      .in('slug', lesson.prerequisite_slugs);

    // Note: without a real userId wired to auth, we cannot check actual completion
    // status here — this list currently just surfaces which lessons ARE prerequisites,
    // not whether the current learner has finished them. Once auth is wired, join
    // against user_lesson_progress filtered by status = 'completed' instead.
    missingPrerequisites = (prereqLessons ?? []).map((p) => p.title);
  }

  return {
    lesson,
    examples: (examples ?? []) as InteractiveExample[],
    missingPrerequisites,
  };
}

export default async function LessonPage({ params }: PageProps) {
  const bundle = await getLessonBundle(params.slug);

  if (!bundle) {
    notFound();
  }

  return (
    <LessonView
      lesson={bundle.lesson}
      examples={bundle.examples}
      missingPrerequisites={bundle.missingPrerequisites}
    />
  );
}
