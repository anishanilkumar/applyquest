import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useSummary } from '../../context/SummaryContext';

// Point at a value (hover with a mouse, tap on a touch screen, or focus with
// the keyboard) and its maths opens: the formula, then the same formula with
// this search's numbers in. The text is the server's (backend
// core/glossary.py), so Friday shows the same. `vars` fills the placeholders
// of entries about one row (a draft, a segment, a coefficient).
type Vars = Record<string, string | number | null | undefined>;

const fmt = (v: string | number | null | undefined) =>
  v == null ? '–' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) >= 10 ? 1 : 3)) : v;

export const fill = (line: string, vars: Vars = {}) => line.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? fmt(vars[k]) : m));

const WIDTH = 352; // 22rem
const GUTTER = 16;

const Explain: React.FC<{ k: string; vars?: Vars; children: React.ReactNode; className?: string }> = ({ k, vars, children, className }) => {
  const { glossary } = useSummary();
  const entry = glossary[k];
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const id = useId();

  // Below the value, or above it when the panel wouldn't fit below.
  useLayoutEffect(() => {
    if (!open || !anchor.current) { setPos(null); return; }
    const r = anchor.current.getBoundingClientRect();
    const width = Math.min(WIDTH, window.innerWidth - 2 * GUTTER);
    const left = Math.min(Math.max(GUTTER, r.left), window.innerWidth - GUTTER - width);
    const height = pop.current?.offsetHeight ?? 0;
    const below = r.bottom + 6;
    const top = below + height > window.innerHeight - GUTTER && r.top - 6 - height >= GUTTER ? r.top - 6 - height : below;
    setPos(p => (p && p.left === left && p.top === top && p.width === width ? p : { left, top, width }));
  }, [open, pos?.width]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && anchor.current?.contains(e.target as Node)) return;
      setOpen(false); setPinned(false);
    };
    const away = () => { setOpen(false); setPinned(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', away, true);
    };
  }, [open]);

  if (!entry) return <span className={className}>{children}</span>;

  return (
    <span
      ref={anchor}
      className={`explain ${className ?? ''}`}
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setOpen(true); }}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
      onFocus={() => setOpen(true)}
      onBlur={() => { if (!pinned) setOpen(false); }}
      onClick={e => { e.stopPropagation(); const pin = !pinned; setPinned(pin); setOpen(pin); }}
    >
      {children}
      {open && (
        <span id={id} ref={pop} role="tooltip" className="explain-pop"
          style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { left: GUTTER, top: 0, width: WIDTH, visibility: 'hidden' }}>
          <span className="label block">{entry.title}</span>
          <span className="block mt-2 space-y-1">
            {entry.formula.map((l, i) => <span key={i} className="block font-mono text-[0.8125rem] text-ink">{fill(l, vars)}</span>)}
          </span>
          {entry.here.length > 0 && (
            <span className="block mt-3 pt-2 border-t-2 border-engrave space-y-1">
              {entry.here.map((l, i) => <span key={i} className="block font-mono text-[0.8125rem] text-arc">{fill(l, vars)}</span>)}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

export default Explain;
