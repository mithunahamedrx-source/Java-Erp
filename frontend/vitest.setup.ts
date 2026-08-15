/**
 * Test environment shims.
 *
 * 🔴 These fill gaps in jsdom, never in the application. Nothing here changes behaviour that
 * ships — each entry exists because jsdom does not implement a browser API the real runtime
 * always provides.
 */

/**
 * jsdom implements no layout and no `ResizeObserver`.
 *
 * <p>`OperationalRegion` observes its scroller to keep the `UX-073` affordance honest when the
 * viewport or zoom changes. The stub lets that component mount; it reports no sizes, which is
 * correct — jsdom has none to report, and no test may claim geometry from it.
 */
class NoopResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??= NoopResizeObserver;

/**
 * jsdom implements no scrolling, so `Element.scrollIntoView` does not exist.
 *
 * <p>Real surfaces call it to move an operator to the first invalid field or to a section.
 * Without this shim the call throws mid-handler and everything after it silently never runs —
 * which is how a focus-management defect can hide behind a passing test.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {};
}
