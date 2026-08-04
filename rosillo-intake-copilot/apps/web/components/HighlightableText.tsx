export interface TextMark {
  id: string;
  start: number;
  end: number;
}

/**
 * Renders source text with <mark> anchors for verified evidence passages.
 * Marks must be pre-validated server-side (quote === text.slice(start, end));
 * overlapping marks are the caller's responsibility to drop.
 */
export function HighlightableText({
  text,
  marks,
  idPrefix,
  className,
}: {
  text: string;
  marks: TextMark[];
  idPrefix: string;
  className?: string;
}) {
  const sorted = [...marks].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const mark of sorted) {
    if (mark.start < cursor) continue; // overlap already dropped server-side; belt and braces
    if (mark.start > cursor) parts.push(text.slice(cursor, mark.start));
    parts.push(
      <mark key={mark.id} id={`${idPrefix}-${mark.id}`} className="evidence-mark">
        {text.slice(mark.start, mark.end)}
      </mark>,
    );
    cursor = mark.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <div className={className}>{parts}</div>;
}
