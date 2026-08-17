import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../shell/AppShell';
import { ApiError } from '../platform/api';
import { formatMoment } from '../platform/datetime';
import { CONNECTION_STATE_ROLE, semanticRoleOf } from '../design/semanticRole';
import { Notice, buttonStyle } from '../ui/primitives';
import { ConnectionChip } from './ShopChrome';
import { ShopFormModal } from './ShopFormModal';
import { activateShop, authoriseShop, fetchChannelTypeOptions, fetchMarketOptions, fetchShop } from './shopApi';
import type { AuthorisationResult, ChannelTypeOption, MarketOption, ShopDetail } from './shopApi';

/**
 * `SC-D` — the shop detail page (`SCS-010`, route `/administration/shops/:id`).
 *
 * <p>🔴 THE AUTHORISATION RESULT IS A STATE OF THIS PAGE, NEVER ITS OWN SCREEN
 * (`SCS-010.a`). All three result families render here, above the sections, and no fourth
 * surface exists anywhere in this module.
 *
 * <p>🔴 `SCS-040` — CONFIGURATION AND CONNECTION ARE TWO INDEPENDENT FACTS, and the page says
 * so in words. `DRAFT` + `CONNECTED` is the ordinary state the contract is built around.
 *
 * <p>🔴 `SCS-052` — NO SECRET APPEARS ANYWHERE, and the page states that to the operator.
 *
 * <p>🔴 `SCS-050.b` — UNAUTHORISED MEANS OMITTED; AUTHORISED BUT BLOCKED BY STATE MEANS
 * VISIBLE, GREYED, WITH THE REASON BESIDE IT. The two are never conflated: a disabled control
 * would advertise authority the operator does not have.
 */
