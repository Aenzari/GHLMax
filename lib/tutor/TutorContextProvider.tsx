'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TutorContext as TutorContextShape } from '@/lib/types/tutor';

interface TutorContextValue {
  context: TutorContextShape;
  setContext: (ctx: TutorContextShape) => void;
}

const defaultContext: TutorContextShape = { pageType: 'general' };

const TutorContextReactContext = createContext<TutorContextValue | null>(null);

export function TutorContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TutorContextShape>(defaultContext);

  const value = useMemo(() => ({ context, setContext }), [context]);

  return (
    <TutorContextReactContext.Provider value={value}>{children}</TutorContextReactContext.Provider>
  );
}

/** Read the current tutor grounding context. Used by the single global AiTutorDrawer. */
export function useTutorContext(): TutorContextShape {
  const ctx = useContext(TutorContextReactContext);
  if (!ctx) {
    throw new Error('useTutorContext must be used within a TutorContextProvider.');
  }
  return ctx.context;
}

/**
 * Call from any page (lesson, challenge, canvas) to ground the tutor in what
 * the learner is currently viewing. Automatically resets to 'general' on unmount
 * so navigating away doesn't leave stale context behind for the next page.
 */
export function useSetTutorContext(context: TutorContextShape) {
  const ctx = useContext(TutorContextReactContext);
  if (!ctx) {
    throw new Error('useSetTutorContext must be used within a TutorContextProvider.');
  }
  const { setContext } = ctx;

  useEffect(() => {
    setContext(context);
    return () => setContext(defaultContext);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.pageType, context.title, context.contextSnippet]);
}
