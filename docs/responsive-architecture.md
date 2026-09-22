# Scholar responsive architecture

Scholar uses one route and component tree across desktop, tablet, mobile browsers, and the Android WebView. Responsive changes must preserve feature capability and server authorization; there are no `/m` routes or mobile-only APIs.

## Breakpoint philosophy

- Below `640px`: phone composition, compact page gutters, scrollable control rails, and touch-first controls.
- `640px–1023px`: tablet shell with the mobile drawer and bottom navigation.
- `1024px–1180px`: compact desktop/small-laptop treatment; the desktop sidebar remains available.
- Above `1180px`: existing desktop compositions remain the default.

## Shell and safe areas

`AppShell` owns the fixed bottom navigation, mobile drawer, keyboard-open state, and the `--scholar-vvh` visual-viewport variable. Route layouts should use `100dvh` or `.scholar-responsive-page`, not `100vh`. Fixed controls must include `env(safe-area-inset-*)`, and main content reserves the bottom-navigation footprint. When the software keyboard opens, fixed bottom controls are removed from the interaction area.

The Android WebView markers (`data-scholar-native="android"`, `body.scholar-android`, and `ScholarAndroid/1.0`) remain authoritative. Responsive code must not replace or remove them.

## Dialogs and dense controls

Shared dialogs are viewport-bounded and internally scrollable. Feature-specific dialog widths may remain, but content must not exceed the visual viewport. Dense tab/filter/tool groups should use an explicitly labelled horizontal rail or a wrapped grid; the page itself must never become horizontally scrollable.

## Feature-owned immersive layouts

Live Tutor, file preview, PDF/E-Book readers, Group Study, Focus, Nigtube, and Music own their internal scrolling. Their roots consume the visual viewport and coordinate with the shell instead of adding a second fixed navigation layer. Microphone/camera permission and Group Study media mounting remain explicit user actions and must not be changed by responsive refactors.
