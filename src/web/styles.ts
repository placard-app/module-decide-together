// The host loads a JavaScript module. Keep its stylesheet scoped to the plugin.
export const styles = `
.dt-page {
  max-width: 960px;
  margin: 0 auto;
  padding: clamp(20px, 4vw, 48px) clamp(12px, 3vw, 28px);
  color: var(--foreground);
  overflow-wrap: anywhere;
}
.dt-page * { box-sizing: border-box; }
.dt-page h1, .dt-page h2, .dt-page h3, .dt-page p { margin: 0; }
.dt-page h1 { font-size: clamp(2rem, 5vw, 3rem); line-height: 1.08; letter-spacing: -.045em; font-weight: 650; }
.dt-page h2 { font-size: 1.35rem; font-weight: 650; line-height: 1.25; }
.dt-page h3 { font-size: 1.2rem; font-weight: 650; line-height: 1.3; }
.dt-page header { display: grid; gap: 12px; margin-bottom: 24px; }
.dt-page .dt-muted, .dt-page small { color: var(--muted-foreground); }
.dt-page .dt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 265px), 1fr)); gap: 16px; }
.dt-page .dt-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; min-width: 0; }
.dt-page .dt-grid > article:not(.dt-body) { display: flex; flex-direction: column; }
.dt-page .dt-card > .dt-body { display: flex; flex-direction: column; flex: 1; }
.dt-page .dt-marked { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); }
.dt-page .dt-body { padding: 20px; display: grid; gap: 12px; }
.dt-page .dt-photo { display: block; width: 100%; height: 156px; object-fit: cover; }
.dt-page .dt-category { font-size: .86rem; text-transform: capitalize; color: var(--muted-foreground); }
.dt-page .dt-actions, .dt-page .dt-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.dt-page .dt-card-footer, .dt-page .dt-footer { border-top: 1px solid var(--border); padding-top: 14px; }
.dt-page .dt-card-footer { justify-content: space-between; margin-top: auto; }
.dt-page .dt-footer { margin-top: 24px; }
.dt-page .dt-button, .dt-page .dt-field input, .dt-page select {
  min-height: 44px; font: inherit; color: var(--foreground); background: var(--card);
  border: 1px solid var(--border); border-radius: 9px; padding: 9px 14px; max-width: 100%;
}
.dt-page .dt-button { cursor: pointer; font-weight: 600; }
.dt-page .dt-primary { background: var(--primary); color: var(--primary-foreground); border-color: var(--primary); }
.dt-page button:disabled { opacity: .55; cursor: default; }
.dt-page .dt-button:enabled:hover { border-color: var(--primary); filter: brightness(.96); }
.dt-page :is(button, input, select, a, summary):focus-visible { outline: 3px solid var(--primary); outline-offset: 2px; }
.dt-page .dt-back { color: var(--muted-foreground); cursor: pointer; padding: 8px 0; margin-bottom: 10px; }
.dt-page .dt-link { color: var(--primary); text-decoration: underline; text-underline-offset: 3px; padding: 8px 0; }
.dt-page .dt-status { background: var(--muted); border-radius: 6px; padding: 3px 9px; font-size: .85rem; font-weight: 600; }
.dt-page .dt-notice { background: var(--muted); border-inline-start: 3px solid var(--primary); padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 18px 0; }
.dt-page .dt-field { display: grid; gap: 5px; font-weight: 600; min-width: 0; }
.dt-page .dt-field input, .dt-page select { width: 100%; font-weight: 400; }
.dt-page .dt-filters { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; }
.dt-page .dt-section { margin: 20px 0 12px; }
.dt-page .dt-choice { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; font-weight: 600; }
.dt-page .dt-choice input { width: 18px; height: 18px; accent-color: var(--primary); }
.dt-page summary { cursor: pointer; width: fit-content; }
.dt-page details[open] summary { margin-bottom: 6px; }
.dt-page .dt-winner { font-weight: 700; color: var(--primary); }
.dt-page .dt-error { padding: 12px; border: 1px solid var(--destructive); margin-bottom: 12px; }
@media (max-width: 540px) {
  .dt-page .dt-filters { grid-template-columns: 1fr; }
  .dt-page .dt-body { padding: 16px; }
}
`
