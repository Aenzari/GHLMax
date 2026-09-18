'use client';

/**
 * Deliberately dependency-free. Curriculum content is authored by us (trusted,
 * seeded via migration), not user-submitted, so we don't need a hardened
 * sanitizing markdown library — a small line-based renderer covering the
 * subset we actually author in (h1/h2, bold, bullet lists, paragraphs,
 * blockquotes) keeps the bundle lighter and avoids a new dependency for v1.
 * If lesson content ever becomes user-editable, swap this for react-markdown
 * + rehype-sanitize before that happens.
 */
export default function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="my-3 list-inside list-disc space-y-1">
        {listBuffer.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();

    if (line.startsWith('# ')) {
      flushList();
      blocks.push(
        <h1 key={i} className="mt-6 mb-3 text-2xl font-bold text-slate-900 first:mt-0">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h2 key={i} className="mt-5 mb-2 text-lg font-semibold text-slate-800">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('> ')) {
      flushList();
      blocks.push(
        <blockquote
          key={i}
          className="my-3 border-l-4 border-blue-300 bg-blue-50 py-2 pl-4 text-sm text-blue-900"
          dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }}
        />
      );
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      listBuffer.push(line.slice(2));
    } else if (line.length === 0) {
      flushList();
    } else {
      flushList();
      blocks.push(
        <p
          key={i}
          className="my-3 text-sm leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: renderInline(line) }}
        />
      );
    }
  });
  flushList();

  return <div>{blocks}</div>;
}

/** Handles inline **bold** and `code` spans. Input is trusted (authored, not user-submitted). */
function renderInline(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1 py-0.5 text-xs">$1</code>');
}
