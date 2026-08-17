import type { ChannelTypeOption, ShopFilters } from './shopApi';

/**
 * `SCS-022` and `SCS-023` — search plus three single-select filters.
 *
 * <p>🔴 EXACTLY THE APPROVED CONTROLS. `SCS-023.d` — no advanced-filter drawer, no date
 * filter, no saved view, no second search. Nothing here may quietly grow one.
 *
 * <p>🔴 EVERY CONTROL IS A QUERY PARAMETER, NOT A CLIENT-SIDE PREDICATE (`TEC-096`). This
 * component holds no rows and filters nothing; it reports what the operator chose.
 *
 * <p>⚠ `SCS-022` fixes the search scope at shop name, internal code and external link — which
 * is what the placeholder says, and it is not widened here or on the server.
 */
export function ShopFilterBar({
  filters,
  searchDraft,
  channelTypes,
  showing,
  totalRegistered,
  onSearchDraft,
  onSearchCommit,
  onFilterChange,
  onClear,
}: {
  readonly filters: ShopFilters;
  readonly searchDraft: string;
  readonly channelTypes: readonly ChannelTypeOption[];
  readonly showing: number;
  readonly totalRegistered: number;
  readonly onSearchDraft: (value: string) => void;
  readonly onSearchCommit: () => void;
  readonly onFilterChange: (next: ShopFilters) => void;
  readonly onClear: () => void;
}): React.JSX.Element {
  const tokens = activeTokens(filters, channelTypes);

  return (
    <div>
      <div
        style={{
          display: 'grid',
          /*
            The approved pack's track sizes and 80% width. ⚠ ONE BOUNDED DEVIATION: the pack
            gives Status 96px, which fits its unset label but clips the longest real value
            ("Status: Suspended"). 118px is the smallest width that renders it whole, and a
            clipped control is a defect the visual gate rejects outright.
          */
          gridTemplateColumns: 'minmax(0,1fr) 158px 178px 118px',
          gap: '10px',
          marginTop: '20px',
          alignItems: 'center',
          width: '80%',
        }}
      >
        <label
          style={{
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            gap: '9px',
            padding: '0 12px',
            border: '1px solid var(--color-border-control)',
            borderRadius: '9px',
            background: 'var(--color-surface)',
            minWidth: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-demoted)" strokeWidth="1.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
          <input
            data-testid="shop-search"
            type="search"
            value={searchDraft}
            onChange={(event) => onSearchDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSearchCommit();
              }
            }}
            onBlur={onSearchCommit}
            /* ⚠ The placeholder IS the ratified scope statement (`SCS-022`). */
            placeholder="Search shop name, code or link"
            aria-label="Search shop name, code or link"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '13px',
              fontFamily: 'inherit',
              color: 'var(--color-text-primary)',
            }}
          />
        </label>

        <FilterSelect
          testId="filter-channel"
          label="Channel"
          value={filters.channelType ?? ''}
          options={channelTypes.map((type) => ({ value: type.code, label: type.label }))}
          onChange={(value) =>
            onFilterChange({ ...filters, channelType: (value || undefined) as ShopFilters['channelType'] })
          }
        />
        <FilterSelect
          testId="filter-connection"
          label="Connection"
          options={[
            { value: 'CONNECTED', label: 'Connected' },
            { value: 'REAUTH_REQUIRED', label: 'Reauthorization required' },
            { value: 'NOT_CONNECTED', label: 'Not connected' },
            { value: 'ERROR', label: 'Connection error' },
          ]}
          value={filters.connection ?? ''}
          onChange={(value) =>
            onFilterChange({ ...filters, connection: (value || undefined) as ShopFilters['connection'] })
          }
        />
        <FilterSelect
          testId="filter-status"
          label="Status"
          options={[
            { value: 'DRAFT', label: 'Draft' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'ARCHIVED', label: 'Archived' },
          ]}
          value={filters.configuration ?? ''}
          onChange={(value) =>
            onFilterChange({ ...filters, configuration: (value || undefined) as ShopFilters['configuration'] })
          }
        />
      </div>

      {/*
        `SCS-023.b` — active filters are VISIBLE AND INDIVIDUALLY REMOVABLE, with a count and a
        Clear that returns every filter to all. ⚠ Clear leaves the search untouched, exactly as
        the contract states.
      */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '11px',
          // ⚠ RULE 7.8.a — a page-level region, so this strip may reflow. The ROWS below
          // never do (`RULE 7.8.b`).
          flexWrap: 'wrap',
        }}
      >
        {tokens.length > 0 && (
          <span data-testid="filter-count" style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            {tokens.length} {tokens.length === 1 ? 'filter' : 'filters'}
          </span>
        )}
        {tokens.map((token) => (
          <button
            key={token.key}
            type="button"
            data-testid={`filter-token-${token.key}`}
            onClick={() => onFilterChange({ ...filters, [token.key]: undefined })}
            aria-label={`Remove filter ${token.label}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '24px',
              padding: '0 8px 0 9px',
              border: '1px solid var(--color-border-control)',
              borderRadius: '6px',
              background: 'var(--color-surface)',
              fontSize: '11.5px',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {token.label}
            <span aria-hidden="true" style={{ color: 'var(--color-text-demoted)' }}>
              ×
            </span>
          </button>
        ))}
        {tokens.length > 0 && (
          <button
            type="button"
            data-testid="filter-clear"
            onClick={onClear}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              fontSize: '11.5px',
              fontWeight: 600,
              fontFamily: 'inherit',
              color: 'var(--color-text-muted)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
        {/* `SCS-023.c` — matched against total REGISTERED, not against the page. */}
        <span
          data-testid="result-count"
          style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}
        >
          Showing {showing} of {totalRegistered} {totalRegistered === 1 ? 'shop' : 'shops'}
        </span>
      </div>
    </div>
  );
}

/** `SCS-023.a` — single-select. ⚠ An empty value means *all*, which is the default. */
function FilterSelect({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly onChange: (value: string) => void;
  readonly testId: string;
}): React.JSX.Element {
  const selected = options.find((option) => option.value === value);
  return (
    <label
      style={{
        position: 'relative',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 11px',
        border: '1px solid var(--color-border-control)',
        borderRadius: '9px',
        background: 'var(--color-surface)',
        fontSize: '12.5px',
        fontWeight: selected ? 600 : 400,
        color: selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {selected ? `${label}: ${selected.label}` : label}
      </span>
      <svg
        width="12"
        height="12"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
        style={{ marginLeft: 'auto', flexShrink: 0 }}
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
      {/*
        A real <select>, laid over the rendered face. Keyboard, screen readers and the
        browser's own picker all keep working; only the closed-state appearance is the pack's.
      */}
      <select
        data-testid={testId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <option value="">{`${label}: all`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type Token = { readonly key: 'channelType' | 'connection' | 'configuration'; readonly label: string };

function activeTokens(filters: ShopFilters, channelTypes: readonly ChannelTypeOption[]): readonly Token[] {
  const tokens: Token[] = [];
  if (filters.channelType) {
    const match = channelTypes.find((type) => type.code === filters.channelType);
    tokens.push({ key: 'channelType', label: `Channel: ${match?.label ?? filters.channelType}` });
  }
  if (filters.connection) {
    tokens.push({ key: 'connection', label: `Connection: ${CONNECTION_LABEL[filters.connection]}` });
  }
  if (filters.configuration) {
    tokens.push({ key: 'configuration', label: `Status: ${STATUS_LABEL[filters.configuration]}` });
  }
  return tokens;
}

const CONNECTION_LABEL: Record<string, string> = {
  CONNECTED: 'Connected',
  REAUTH_REQUIRED: 'Reauthorization required',
  NOT_CONNECTED: 'Not connected',
  ERROR: 'Connection error',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  ARCHIVED: 'Archived',
};
