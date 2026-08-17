/**
 * Scholar Android-only responsive corrections.
 *
 * Every selector is rooted under the marker injected by the native WebView.
 * These rules are never shipped to, or evaluated by, the normal Scholar site.
 */
export const SCHOLAR_ANDROID_MOBILE_CSS = String.raw`
html[data-scholar-native="android"] {
  --scholar-android-topbar-height: 64px;
  --scholar-android-bottom-nav-height: 60px;
  --scholar-android-safe-bottom: max(
    env(safe-area-inset-bottom, 0px),
    var(--scholar-android-native-bottom, 0px)
  );
  --safe-area-bottom: var(--scholar-android-safe-bottom) !important;
  background: #050506;
  max-width: 100%;
  overscroll-behavior: none;
}

html[data-scholar-native="android"] body.scholar-android {
  background: #050506;
  max-width: 100%;
  min-width: 0;
  overflow-x: clip !important;
  overscroll-behavior-x: none;
  touch-action: manipulation;
}

html[data-scholar-native="android"] body.scholar-android *,
html[data-scholar-native="android"] body.scholar-android *::before,
html[data-scholar-native="android"] body.scholar-android *::after {
  box-sizing: border-box;
}

html[data-scholar-native="android"] body.scholar-android :where(main, main > *, main > * > *) {
  min-width: 0;
}

html[data-scholar-native="android"] body.scholar-android :where(h1, h2, h3, h4, p, a) {
  overflow-wrap: break-word;
  word-break: normal;
}

/* App-like static content: editing and explicitly selectable surfaces opt back in. */
html[data-scholar-native="android"] body.scholar-android,
html[data-scholar-native="android"] body.scholar-android * {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

html[data-scholar-native="android"] body.scholar-android :where(
  input,
  textarea,
  select,
  [contenteditable="true"],
  [contenteditable="true"] *,
  [data-allow-selection="true"],
  pre,
  code
) {
  -webkit-touch-callout: default;
  -webkit-user-select: text;
  user-select: text;
}

html[data-scholar-native="android"] body.scholar-android img:not([draggable="true"]) {
  -webkit-user-drag: none;
  user-drag: none;
}

/* Native bottom inset: fill the gesture area and keep content above navigation. */
html[data-scholar-native="android"] body.scholar-android .scholar-bottom-nav {
  bottom: 0 !important;
  height: calc(60px + var(--scholar-android-safe-bottom)) !important;
  min-height: calc(60px + var(--scholar-android-safe-bottom));
  padding-bottom: var(--scholar-android-safe-bottom) !important;
  background: linear-gradient(180deg, rgba(10, 10, 11, .96), #080809) !important;
  border-top-color: rgba(255, 255, 255, .1) !important;
  box-shadow: 0 -10px 32px rgba(0, 0, 0, .34);
}

html[data-scholar-native="android"] body.scholar-android #main-scroll {
  overscroll-behavior: contain;
  scroll-padding-bottom: calc(76px + var(--scholar-android-safe-bottom));
  padding-bottom: calc(76px + var(--scholar-android-safe-bottom)) !important;
}

html[data-scholar-native="android"] body.scholar-android .scholar-info-footer {
  padding-bottom: calc(.5rem + 72px + var(--scholar-android-safe-bottom)) !important;
}

html[data-scholar-native="android"][data-scholar-keyboard-open="true"] body.scholar-android .scholar-bottom-nav {
  display: none !important;
}

html[data-scholar-native="android"][data-scholar-keyboard-open="true"] body.scholar-android .scholar-info-footer {
  padding-bottom: .5rem !important;
}

/* Compact the real Scholar topbar at narrow Android widths. */
@media (max-width: 430px) {
  html[data-scholar-native="android"] {
    --scholar-android-topbar-height: 58px;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-mobile-topbar {
    height: var(--scholar-android-topbar-height) !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-mobile-topbar > div {
    gap: .4rem !important;
    padding-inline: .65rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-status.contents {
    display: none !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-search {
    max-width: none !important;
    min-width: 0;
    padding-inline: .55rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-search svg {
    margin-right: .25rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-profile {
    height: 2.25rem !important;
    width: 2.25rem !important;
    flex: 0 0 2.25rem;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-guest-banner {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: .5rem !important;
    min-height: 44px;
    padding: .4rem .75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-guest-copy {
    min-width: 0;
    line-height: 1.25;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-guest-copy > span {
    display: block;
    margin-left: 0 !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-guest-action {
    min-height: 36px;
    padding: .4rem .7rem !important;
    font-size: 0 !important;
    white-space: nowrap;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-guest-action::after {
    content: "Sign in";
    font-size: .75rem;
  }
}

@media (max-width: 374px) {
  html[data-scholar-native="android"] body.scholar-android .scholar-top-status:not(.contents) {
    display: none !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-search span {
    display: none !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-search {
    flex: 0 0 2.5rem !important;
    justify-content: center !important;
    padding: 0 !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-search svg {
    margin: 0 !important;
  }
}

@media (max-width: 340px) {
  html[data-scholar-native="android"] body.scholar-android .scholar-top-status:not(.contents) {
    display: none !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-top-profile {
    height: 2rem !important;
    width: 2rem !important;
  }
}

/* The original Scholar drawer remains intact, but is bounded and scroll-safe. */
html[data-scholar-native="android"] body.scholar-android [role="dialog"]:has(nav) {
  height: var(--scholar-android-vh, 100dvh) !important;
  max-height: var(--scholar-android-vh, 100dvh) !important;
  max-width: min(19rem, 92vw) !important;
  padding-bottom: var(--scholar-android-safe-bottom) !important;
  overscroll-behavior: contain;
}

html[data-scholar-native="android"] body.scholar-android [role="dialog"]:has(nav) nav {
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

/* Dialogs, sheets, popovers and menus must stay within the Android viewport. */
html[data-scholar-native="android"] body.scholar-android [role="dialog"] {
  max-height: calc(var(--scholar-android-vh, 100dvh) - 1rem - var(--scholar-android-safe-bottom)) !important;
  max-width: min(46rem, calc(100vw - 1rem)) !important;
  overscroll-behavior: contain;
}

html[data-scholar-native="android"] body.scholar-android [data-radix-popper-content-wrapper] {
  max-width: calc(100vw - 1rem) !important;
}

html[data-scholar-native="android"] body.scholar-android :where([role="menu"], [role="listbox"]) {
  max-height: min(22rem, calc(var(--scholar-android-vh, 100dvh) - 5rem)) !important;
  max-width: calc(100vw - 1rem) !important;
  overflow: auto;
  overscroll-behavior: contain;
}

html[data-scholar-native="android"] body.scholar-android :where([role="menuitem"], [role="option"], [role="tab"]) {
  min-height: 42px;
}

html[data-scholar-native="android"] body.scholar-android button[aria-label] {
  min-height: 40px;
  min-width: 40px;
}

/* Forms and editors: no desktop-width controls or keyboard-trapped actions. */
html[data-scholar-native="android"] body.scholar-android :where(input, textarea, select) {
  max-width: 100%;
  min-width: 0;
}

html[data-scholar-native="android"] body.scholar-android :where(textarea, [contenteditable="true"]) {
  scroll-margin-bottom: calc(5rem + var(--scholar-android-safe-bottom));
}

html[data-scholar-native="android"] body.scholar-android [class*="toolbar"] {
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
}

html[data-scholar-native="android"] body.scholar-android .asme-glass-input {
  max-width: 100% !important;
}

@media (max-width: 430px) {
  html[data-scholar-native="android"] body.scholar-android div:has(> .asme-glass-input) {
    max-width: 44vw;
    min-width: 0;
  }

  html[data-scholar-native="android"] body.scholar-android div:has(> .asme-glass-input) > .asme-glass-input {
    width: 100% !important;
  }
}

@media (max-width: 359px) {
  html[data-scholar-native="android"] body.scholar-android form .grid-cols-2,
  html[data-scholar-native="android"] body.scholar-android [role="dialog"] .grid-cols-2:not(.grid-cols-7) {
    grid-template-columns: minmax(0, 1fr) !important;
  }

  html[data-scholar-native="android"] body.scholar-android [role="dialog"] {
    width: calc(100vw - .75rem) !important;
    padding: 1rem !important;
  }
}

/* Wide content scrolls internally instead of widening the entire page. */
html[data-scholar-native="android"] body.scholar-android :where(pre, table, .katex-display, .MathJax, math) {
  max-width: 100% !important;
  overflow-x: auto !important;
  overscroll-behavior-inline: contain;
  -webkit-overflow-scrolling: touch;
}

html[data-scholar-native="android"] body.scholar-android :where(img, video, canvas, iframe, object, embed) {
  max-width: 100%;
}

html[data-scholar-native="android"] body.scholar-android iframe[allowfullscreen] {
  aspect-ratio: 16 / 9;
  height: auto;
}

/* Login/register keep the exact web design while supporting short screens. */
html[data-scholar-native="android"] body.scholar-android:has(input[type="password"]) {
  min-height: var(--scholar-android-vh, 100dvh);
  overflow-y: auto !important;
}

html[data-scholar-native="android"] body.scholar-android:has(input[type="password"]) form {
  max-width: 100%;
}

@media (max-width: 430px), (max-height: 700px) {
  html[data-scholar-native="android"] body.scholar-android:has(input[type="password"]) h1,
  html[data-scholar-native="android"] body.scholar-android:has(input[type="password"]) h2 {
    font-size: clamp(1.35rem, 7vw, 2rem) !important;
    line-height: 1.08 !important;
  }
}

/* AI Tutor/LAM: flexible-height transcript and keyboard-safe composer. */
@media (max-width: 767px) {
  html[data-scholar-native="android"] body.scholar-android .liquid-glass:has(.ai-tutor-scroll):has(textarea) {
    height: calc(var(--scholar-android-vh, 100dvh) - 10.5rem - var(--scholar-android-safe-bottom)) !important;
    min-height: 26rem !important;
  }

  html[data-scholar-native="android"][data-scholar-keyboard-open="true"] body.scholar-android .liquid-glass:has(.ai-tutor-scroll):has(textarea) {
    height: calc(var(--scholar-android-vh, 100dvh) - 1rem) !important;
    min-height: 20rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .prose-neha {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  html[data-scholar-native="android"] body.scholar-android .lam-premium-panel {
    max-height: calc(var(--scholar-android-vh, 100dvh) - .75rem - var(--scholar-android-safe-bottom)) !important;
  }
}

/* Nigtube: stack logo/search, constrain ambient layers, and lift mini player. */
@media (max-width: 480px) {
  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) nav.nt-font {
    align-items: center;
    flex-wrap: wrap;
    gap: .25rem;
    padding: .85rem 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) nav.nt-font > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) nav.nt-font > .nt-glass {
    flex: 1 0 100% !important;
    margin: .65rem 0 0 !important;
    max-width: none !important;
    min-width: 0;
    order: 3;
    width: 100%;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) nav.nt-font input {
    min-width: 0 !important;
    width: 100%;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) .nt-glass-strong {
    max-width: 100%;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) .nt-glass-strong.rounded-3xl {
    padding: 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) .nt-serif.text-4xl {
    font-size: clamp(2rem, 11vw, 2.75rem) !important;
    line-height: .96 !important;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) [class*="blur-[120px]"] {
    max-width: 100vw !important;
    width: 100vw !important;
  }

  html[data-scholar-native="android"] body.scholar-android main:has(nav.nt-font) .fixed.bottom-4.right-4 {
    bottom: calc(68px + var(--scholar-android-safe-bottom)) !important;
    left: .75rem !important;
    right: .75rem !important;
    width: auto !important;
  }
}

/* Reminders and other fixed quick actions sit above the real bottom nav. */
html[data-scholar-native="android"] body.scholar-android #main-scroll [class*="fixed bottom-4 left-1/2"] {
  bottom: calc(68px + var(--scholar-android-safe-bottom)) !important;
}

/* Reusable phone control rails: readable chips, deliberate internal scrolling. */
html[data-scholar-native="android"] body.scholar-android .scholar-filter-rail {
  display: flex !important;
  gap: .65rem !important;
  max-width: 100%;
  overflow-x: auto !important;
  overflow-y: hidden;
  scroll-padding-inline: 1rem;
  scroll-snap-type: x proximity;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

html[data-scholar-native="android"] body.scholar-android .scholar-filter-rail::-webkit-scrollbar {
  display: none;
}

html[data-scholar-native="android"] body.scholar-android .scholar-filter-rail > * {
  flex: 0 0 auto !important;
  min-height: 42px;
  min-width: 3rem;
  padding-inline: 1rem !important;
  scroll-snap-align: start;
  white-space: nowrap;
}

/* Compact sponsor state: never reserve an empty mobile billboard. */
html[data-scholar-native="android"] body.scholar-android .scholar-free-ad-slot {
  min-height: 0;
  margin-bottom: .75rem !important;
  gap: .65rem !important;
  padding: .65rem .75rem !important;
}

html[data-scholar-native="android"] body.scholar-android .scholar-free-ad-slot p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Global promotional toast stays above both Scholar and Android navigation. */
html[data-scholar-native="android"] body.scholar-android aside:has(> button[aria-label="Dismiss Scholar Plus"]) {
  bottom: calc(68px + var(--scholar-android-safe-bottom)) !important;
  max-height: min(19rem, calc(var(--scholar-android-vh, 100dvh) - 7rem)) !important;
  overflow-y: auto;
}

@media (max-width: 480px) {
  /* Landing keeps its editorial drama without clipping into the next section. */
  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero {
    height: auto !important;
    min-height: var(--scholar-android-vh, 100dvh) !important;
    overflow: hidden;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero > nav {
    padding-inline: 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero > div.relative.z-10 {
    height: auto !important;
    min-height: calc(var(--scholar-android-vh, 100dvh) - 8rem);
    padding: 5.5rem 1rem 2rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero .lg-serif.text-5xl {
    max-width: 22rem !important;
    margin-bottom: 1.25rem !important;
    font-size: clamp(2.55rem, 12vw, 3.5rem) !important;
    line-height: .92 !important;
    letter-spacing: -.09rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero .lg-glass.rounded-full.mb-8 {
    max-width: 100%;
    margin-bottom: 1.25rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero .flex.items-center.gap-6.mt-10 {
    width: 100%;
    justify-content: center;
    gap: 1rem !important;
    margin-top: 1.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero > div.absolute.bottom-0 {
    position: relative !important;
    padding: 0 .75rem calc(1rem + var(--scholar-android-safe-bottom)) !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-hero > div.absolute.bottom-0 > div:last-child {
    width: 100%;
    justify-content: space-around;
    gap: .75rem !important;
    overflow: hidden;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-capabilities > div.relative.z-10 {
    min-height: var(--scholar-android-vh, 100dvh) !important;
    padding: 4rem 1rem 2rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-capabilities .lg-serif.text-6xl {
    max-width: 100%;
    font-size: clamp(3.1rem, 16vw, 4.4rem) !important;
    line-height: .9 !important;
    letter-spacing: -.08rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-landing-capabilities .lg-glass-strong.max-w-md {
    margin-block: 2rem !important;
    padding: 1.25rem !important;
  }

  /* Settings becomes a real two-column mobile navigation, not a clipped circle. */
  html[data-scholar-native="android"] body.scholar-android .scholar-settings {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings nav {
    padding: .75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings nav .asme-glass {
    padding: .65rem .8rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings nav .asme-glass button {
    min-height: 40px;
    padding-inline: .85rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings h1.whitespace-nowrap {
    max-width: 100%;
    white-space: normal !important;
    font-size: clamp(2.5rem, 13vw, 3.5rem) !important;
    line-height: .95 !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings-tabs {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100% !important;
    border-radius: 1.5rem !important;
    gap: .35rem !important;
    padding: .4rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-settings-tabs > [role="tab"] {
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    padding: .7rem .8rem !important;
    white-space: nowrap;
  }

  /* Dashboard: efficient edge spacing and calm, readable metric hierarchy. */
  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard > div.relative.z-10 > nav {
    padding: 1rem .9rem .5rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard > div.relative.z-10 > nav > span {
    max-width: 100%;
    font-size: .75rem !important;
    letter-spacing: .18em !important;
    white-space: normal;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard-hero {
    padding: .75rem .9rem 1.25rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard-hero h1 {
    max-width: 23rem;
    font-size: clamp(2.35rem, 11.5vw, 3.4rem) !important;
    line-height: 1 !important;
    margin-bottom: 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard-metrics {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    max-width: 24rem;
    gap: .5rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard-metrics > div {
    min-width: 0;
    justify-content: center;
    padding: .6rem .35rem !important;
    text-align: center;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-dashboard-metrics span {
    font-size: .75rem !important;
    line-height: 1.2;
  }

  /* AI Tutor: two-row fullscreen toolbar and near-full-width conversation. */
  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-header {
    gap: .5rem;
    padding: .65rem .75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-fullscreen-header {
    height: auto !important;
    min-height: 6.6rem;
    flex-wrap: wrap;
    align-content: center;
    gap: .5rem;
    padding: .6rem .75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-fullscreen-header > div:first-child {
    flex: 1 1 100%;
    min-width: 0;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-fullscreen-header > div:last-child {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    gap: .4rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-fullscreen-header > div:last-child button {
    min-width: 0;
    justify-content: center;
    padding-inline: .55rem !important;
    white-space: nowrap;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-fullscreen-messages {
    max-width: none !important;
    padding: .85rem .7rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-message {
    max-width: calc(100% - 2.5rem) !important;
    min-width: 0;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-message :where(h1, h2, h3, p, li) {
    overflow-wrap: break-word;
    word-break: normal;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-ai-tutor-composer {
    padding: .6rem .65rem calc(.6rem + var(--scholar-android-safe-bottom)) !important;
    background: rgba(5, 8, 12, .92);
    backdrop-filter: blur(18px);
  }

  html[data-scholar-native="android"][data-scholar-keyboard-open="true"] body.scholar-android .scholar-ai-tutor-composer {
    padding-bottom: .5rem !important;
  }

  /* Notes: reclaim nested desktop gutters and distribute all three tabs. */
  html[data-scholar-native="android"] body.scholar-android .scholar-notes {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-notes > div.relative.z-10 > nav,
  html[data-scholar-native="android"] body.scholar-android .scholar-notes > div.relative.z-10 > section,
  html[data-scholar-native="android"] body.scholar-android .scholar-notes-tabs,
  html[data-scholar-native="android"] body.scholar-android .scholar-notes-tabs + div {
    padding-inline: .9rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-notes-tabs [role="tablist"] {
    min-height: 48px;
    padding: .25rem;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-notes-tabs [role="tab"] {
    min-width: 0;
    padding-inline: .45rem !important;
    white-space: nowrap;
  }

  /* Feature cards reserve their own badge row instead of overlaying titles. */
  html[data-scholar-native="android"] body.scholar-android .scholar-feature-card {
    padding: .9rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-feature-card .scholar-feature-badge {
    position: static !important;
    display: inline-flex;
    float: right;
    margin: 0 1.8rem .3rem .5rem;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-feature-card h3 {
    padding-right: 0 !important;
    line-height: 1.25;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-feature-card p {
    display: -webkit-box !important;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal !important;
  }

  /* Nigtube uses all available width and a compact, complete pre-roll panel. */
  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-panel {
    width: calc(100% - 1rem) !important;
    border-radius: 1.15rem !important;
    padding: .65rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-panel h3 {
    margin-top: .35rem !important;
    font-size: 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-panel > p,
  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-benefits,
  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-panel > div:last-child {
    display: none !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube .scholar-nigtube-ad-panel > div.mt-6 {
    display: flex !important;
    margin-top: .5rem !important;
    flex-direction: row !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube-fallback {
    align-items: stretch !important;
    flex-direction: column;
    padding: .65rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube-fallback > span {
    white-space: normal;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-nigtube-fallback > a {
    align-self: flex-start;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
  }

  /* Study Music: compact cards and keep every player/promotion above nav. */
  html[data-scholar-native="android"] body.scholar-android .scholar-study-music {
    margin: -.75rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-study-music .mu-glass-strong.rounded-3xl {
    padding: 1rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-study-music .aspect-video {
    max-height: 13rem;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-music-player {
    bottom: calc(var(--scholar-android-bottom-nav-height) + var(--scholar-android-safe-bottom)) !important;
    padding: .5rem .65rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-music-player > div {
    padding: .6rem !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-music-player button {
    min-height: 40px;
    min-width: 40px;
  }
}

/* Tablet WebViews keep desktop identity but constrain panes and overlays. */
@media (min-width: 600px) and (max-width: 768px) {
  html[data-scholar-native="android"] body.scholar-android [role="dialog"] {
    max-width: min(42rem, calc(100vw - 2rem)) !important;
  }

  html[data-scholar-native="android"] body.scholar-android main {
    --scholar-android-tablet-gutter: 1rem;
  }
}

/* Landscape keeps media/chat usable without a tall navigation obstruction. */
@media (orientation: landscape) and (max-height: 600px) and (max-width: 1023px) {
  html[data-scholar-native="android"] body.scholar-android .scholar-bottom-nav {
    height: calc(52px + var(--scholar-android-safe-bottom)) !important;
    min-height: calc(52px + var(--scholar-android-safe-bottom));
    padding-top: 2px !important;
  }

  html[data-scholar-native="android"] body.scholar-android .scholar-bottom-nav button {
    min-height: 42px;
  }

  html[data-scholar-native="android"] body.scholar-android [role="dialog"] {
    max-height: calc(var(--scholar-android-vh, 100dvh) - .5rem) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  html[data-scholar-native="android"] body.scholar-android *,
  html[data-scholar-native="android"] body.scholar-android *::before,
  html[data-scholar-native="android"] body.scholar-android *::after {
    scroll-behavior: auto !important;
  }
}
`;
