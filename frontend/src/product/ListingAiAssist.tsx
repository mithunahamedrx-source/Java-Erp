import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../ui/Overlay';
import { buttonStyle } from '../ui/primitives';
import { fetchAiStatus, generateAiCandidates } from './channelListingApi';
import type { AiAuthoringKind } from './channelListingApi';

/**
 * AI ASSIST — the interactive authoring flow, `PRD-200`.
 *
 * <p>🔴 THE RULE THIS PANEL EXISTS TO HOLD: **a generation is a suggestion, and nothing else
 * happens until a person accepts it** (`PRD-200.a`, `PRD-200.c`). Generating writes nothing.
 * Accepting edits the FORM only — it does not save (`PRD-200.k`). Saving is separate, and
 * pushing is separate again. There is deliberately no path from here to a marketplace.
 *
 * <p>🔴 `PRD-200.o` — a candidate NEVER replaces authored content in place. Where a field
 * already holds words, the operator sees CURRENT and SUGGESTED together and accepts the
 * replacement explicitly.
 *
 * <p>🔴 `PRD-200.m` — a set may be accepted IN PART. Generate all content returns three
 * candidates and each is accepted on its own; the set is not a transaction.
 *
 * <p>🔴 `PRD-200.p` — nothing here runs on its own. No readiness gap, empty field or page
 * load triggers a request: an assistant that ran unasked would spend an operator's budget and
 * author copy nobody wanted.
 */

/** ⚠ The commands, as the operator reads them. Each maps to what it may actually ask for. */
const COMMANDS: readonly { readonly id: string; readonly label: string; readonly kinds: readonly AiAuthoringKind[]; readonly instruction?: string }[] = [
  { id: 'title', label: 'Generate title', kinds: ['TITLE'] },
  { id: 'highlights', label: 'Generate highlights', kinds: ['HIGHLIGHTS'] },
  { id: 'description', label: 'Generate description', kinds: ['DESCRIPTION'] },
  { id: 'all', label: 'Generate all content', kinds: ['TITLE', 'HIGHLIGHTS', 'DESCRIPTION'] },
  { id: 'rewrite-title', label: 'Rewrite title', kinds: ['TITLE'], instruction: 'Rewrite the existing title.' },
  { id: 'rewrite-highlights', label: 'Rewrite highlights', kinds: ['HIGHLIGHTS'], instruction: 'Rewrite the existing highlights.' },
  { id: 'rewrite-description', label: 'Rewrite description', kinds: ['DESCRIPTION'], instruction: 'Rewrite the existing description.' },
  { id: 'shorten-title', label: 'Shorten title', kinds: ['TITLE'], instruction: 'Shorten the existing title.' },
  { id: 'seo', label: 'Improve search relevance', kinds: ['TITLE', 'DESCRIPTION'], instruction: 'Improve search relevance without adding facts.' },
  { id: 'marketplace', label: 'Optimise for marketplace', kinds: ['TITLE', 'DESCRIPTION'], instruction: 'Optimise for the selected channel and category.' },
];

export type AiAcceptance = { readonly kind: AiAuthoringKind; readonly text: string };