export default function ShopDetailPage(): React.JSX.Element {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const permissions = session.status === 'authenticated' ? session.user.permissions : [];
  /* 🔴 `PRM-090.a` — four INDEPENDENT capabilities, read independently. */
  const mayManage = permissions.includes('system.channel-instance.manage');
  const mayActivate = permissions.includes('system.channel-instance.lifecycle');
  const mayAuthorise = permissions.includes('integration.channel-connection.authorize');

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [channelTypes, setChannelTypes] = useState<readonly ChannelTypeOption[]>([]);
  const [markets, setMarkets] = useState<readonly MarketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 🔴 The authorisation RESULT — a state of this page (`SCS-010.a`). */
  const [result, setResult] = useState<AuthorisationResult | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  /** An action that failed while the page is intact. ⚠ Never blanks the record. */
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setShop(await fetchShop(id));
      setForbidden(false);
      setNotFound(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) setForbidden(true);
      else if (error instanceof ApiError && error.status === 404) setNotFound(true);
      else setLoadError(error instanceof ApiError ? error.message : 'This shop could not be read.');
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
    🔴 THE OUTCOME ARRIVES ON THE URL, because the operator has just been redirected back here by
    Daraz. `SCS-010.a` still treats it as a state of THIS page; only its delivery changed.
    ⚠ The parameters are consumed and removed, so a refresh does not re-announce a result that
    already happened.
  */
  useEffect(() => {
    const outcome = searchParams.get('authorisation');
    if (!outcome) return;

    if (outcome === 'AUTHORISED' || outcome === 'DIFFERENT_ACCOUNT'
        || outcome === 'CLAIMED_BY_ANOTHER_SHOP' || outcome === 'NOT_COMPLETED') {
      setResult({
        outcome,
        firstBinding: false,
        attemptedAccount: searchParams.get('attempted') ?? undefined,
      });
    } else {
      /* ⚠ A provider or transport failure is NOT an authorisation verdict (`DZC-011`). */
      setActionError('Daraz could not be reached just now. Nothing about this shop was changed.');
    }

    const remaining = new URLSearchParams(searchParams);
    remaining.delete('authorisation');
    remaining.delete('attempted');
    setSearchParams(remaining, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchChannelTypeOptions().then(setChannelTypes).catch(() => setChannelTypes([]));
    fetchMarketOptions().then(setMarkets).catch(() => setMarkets([]));
  }, []);

  /**
   * 🔴 THIS LEAVES THE APPLICATION. The seller signs in on Daraz's own page, so the browser is
   * handed to the provider and the outcome comes back on the callback redirect — it is not a
   * response to this call. `busy` is deliberately not cleared on success: navigation is already
   * under way, and re-enabling the button would invite a second attempt.
   */
  async function authorise(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      const initiation = await authoriseShop(id);
      window.location.assign(initiation.authorizationUrl);
      return;
    } catch (error) {
      /* 🔴 `API-070` — a business sentence. No provider payload can reach here. */
      setActionError(error instanceof ApiError ? error.message : 'The authorisation could not be started.');
    } finally {
      setBusy(false);
    }
  }

  async function activate(): Promise<void> {
    setBusy(true);
    setActionError(null);
    try {
      await activateShop(id);
      await load();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'The shop could not be activated.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ShopDetailSkeleton />;
  }

  if (forbidden) {
    return (
      <div>
        <PageHeader title="Shop" />
        <Notice tone="danger" title="You do not have access to this shop" testId="shop-forbidden">
          This destination requires the <code>system.channel-instance.view</code> capability.
        </Notice>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <PageHeader title="Shop" />
        <Notice tone="warning" title="This shop no longer exists" testId="shop-not-found">
          It may have been opened from a stale link. <Link to="/administration/shops">Return to Shops &amp; Channels</Link>.
        </Notice>
      </div>
    );
  }

  if (loadError || !shop) {
    return (
      <div>
        <PageHeader title="Shop" />
        <Notice tone="danger" title="This shop could not be loaded" testId="shop-load-error">
          Trioloo could not read this shop. Nothing has been changed — this is a read failure.
          <div style={{ marginTop: '10px' }}>
            <button type="button" data-testid="shop-retry" onClick={() => void load()} style={buttonStyle('secondary', 'button')}>
              Try again
            </button>
          </div>
        </Notice>
      </div>
    );
  }

  const bound = shop.externalAccountIdentity !== null;
  /*
    🔴 `SCS-043` — Connect is for a shop never authorised; Reauthorize renews. ⚠ The label
    follows the BINDING, not the connection condition: a shop with a broken connection is
    still bound, and "Connect" would misdescribe what pressing it does.
  */
  const authoriseLabel = bound ? 'Reauthorize' : 'Connect';
  /*
    🔴 ONE DARK PRIMARY, ON THE OPERATOR'S NEXT ACT. The approved pack shows Reauthorize as
    the primary on a settled ACTIVE shop, and moves that emphasis to ACTIVATE on the
    DRAFT-and-connected shop — because activating is what that operator came to do. Two
    primaries on one page would leave neither meaning anything (`RULE 3.19.b`).
  */
  const activateIsTheNextAct = mayActivate && shop.configuration === 'DRAFT' && shop.activatable;

  return (
    <div>
      <PageHeader
        title={shop.name}
        actions={
          <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
            <button
              type="button"
              data-testid="view-listings"
              /*
                🔴 `SCS-060` — opens the LISTINGS workspace filtered to THIS exact Channel
                Instance. Product remains the owner; no synchronisation moves here.
              */
              onClick={() => navigate(`/inventory/products/listings?channelInstanceId=${shop.id}`)}
              style={buttonStyle('secondary', 'page-header')}
            >
              View Listings
            </button>
            {/* 🔴 `SCS-050.b` — no manage capability means the control is ABSENT, not disabled. */}
            {mayManage && (
              <button type="button" data-testid="edit-shop" onClick={() => setEditing(true)} style={buttonStyle('secondary', 'page-header')}>
                Edit
              </button>
            )}
            {mayAuthorise && (
              <ActionWithReason
                testId="authorise"
                label={authoriseLabel}
                variant={activateIsTheNextAct ? 'secondary' : 'primary'}
                busy={busy}
                /* 🔴 `SCS-092.d` — membership implies no adapter, and the reason says so. */
                blockedReason={shop.authorisationSupported ? null : shop.authorisationUnsupportedReason}
                onClick={() => void authorise()}
                showReason={false}
                reasonFor="authorise-section-reason"
              />
            )}
            {mayActivate && shop.configuration === 'DRAFT' && (
              <ActionWithReason
                testId="activate"
                label="Activate"
                variant={activateIsTheNextAct ? 'primary' : 'secondary'}
                busy={busy}
                blockedReason={shop.activatable ? null : shop.activationBlockedReason}
                onClick={() => void activate()}
                showReason={false}
                reasonFor="activate-section-reason"
              />
            )}
          </div>
        }
      />

      {/* `SCS-040` — the context line: channel type · market · internal code. */}
      <div data-testid="shop-context" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '-14px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
          {shop.configuration}
        </span>
        <ConnectionChip connection={shop.connectionKnown ? shop.connection : null} />
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>
          {shop.channelTypeLabel}
          {shop.marketLabel ? ` · ${shop.marketLabel}` : ''} · {shop.code}
        </span>
      </div>

      {result && (
        <AuthorisationResultNotice
          /*
            ⚠ The redirect carries the OUTCOME, not the whole record. The bound account is read from
            the shop itself — which is the authoritative source anyway (`INV-16.5`) — so the notice
            still names it without the callback having to carry it.
          */
          result={{ ...result, boundAccount: result.boundAccount ?? shop.externalAccountIdentity ?? undefined }}
          shop={shop}
          busy={busy}
          onDismiss={() => setResult(null)}
          onActivate={() => void activate()}
          onRetry={() => void authorise()}
          /*
            🔴 `SCS-010` — the form stays a MODAL with NO ROUTE. This carries router STATE,
            which is not addressable and creates no URL; the workspace opens Add Shop from it.
          */
          onRegisterOtherAccount={() => navigate('/administration/shops', { state: { addShop: true } })}
        />
      )}

      {actionError && (
        <div style={{ marginBottom: '16px' }}>
          <Notice tone="danger" title="That could not be done" testId="shop-action-error">
            {actionError}
          </Notice>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* ------------------------------------------------------------------ Identity */}
          <Section title="Identity" testId="section-identity">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px 24px' }}>
              <Fact label="Shop display name" value={shop.name} strong />
              <Fact label="Channel type" value={shop.channelTypeLabel} />
              {/*
                ⚠ `SYS-034` — the canonical LABEL where one was recorded. Two rows predate
                the feature and genuinely have none; that is stated, never guessed and never
                back-filled to the single current member.
              */}
              <Fact label="Market" value={shop.marketLabel ?? 'Not recorded'} />
              <Fact label="Internal code" value={shop.code} mono />
              <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                <FactLabel>External link</FactLabel>
                {shop.externalLink ? (
                  <a
                    data-testid="detail-external-link"
                    href={shop.externalLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 700, color: 'var(--color-heading-ink)', textDecoration: 'none', marginTop: '3px' }}
                  >
                    Visit link
                  </a>
                ) : (
                  <div data-testid="detail-external-link" style={{ fontSize: '13px', fontWeight: 600, marginTop: '3px', color: 'var(--color-text-muted)' }}>
                    Not yet bound
                  </div>
                )}
                {/*
                  🔴 `SCS-041` — THE ACCOUNT IDENTITY IS A SEPARATE FACT FROM THE LINK, stated
                  separately and never collapsed into it.
                */}
                <div data-testid="bound-account" style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '3px', lineHeight: 1.6 }}>
                  {bound
                    ? `Account ${shop.externalAccountIdentity} · bound by the channel on ${formatMoment(shop.boundAt) ?? 'a date Trioloo does not hold'}, never edited in Trioloo`
                    : 'No account is bound yet. The channel confirms which account was bound when this shop is connected.'}
                </div>
              </div>
            </div>
          </Section>

          {/* -------------------------------------------- Configuration and connection */}
          <Section title="Configuration and connection" testId="section-states">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <StateBox label="Configuration" value={shop.configuration} testId="configuration-box">
                {CONFIGURATION_MEANING[shop.configuration]}
              </StateBox>
              <StateBox
                label="Connection"
                /* 🔴 Unknown is stated in the approved words, never as `NOT CONNECTED`. */
                value={
                  shop.connectionKnown && shop.connection
                    ? (CONNECTION_TITLE[shop.connection] ?? shop.connection)
                    : 'CONNECTION UNAVAILABLE'
                }
                testId="connection-box"
                tone={shop.connectionKnown && shop.connection ? semanticRoleOf(CONNECTION_STATE_ROLE, shop.connection) : undefined}
              >
                {shop.connectionKnown && shop.connection ? (
                  <>
                    {CONNECTION_MEANING[shop.connection]}
                    {shop.connection === 'ERROR' && shop.connectionLastCheckedAt && (
                      /* 🔴 `SCS-042.a` — a REAL observation time. A page load never sets it. */
                      <div data-testid="last-checked" style={{ marginTop: '4px' }}>
                        Last checked {formatMoment(shop.connectionLastCheckedAt)}.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    The connection state could not be read just now, so Trioloo is not claiming one. Everything else
                    on this page is Trioloo&apos;s own record and is accurate.
                    <div style={{ marginTop: '8px' }}>
                      <button type="button" data-testid="connection-retry" onClick={() => void load()} style={buttonStyle('secondary', 'button')}>
                        Try again
                      </button>
                    </div>
                  </>
                )}
              </StateBox>
            </div>
            {/* 🔴 The statement the contract requires, in words, on the page. */}
            <div data-testid="independence-statement" style={{ fontSize: '11.5px', color: 'var(--color-text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
              These are two independent facts. A shop can be active without a working connection, and connected
              without being approved for business use.
            </div>
          </Section>

          {/* ------------------------------------------------------------------ Listings */}
          <Section title="Listings" testId="section-listings">
            {/* 🔴 `SCS-053` / `UX-273.b` — synchronisation, refresh and push stay in Products. */}
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Listings for this shop are managed in Products. Synchronisation, refresh and push stay there.
            </div>
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                data-testid="view-listings-section"
                onClick={() => navigate(`/inventory/products/listings?channelInstanceId=${shop.id}`)}
                style={buttonStyle('secondary', 'button')}
              >
                View Listings
              </button>
            </div>
          </Section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          {/* ------------------------------------------------------------- Authorisation */}
          <Section title="Authorisation" testId="section-authorisation">
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {bound
                ? `Authorised against ${shop.channelTypeLabel} on ${formatMoment(shop.authorisedAt) ?? 'a date Trioloo does not hold'}. Reauthorizing sends you to ${shop.channelTypeLabel} to confirm the same account and returns you here.`
                : `This shop has never been authorised. Connect it to sign in to the ${shop.channelTypeLabel} account it represents; ${shop.channelTypeLabel} confirms which account was bound.`}
            </div>
            {mayAuthorise && (
              <div style={{ marginTop: '12px' }}>
                <ActionWithReason
                  testId="authorise-section"
                  label={authoriseLabel}
                  variant={activateIsTheNextAct ? 'secondary' : 'primary'}
                  busy={busy}
                  blockedReason={shop.authorisationSupported ? null : shop.authorisationUnsupportedReason}
                  onClick={() => void authorise()}
                />
              </div>
            )}
            {/* 🔴 `SCS-052` — the assurance, stated to the operator in words. */}
            <div data-testid="secret-assurance" style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
              Trioloo never shows or stores marketplace passwords, keys or tokens on this page.
            </div>
          </Section>

          {/* ---------------------------------------------------------------- Lifecycle */}
          <Section title="Lifecycle" testId="section-lifecycle">
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              {shop.activatedAt
                ? /* 🔴 `AGV-001` — the actor is a captured fact, not a reconstruction. */
                  `Activated on ${formatMoment(shop.activatedAt)}${shop.activatedByName ? ` by ${shop.activatedByName}` : ''}.`
                : 'Activating makes this shop an ordinary target for new Listings. Its connection is unaffected.'}
            </div>
            {mayActivate && shop.configuration === 'DRAFT' && (
              <div style={{ marginTop: '12px' }}>
                <ActionWithReason
                  testId="activate-section"
                  label="Activate"
                  variant={activateIsTheNextAct ? 'primary' : 'secondary'}
                  busy={busy}
                  blockedReason={shop.activatable ? null : shop.activationBlockedReason}
                  onClick={() => void activate()}
                />
              </div>
            )}
            {/* ⚠ `SCS-051.e` — stated plainly rather than hidden behind absent controls. */}
            <div data-testid="lifecycle-scope" style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '12px', lineHeight: 1.6 }}>
              Suspending or archiving a shop is not available in this release.
            </div>
          </Section>
        </div>
      </div>

      {editing && (
        <ShopFormModal
          mode="edit"
          shop={shop}
          channelTypes={channelTypes}
          markets={markets}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            /* `SCS-030.f` — a saved edit returns to the surface that opened the modal. */
            setEditing(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

/**
 * 🔴 `SCS-050.b` — THE ACTION EXISTS AND THE OPERATOR IS ENTITLED TO IT, but the current
 * state blocks it. It stays VISIBLE and GREYED with the reason BESIDE it, as visible text
 * associated by `aria-describedby` — never a tooltip, which a keyboard user cannot reach.
 *
 * <p>⚠ This component is never used for a permission denial. That case OMITS the control.
 */
function ActionWithReason({
  label,
  testId,
  variant,
  blockedReason,
  busy,
  onClick,
  showReason = true,
  reasonFor,
}: {
  readonly label: string;
  readonly testId: string;
  readonly variant: 'primary' | 'secondary';
  readonly blockedReason: string | null | undefined;
  readonly busy: boolean;
  readonly onClick: () => void;
  /**
   * ⚠ The approved pack puts the reason beside the IN-CONTENT action, not beside the header
   * one — the header band has no room for a sentence and would push the shell's own utility
   * cluster off its line. The header instance therefore renders the greyed control and
   * POINTS at the section's reason, so the text is still programmatically associated with it.
   */
  readonly showReason?: boolean;
  /** The id of the reason this control is described by, when it does not render its own. */
  readonly reasonFor?: string;
}): React.JSX.Element {
  const blocked = Boolean(blockedReason);
  const reasonId = showReason ? `${testId}-reason` : reasonFor;
  return (
    <span style={{ display: 'inline-flex', flexDirection: showReason ? 'column' : 'row', alignItems: showReason ? 'flex-start' : 'center', gap: '7px', maxWidth: '100%' }}>
      <button
        type="button"
        data-testid={testId}
        disabled={blocked || busy}
        aria-describedby={blocked ? reasonId : undefined}
        onClick={onClick}
        style={buttonStyle(variant, 'page-header', blocked || busy)}
      >
        {label}
      </button>
      {blocked && showReason && (
        <span
          id={reasonId}
          data-testid={`${testId}-reason`}
          style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--color-text-muted)' }}
        >
          {blockedReason}
        </span>
      )}
    </span>
  );
}

/**
 * `SCS-044` — the three authorisation results, each a state of THIS page.
 *
 * <p>🔴 THE MISMATCH NAMES BOTH ACCOUNTS and states that nothing was rebound, so the operator
 * understands that the other account needs its own shop record.
 */
function AuthorisationResultNotice({
  result,
  shop,
  busy,
  onDismiss,
  onActivate,
  onRetry,
  onRegisterOtherAccount,
}: {
  readonly result: AuthorisationResult;
  readonly shop: ShopDetail;
  readonly busy: boolean;
  readonly onDismiss: () => void;
  readonly onActivate: () => void;
  readonly onRetry: () => void;
  readonly onRegisterOtherAccount: () => void;
}): React.JSX.Element {
  const stillDraft = shop.configuration === 'DRAFT';
  return (
    <div style={{ marginBottom: '18px' }} data-testid="authorisation-result" data-outcome={result.outcome}>
      {result.outcome === 'AUTHORISED' && (
        <Notice tone="success" title={`Authorised — the account ${result.boundAccount} is now bound to this shop`}>
          Trioloo can reach the account on {shop.channelTypeLabel}.
          {stillDraft && (
            /* 🔴 `SCS-051.b` — activating is a SEPARATE decision and is not done for you. */
            <>
              {' '}
              The shop is still Draft, so Listings cannot target it yet — activating it is a separate decision and is
              not done for you.
            </>
          )}
          {/* `SCS-044` — the ratified NEXT step, offered where the operator is reading it. */}
          <ResultActions onDismiss={onDismiss}>
            {shop.activatable && (
              <button type="button" data-testid="result-activate" disabled={busy} onClick={onActivate} style={buttonStyle('primary', 'button', busy)}>
                Activate
              </button>
            )}
          </ResultActions>
        </Notice>
      )}

      {/*
        🔴 DANGER, AS THE APPROVED DESIGN RENDERS IT. A sign-in as the wrong account is not a
        gentle prompt: the operator believes they connected something and they did not, and
        acting on that belief is how a shop's Listings end up pointed at the wrong seller.
      */}
      {result.outcome === 'DIFFERENT_ACCOUNT' && (
        <Notice tone="danger" title="That account does not belong to this shop — nothing was changed">
          You signed in as <strong>{result.attemptedAccount}</strong>, but this shop is bound to{' '}
          <strong>{result.boundAccount}</strong>. Trioloo did not rebind it, so this shop&apos;s Listings and history
          stay attached to the account they were created under.
          <div style={{ marginTop: '6px' }}>To use the other account, register it as its own shop.</div>
          {/* `SCS-044` — BOTH ratified routes out: register the other account, or retry as the right one. */}
          <ResultActions onDismiss={onDismiss}>
            <button type="button" data-testid="result-add-shop" onClick={onRegisterOtherAccount} style={buttonStyle('secondary', 'button')}>
              Add a shop for that account
            </button>
            <button type="button" data-testid="result-retry" disabled={busy} onClick={onRetry} style={buttonStyle('primary', 'button', busy)}>
              Try again as {result.boundAccount}
            </button>
          </ResultActions>
        </Notice>
      )}

      {result.outcome === 'CLAIMED_BY_ANOTHER_SHOP' && (
        <Notice tone="danger" title="That account already belongs to another shop — nothing was changed">
          <strong>{result.attemptedAccount}</strong> is already bound to a different shop on this channel. One
          account belongs to one shop, so this shop was left exactly as it was.
          <ResultActions onDismiss={onDismiss} />
        </Notice>
      )}

      {/*
        ⚠ NEUTRAL, AS THE APPROVED DESIGN RENDERS IT — and deliberately not danger. `SCS-044`
        is explicit that nothing was bound and the shop is UNCHANGED: an unfinished sign-in is
        an incomplete act, not a failure with consequence, and colouring it red would tell the
        operator something broke when nothing did.
      */}
      {result.outcome === 'NOT_COMPLETED' && (
        <Notice tone="neutral" title="Authorisation did not complete">
          {shop.channelTypeLabel} did not confirm an account, so nothing was bound and this shop is unchanged. This
          happens if the sign-in was not finished or the channel declined the request.
          <ResultActions onDismiss={onDismiss}>
            <button type="button" data-testid="result-retry" disabled={busy} onClick={onRetry} style={buttonStyle('primary', 'button', busy)}>
              {shop.externalAccountIdentity ? 'Reauthorize' : 'Connect'}
            </button>
          </ResultActions>
        </Notice>
      )}
    </div>
  );
}

/** The result's ratified next steps, with Dismiss held at the trailing edge. */
function ResultActions({
  children,
  onDismiss,
}: {
  readonly children?: ReactNode;
  readonly onDismiss: () => void;
}): React.JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '12px', flexWrap: 'wrap' }}>
      {children}
      <button
        type="button"
        data-testid="dismiss-result"
        onClick={onDismiss}
        style={{ border: 'none', background: 'transparent', padding: 0, fontSize: '11.5px', fontWeight: 600, fontFamily: 'inherit', color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', cursor: 'pointer' }}
      >
        Dismiss
      </button>
    </div>
  );
}

function Section({ title, testId, children }: { readonly title: string; readonly testId: string; readonly children: ReactNode }): React.JSX.Element {
  return (
    <section
      data-testid={testId}
      style={{ border: '1px solid var(--color-divider-inner)', borderRadius: '10px', padding: '16px 18px', background: 'var(--color-surface)', minWidth: 0 }}
    >
      <div style={{ fontSize: '10.5px', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '12px' }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function FactLabel({ children }: { readonly children: ReactNode }): React.JSX.Element {
  return <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{children}</div>;
}

function Fact({ label, value, strong, mono }: { readonly label: string; readonly value: string; readonly strong?: boolean; readonly mono?: boolean }): React.JSX.Element {
  return (
    <div style={{ minWidth: 0 }}>
      <FactLabel>{label}</FactLabel>
      <div
        style={{
          fontSize: '13px',
          fontWeight: strong ? 700 : 600,
          marginTop: '3px',
          fontFamily: mono ? 'var(--font-mono, monospace)' : undefined,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/**
 * One of the two state boxes.
 *
 * <p>⚠ Only the CONNECTION box takes a semantic tone. `SCS-024.b` reserves colour for the
 * connection dimension; a coloured configuration box would put two competing signals side by
 * side and destroy the distinction the section exists to make.
 */
function StateBox({
  label,
  value,
  tone,
  testId,
  children,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  readonly testId: string;
  readonly children: ReactNode;
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      data-value={value}
      style={{
        border: `1px solid ${tone && tone !== 'neutral' ? `var(--color-semantic-${tone}-border)` : 'var(--color-divider-light)'}`,
        background: tone && tone !== 'neutral' ? `var(--color-semantic-${tone}-bg)` : 'var(--color-surface)',
        borderRadius: '9px',
        padding: '12px 14px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '0.02em', marginTop: '4px' }}>{value}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--color-text-secondary)', marginTop: '4px', lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

/** ⚠ `SCS-025.b`'s discipline applied here: geometry is held, no state text is guessed. */
function ShopDetailSkeleton(): React.JSX.Element {
  return (
    <div data-testid="shop-detail-loading">
      <PageHeader title="Shop" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 330px', gap: '24px' }}>
        {[0, 1].map((column) => (
          <div key={column} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[0, 1].map((box) => (
              <div
                key={box}
                aria-hidden="true"
                style={{ border: '1px solid var(--color-divider-inner)', borderRadius: '10px', padding: '16px 18px', height: '120px', background: 'var(--color-surface)' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const CONFIGURATION_MEANING: Record<string, string> = {
  DRAFT: 'Registered, but not yet approved for business use. Listings cannot target it.',
  ACTIVE: 'Available as an operational target for Listings.',
  SUSPENDED: 'Not available as an operational target for Listings.',
  ARCHIVED: 'Retired from operational use. Its history is retained.',
};

/** `SCS-043` — the approved wording. 🔴 Never a provider term or error code. */
const CONNECTION_TITLE: Record<string, string> = {
  CONNECTED: 'CONNECTED',
  NOT_CONNECTED: 'NOT CONNECTED',
  REAUTH_REQUIRED: 'REAUTHORIZATION REQUIRED',
  ERROR: 'CONNECTION ERROR',
};

const CONNECTION_MEANING: Record<string, string> = {
  CONNECTED: 'Trioloo can work against this account on the channel.',
  NOT_CONNECTED:
    'This shop has never been authorised. Connect it to sign in to the account it represents; the channel confirms which account was bound.',
  REAUTH_REQUIRED:
    'The channel no longer accepts Trioloo’s authorisation for this account, so work against it will fail until it is renewed. The shop, its Listings and its binding are unchanged.',
  ERROR:
    'Trioloo cannot work against this account. The channel refused the last attempt and the authorisation needs to be renewed before the shop can be used again.',
};
