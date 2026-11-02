import { TERMS, type TermKey } from '@/copy';
import { InfoPopover } from './InfoPopover';

/**
 * A term label plus its popover. With htmlFor the label and trigger are siblings, so the
 * input's accessible name stays just the label text.
 */
export function Term({ term, htmlFor, children, className }: { term: TermKey; htmlFor?: string; children?: React.ReactNode; className?: string }) {
  const text = children ?? TERMS[term].label;
  return (
    // Inline flow, so a label that wraps keeps its ⓘ right after the last word.
    <span className={`block ${className ?? ''}`}>
      {htmlFor ? <label htmlFor={htmlFor}>{text}</label> : <span>{text}</span>}{' '}
      <InfoPopover term={term} />
    </span>
  );
}