export function ListingAiAssist({
  open,
  onClose,
  language,
  facts,
  adapterConstraints,
  current,
  onAccept,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** 🔴 `PRD-200` + `PRD-202` — the candidate is written in the AUTHORING language. */
  readonly language: 'EN' | 'BN';
  /** 🔴 `PRD-200.f`/`.g` — only what the Listing holds; a blank value is reported as ABSENT. */
  readonly facts: Record<string, string | null>;
  readonly adapterConstraints: readonly string[];
  /** What each field holds now, so a rewrite can be compared before it replaces anything. */
  readonly current: Readonly<Record<AiAuthoringKind, string>>;
  readonly onAccept: (accepted: readonly AiAcceptance[]) => void;
}): React.JSX.Element | null {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [command, setCommand] = useState(COMMANDS[0]!);
  const [instruction, setInstruction] = useState('');
  const [state, setState] = useState<'ready' | 'generating' | 'generated' | 'failed'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Partial<Record<AiAuthoringKind, string>>>({});
  const [chosen, setChosen] = useState<readonly AiAuthoringKind[]>([]);

  useEffect(() => {
    if (!open) return;
    // ⚠ Asked once per opening. The answer is a fact about the system, not about this listing.
    fetchAiStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
  }, [open]);

  if (!open) {
    return null;
  }

  const generate = async (): Promise<void> => {
    setState('generating');
    setError(null);
    try {
      const merged: Partial<Record<AiAuthoringKind, string>> = {};
      for (const kind of command.kinds) {
        const result = await generateAiCandidates({
          kind,
          language,
          instruction: [command.instruction, instruction.trim()].filter(Boolean).join(' ') || null,
          facts,
          adapterConstraints,
        });
        Object.assign(merged, result.candidates);
      }
      setCandidates(merged);
      // 🔴 `PRD-200.m` — every returned candidate starts SELECTED but each is accepted on its
      // own, so the operator can drop one without losing the others.
      setChosen(Object.keys(merged) as AiAuthoringKind[]);
      setState('generated');
    } catch (cause) {
      /*
        🔴 `PRD-200` — a failure changes NOTHING. The form, the candidates already on screen
        and every authored value are untouched; only this message appears.
      */
      setError(cause instanceof Error ? cause.message : 'The suggestion could not be generated.');
      setState('failed');
    }
  };

  const accept = (): void => {
    onAccept(chosen
      .filter((kind) => candidates[kind] !== undefined)
      .map((kind) => ({ kind, text: candidates[kind] as string })));
    onClose();
  };

  const hasCandidates = state === 'generated' && Object.keys(candidates).length > 0;

  return (
    <ConfirmDialog
      testId="ai-assist-dialog"
      width="620px"
      title="AI Assist"
      consequence={
        configured === false
          // 🔴 `PRD-200.r` — stated plainly. Nothing is fabricated to hide it.
          ? 'AI authoring is not configured. Content can still be written by hand, and every field on this page remains editable.'
          : 'A suggestion is a draft. Nothing is written until you accept it, accepting does not save the listing, and saving does not publish it.'
      }
      confirmLabel={hasCandidates ? `Use ${chosen.length} suggestion${chosen.length === 1 ? '' : 's'}` : 'Generate'}
      cancelLabel="Close"
      busy={state === 'generating'}
      error={error}
      onCancel={onClose}
      onConfirm={() => { if (hasCandidates) { accept(); } else { void generate(); } }}
    >
      <div style={{ marginTop: '14px' }}>
        <div style={sectionLabel}>Generate</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {COMMANDS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`ai-command-${c.id}`}
              disabled={configured === false || state === 'generating'}
              onClick={() => { setCommand(c); setState('ready'); setCandidates({}); setError(null); }}
              style={chip(command.id === c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 120px', gap: '12px', marginTop: '14px' }}>
        <div>
          <div style={sectionLabel}>Instruction</div>
          <input
            data-testid="ai-instruction"
            aria-label="Custom instruction"
            value={instruction}
            disabled={configured === false || state === 'generating'}
            placeholder="Optional — e.g. emphasise warranty and connectivity"
            onChange={(event) => setInstruction(event.target.value)}
            style={control}
          />
        </div>
        <div>
          <div style={sectionLabel}>Language</div>
          {/* 🔴 `PRD-200` follows the page's authoring language; it is never chosen here. */}
          <div data-testid="ai-language" style={{ ...control, display: 'flex', alignItems: 'center', background: 'var(--color-strip)' }}>
            {language === 'EN' ? 'English' : 'বাংলা'}
          </div>
        </div>
      </div>

      {/*
        🔴 `PRD-200.f`/`.g` — the operator can see exactly what the assistant is being told,
        including what is ABSENT. A context an operator cannot inspect is one they cannot trust.
      */}
      <div style={{ marginTop: '14px' }}>
        <div style={sectionLabel}>Context</div>
        <div data-testid="ai-context" style={{ ...note, border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control-small)', padding: '8px 10px' }}>
          {describeContext(facts)}
        </div>
      </div>

      {hasCandidates && (
        <div data-testid="ai-candidates" style={{ marginTop: '16px' }}>
          <div style={sectionLabel}>Candidate draft</div>
          {(Object.keys(candidates) as AiAuthoringKind[]).map((kind) => (
            <CandidateRow
              key={kind}
              kind={kind}
              current={current[kind]}
              suggested={candidates[kind] as string}
              selected={chosen.includes(kind)}
              onToggle={() => setChosen((c) => (c.includes(kind) ? c.filter((k) => k !== kind) : [...c, kind]))}
            />
          ))}
          <button type="button" data-testid="ai-regenerate" onClick={() => void generate()} style={{ ...secondary, marginTop: '10px' }}>
            Regenerate
          </button>
        </div>
      )}
    </ConfirmDialog>
  );
}

/**
 * One candidate, beside what the field holds now.
 *
 * <p>🔴 `PRD-200.o` — CURRENT and SUGGESTED are shown TOGETHER. An operator replacing words
 * they wrote must see what they are giving up before they agree to it.
 */
function CandidateRow({
  kind,
  current,
  suggested,
  selected,
  onToggle,
}: {
  readonly kind: AiAuthoringKind;
  readonly current: string;
  readonly suggested: string;
  readonly selected: boolean;
  readonly onToggle: () => void;
}): React.JSX.Element {
  return (
    <div data-testid={`ai-candidate-${kind}`} style={{ border: '1px solid var(--color-divider-inner)', borderRadius: 'var(--radius-control-small)', padding: '10px 11px', marginTop: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-heading-ink)' }}>
          {kind === 'TITLE' ? 'Title' : kind === 'HIGHLIGHTS' ? 'Highlights' : 'Description'}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--color-text-secondary)' }}>
          <input
            type="checkbox"
            data-testid={`ai-accept-${kind}`}
            checked={selected}
            onChange={onToggle}
          />
          Use this
        </label>
      </div>
      {current.trim() && (
        <div style={{ marginTop: '7px' }}>
          <div style={miniLabel}>Current</div>
          <div data-testid={`ai-current-${kind}`} style={{ ...body, color: 'var(--color-text-demoted)' }}>{current}</div>
        </div>
      )}
      <div style={{ marginTop: '7px' }}>
        <div style={miniLabel}>Suggested</div>
        <div data-testid={`ai-suggested-${kind}`} style={{ ...body, fontWeight: 600 }}>{suggested}</div>
      </div>
    </div>
  );
}

/**
 * ⚠ `PRD-200.g` — names what is KNOWN and what is ABSENT, in that order. The absent list is
 * the point: it is what stops an assistant inventing a warranty period nobody recorded.
 */
function describeContext(facts: Record<string, string | null>): string {
  const known = Object.entries(facts).filter(([, v]) => v !== null && v.trim() !== '').map(([k]) => k);
  const absent = Object.entries(facts).filter(([, v]) => v === null || v.trim() === '').map(([k]) => k);
  const parts: string[] = [];
  if (known.length > 0) parts.push(`Known: ${known.join(' · ')}`);
  if (absent.length > 0) parts.push(`Not recorded, and never invented: ${absent.join(' · ')}`);
  return parts.join('. ') || 'Nothing has been entered yet.';
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10.5px',
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--color-text-demoted)',
  fontWeight: 700,
  marginBottom: '6px',
};
const miniLabel: React.CSSProperties = { fontSize: '10.5px', color: 'var(--color-placeholder)', fontWeight: 600 };
const body: React.CSSProperties = { fontSize: '12px', color: 'var(--color-text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const note: React.CSSProperties = { fontSize: '11.5px', color: 'var(--color-text-demoted)', lineHeight: 1.55, margin: 0 };
const control: React.CSSProperties = {
  width: '100%',
  height: 'var(--control-height-form)',
  borderRadius: 'var(--radius-control-small)',
  border: '1px solid var(--color-border-form-control)',
  padding: '0 11px',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  color: 'var(--color-text-primary)',
  background: 'var(--color-surface)',
  minWidth: 0,
};
const secondary: React.CSSProperties = { ...buttonStyle('secondary', 'row-action'), fontSize: '11.5px' };

function chip(active: boolean): React.CSSProperties {
  return {
    height: '26px',
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 10px',
    border: active ? '1.5px solid var(--color-ink)' : '1px solid var(--color-border-control)',
    borderRadius: 'var(--radius-control-small)',
    background: 'var(--color-surface)',
    fontSize: '11.5px',
    fontWeight: active ? 700 : 600,
    color: active ? 'var(--color-heading-ink)' : 'var(--color-text-secondary)',
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };
}
