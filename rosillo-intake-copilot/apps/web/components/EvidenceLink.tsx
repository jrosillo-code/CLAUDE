'use client';

/**
 * Clickable evidence citation. When the passage was verified against the
 * source (aligned), clicking scrolls to and flashes the highlighted passage —
 * opening the containing attachment panel if needed. When exact alignment is
 * unavailable we say so honestly instead of highlighting an approximation.
 */
export function EvidenceLink({
  quote,
  sourceLabel,
  aligned,
  targetId,
  containerId,
  deterministic,
}: {
  quote: string;
  sourceLabel: string;
  aligned: boolean;
  targetId?: string;
  containerId?: string;
  deterministic?: boolean;
}) {
  if (deterministic) {
    return (
      <span className="evidence">
        {sourceLabel}: «{quote}» <span className="badge explicit">coincidencia determinista</span>
      </span>
    );
  }
  if (!aligned || !targetId) {
    return (
      <span className="evidence">
        {sourceLabel}: «{quote}» <span className="badge unknown">sin alineación exacta con la fuente</span>
      </span>
    );
  }

  const jump = () => {
    if (containerId) {
      const container = document.getElementById(containerId);
      if (container instanceof HTMLDetailsElement) container.open = true;
    }
    const el = document.getElementById(targetId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('evidence-flash');
    // Restart the flash animation on repeated clicks.
    void el.offsetWidth;
    el.classList.add('evidence-flash');
  };

  return (
    <button type="button" className="evidence-btn" onClick={jump} title="Resaltar el pasaje en la fuente">
      {sourceLabel}: «{quote}»
    </button>
  );
}
