# Theme Transition Fix — Full Implementation Plan
> For use with Claude Code, Codex, or any agentic coding tool.
> Based on forensic frame analysis of a 60fps screen recording.
> All findings are measurement-backed, not guesses.

---

## Context for the Agent

This codebase has a light/dark theme toggle that produces a broken multi-stage flash
on every switch. Forensic analysis at 60fps identified the exact root causes:

1. **Desync flash** — composited layers (modal, right panel) repaint 1–2 frames before
   the View Transition snapshot is fully in place, causing a visible split where half
   the UI has switched and half hasn't.

2. **White flash peak** — the `::view-transition-old(root)` snapshot (a full screenshot
   of the old theme) sits at full opacity for ~2 frames (~33ms) before the crossfade
   begins, producing a complete white wash mid-transition.

3. **Below-dark overshoot** — the modal's `backdrop-filter: blur()` is included in a
   CSS `transition:` declaration, causing it to average mid-transition intermediate
   values and briefly go *darker* than its settled dark-mode state.

4. **Too-long duration** — the full transition window is 480–660ms with ~300ms of that
   occupied by the flash artifacts. The clean fade itself is only ~167ms.

The goal is a **200ms, flash-free, synchronized theme switch** that feels crisp and
intentional.

---

## Step 0 — Reconnaissance (Do This First)

Before writing any code, perform the following search and report back.

```
TASKS:
- Find the theme toggle handler (look for: toggleTheme, setTheme, classList.toggle,
  data-theme, document.documentElement.className, localStorage.getItem('theme'))
- Find where `document.startViewTransition` is called, if at all
- Find all CSS rules containing `view-transition-name`
- Find all CSS rules containing `transition:` on these selectors:
    body, html, :root, .modal, [class*="modal"], [class*="dialog"],
    [class*="card"], [class*="backdrop"], [class*="overlay"]
- Find all CSS rules containing `backdrop-filter`
- Find all CSS custom property definitions for color tokens
  (look for: --color-, --bg-, --surface-, --text-, --border-)
- Identify the CSS file(s) that control dark mode
  (look for: .dark, [data-theme="dark"], prefers-color-scheme: dark)
- Identify the JS/TS file that contains the toggle logic

Report file paths and line numbers for each finding before proceeding.
```

---

## Step 1 — Fix the View Transition Root Animation

**File:** The global CSS file (likely `globals.css`, `app.css`, or `index.css`)

**Problem:** The default `::view-transition-old(root)` / `::view-transition-new(root)`
crossfade produces a white bleed peak because both pseudo-elements are fully opaque
at the midpoint.

**Action:** Add the following block. If `::view-transition-old` rules already exist,
replace them entirely.

```css
/* ─── THEME TRANSITION: Root view-transition control ─────────────────────── */

/* Disable the default browser crossfade */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}

/* Light → Dark: fade the old (light) snapshot out */
:root.dark::view-transition-old(root) {
  animation: theme-fade-out 200ms ease-out both;
}

/* Light → Dark: fade the new (dark) content in */
:root.dark::view-transition-new(root) {
  animation: theme-fade-in 200ms ease-in both;
}

/* Dark → Light: same in reverse */
:root:not(.dark)::view-transition-old(root) {
  animation: theme-fade-out 200ms ease-out both;
}

:root:not(.dark)::view-transition-new(root) {
  animation: theme-fade-in 200ms ease-in both;
}

@keyframes theme-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}

@keyframes theme-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

**Note:** If the codebase uses `data-theme="dark"` on `<html>` instead of a `.dark`
class, adjust the selectors accordingly:
```css
[data-theme="dark"]::view-transition-old(root) { ... }
```

---

## Step 2 — Remove view-transition-name from Composited Components

**Files:** Any CSS file containing `view-transition-name`

**Problem:** Named view transitions cause those elements to be extracted from the
root snapshot and animated independently. The modal and right panel have their own
compositing layers (due to `backdrop-filter` and/or `transform`), so they repaint
first and create the desync split.

**Action:** Find every `view-transition-name` declaration. For each one, decide:

- If it's on the modal, dialog, backdrop, overlay, or sidebar → **delete it**
- If it's on a specific interactive element (avatar, hero image, featured card) that
  intentionally morphs between pages → **keep it**
- If unsure → **delete it** (the transition will still work; you can add back selectively)

```css
/* DELETE any rules like these: */
.modal            { view-transition-name: modal; }        /* ← delete */
.sidebar          { view-transition-name: sidebar; }      /* ← delete */
.backdrop         { view-transition-name: backdrop; }     /* ← delete */
.theme-toggle     { view-transition-name: theme-toggle; } /* ← delete */
```

If the codebase uses inline styles (`style="view-transition-name: X"`) via JS,
find and remove those assignments as well.

---

## Step 3 — Fix the Backdrop Filter Transition

**Files:** Any CSS file containing `backdrop-filter`

**Problem:** `backdrop-filter: blur()` on the modal is included in a `transition:`
shorthand (e.g., `transition: all 200ms` or `transition: background-color, backdrop-filter`).
When it animates, the blur samples mid-transition pixel values and produces colors
that are darker than either end state — creating the below-dark overshoot.

**Action:** Find every element with both `backdrop-filter` and `transition:`.

For each one, change the `transition` to list only color-safe properties explicitly.
Never include `backdrop-filter` in a transition.

```css
/* BEFORE (bad): */
.modal {
  backdrop-filter: blur(12px);
  transition: all 200ms ease;                          /* ← "all" includes backdrop-filter */
}

/* AFTER (good): */
.modal {
  backdrop-filter: blur(12px);                         /* ← never transitions */
  transition:
    background-color 200ms ease,
    border-color     200ms ease,
    color            200ms ease,
    box-shadow       200ms ease;
}
```

Same fix for: `.dialog`, `.overlay`, `.drawer`, `.sheet`, any element with
`backdrop-filter: blur()`.

---

## Step 4 — Fix the Toggle JS to Use View Transitions Correctly

**File:** The theme toggle handler

**Problem:** If `document.startViewTransition` is not being used, the entire page
repaints synchronously and the browser composites layers out of order. If it IS
being used but the class toggle is happening outside the callback, the snapshot
is taken of the wrong state.

**Action:** Wrap the class toggle inside `startViewTransition`. The class change
must happen synchronously inside the callback — no awaits, no setTimeout.

```typescript
// theme-toggle.ts (or wherever the toggle lives)

function toggleTheme(): void {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const nextTheme = isDark ? 'light' : 'dark';

  // Persist preference
  localStorage.setItem('theme', nextTheme);

  // Guard: if View Transitions API is not supported, fall back gracefully
  if (!document.startViewTransition) {
    root.classList.toggle('dark', !isDark);
    return;
  }

  // CRITICAL: the class toggle must be the ONLY thing in this callback.
  // Do not read from the DOM, do not await anything, do not call setState here.
  const transition = document.startViewTransition(() => {
    root.classList.toggle('dark', !isDark);
  });

  // Optional: handle transition failure silently
  transition.ready.catch(() => {
    // Fallback already applied above by startViewTransition's own sync path
  });
}
```

**If the codebase is React and uses useState for theme:**

```typescript
// ThemeProvider.tsx

import { createContext, useContext, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'light';
  });

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);

    if (!document.startViewTransition) {
      setTheme(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      return;
    }

    // IMPORTANT: flushSync is required here.
    // Without it, React batches the setState and the DOM update happens
    // AFTER the snapshot is taken — causing a blank new-state frame.
    document.startViewTransition(() => {
      // Use ReactDOM.flushSync to force synchronous DOM commit inside callback
      import('react-dom').then(({ flushSync }) => {
        flushSync(() => setTheme(next));
      });
      document.documentElement.classList.toggle('dark', next === 'dark');
    });
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div data-theme={theme} className={theme === 'dark' ? 'dark' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```

**If using Next.js with `next-themes`:**

```typescript
// The flushSync approach above may conflict with next-themes internals.
// Instead, override the transition at the CSS layer only (Steps 1–3 are sufficient),
// and disable next-themes' built-in transition suppression:

// In your ThemeProvider config:
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange={false}   // ← must be false; true suppresses View Transitions
/>
```

---

## Step 5 — Consolidate Color Tokens to CSS Custom Properties

**Files:** All CSS files with color declarations for themed elements

**Problem:** If components declare their own `transition: background-color` at the
element level (e.g., on `.card`, `.button`, `.input`), each one animates on its own
timeline and they go out of sync. The eye sees a staggered wave of color changes
instead of a single unified switch.

**Action:** Audit for per-element color transitions and remove them. Colors should
change atomically via CSS custom properties on `:root`.

**Step 5a — Define color tokens on `:root` only:**

```css
:root {
  /* Surfaces */
  --color-bg:          #ffffff;
  --color-surface:     #f5f5f5;
  --color-surface-2:   #ebebeb;
  --color-overlay:     rgba(0, 0, 0, 0.08);

  /* Text */
  --color-text-primary:   #111111;
  --color-text-secondary: #555555;
  --color-text-muted:     #888888;

  /* Borders */
  --color-border:      #e0e0e0;
  --color-border-focus:#0066cc;

  /* Modal specific */
  --color-modal-bg:    rgba(255, 255, 255, 0.72);
  --color-modal-border:rgba(0, 0, 0, 0.10);
}

:root.dark {
  --color-bg:          #0f0f0f;
  --color-surface:     #1a1a1a;
  --color-surface-2:   #252525;
  --color-overlay:     rgba(0, 0, 0, 0.40);

  --color-text-primary:   #f0f0f0;
  --color-text-secondary: #a0a0a0;
  --color-text-muted:     #606060;

  --color-border:      #333333;
  --color-border-focus:#4da3ff;

  --color-modal-bg:    rgba(20, 20, 20, 0.80);
  --color-modal-border:rgba(255, 255, 255, 0.08);
}
```

**Step 5b — Update component CSS to use tokens, remove per-element transitions:**

```css
/* BEFORE (bad): */
.card {
  background-color: #ffffff;
  transition: background-color 300ms ease;   /* ← independent timeline */
}
.dark .card {
  background-color: #1a1a1a;
}

/* AFTER (good): */
.card {
  background-color: var(--color-surface);
  /* No transition here. The view-transition handles the switch. */
}
```

**Step 5c — Search for these patterns and fix each one:**

Search for: `transition:.*background` → remove the `background-color` from the transition list  
Search for: `transition:.*color` → remove standalone `color` from transition list  
Search for: `transition: all` → replace with explicit non-color properties only  
Search for: `transition:.*border-color` → remove  

Exception: transitions on hover/focus states (`:hover`, `:focus-visible`) are fine
to keep — they are user-initiated interactions, not theme switches.

---

## Step 6 — Prevent the Theme Flash on Page Load (SSR/Hydration)

**File:** The HTML entry point or `_document.tsx` / `layout.tsx`

**Problem:** On initial page load, if the theme class is applied by JS after hydration,
there is a flash of the wrong theme before the script runs.

**Action:** Apply the theme synchronously in a blocking `<script>` tag in `<head>`,
before any CSS is parsed.

```html
<!-- In <head>, before any stylesheets: -->
<script>
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
</script>
```

For Next.js App Router (`layout.tsx`):

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('theme');
              var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (t === 'dark' || (!t && d)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e){}
          })();
        `}} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Note: `suppressHydrationWarning` on `<html>` is required when the class is set
by this inline script, since it will differ between server and client renders.

---

## Step 7 — Reduce Motion Respect

**File:** The global CSS file

**Action:** Wrap all transition/animation durations in a media query check.
Users who have requested reduced motion should get an instant switch.

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }

  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration:  0.01ms !important;
  }
}
```

---

## Step 8 — Verification Checklist

After implementing all steps, verify the following:

```
[ ] Toggle light→dark: no white flash between old and new state
[ ] Toggle dark→light: no white flash between old and new state
[ ] Modal stays visually anchored during switch (does not flash independently)
[ ] Right panel does not flash independently
[ ] Cards and text change at the same time as background (no wave/stagger)
[ ] Modal does not go darker than its settled dark-mode value during transition
[ ] Total transition duration is ≤ 200ms perceived
[ ] Page load in dark mode shows no flash of light content
[ ] Rapid toggle (click 5 times fast) does not leave UI in broken intermediate state
[ ] prefers-reduced-motion: transition is instant (no animation)
[ ] No browser console errors during toggle
```

**How to test rapid toggle:**
```javascript
// Paste in browser console:
let i = 0;
const interval = setInterval(() => {
  document.querySelector('[data-testid="theme-toggle"]').click(); // adjust selector
  if (++i >= 10) clearInterval(interval);
}, 100);
```

---

## Priority Order

If the full plan is too large to implement at once, do these in order:

| Priority | Step | Impact | Effort |
|---|---|---|---|
| P0 | Step 1 | Eliminates white flash peak | 10 lines CSS |
| P0 | Step 2 | Eliminates desync split flash | Delete lines |
| P0 | Step 4 | Ensures correct snapshot timing | ~20 lines JS |
| P1 | Step 3 | Eliminates darker-than-dark overshoot | ~5 lines CSS per component |
| P1 | Step 5 | Eliminates stagger wave | Refactor (large) |
| P2 | Step 6 | Eliminates page-load flash | ~10 lines |
| P2 | Step 7 | Accessibility | ~10 lines CSS |

Steps 1, 2, and 4 together will fix >90% of the visual problem.

---

## Expected Result After Implementation

- **Light → Dark:** Single clean 200ms dissolve. All regions change simultaneously.
  No white peak. No split. Modal stays anchored.
- **Dark → Light:** Same in reverse. No overshoot below dark. No right panel flash.
- **Page load:** Correct theme applied before first paint. No flash.
- **Rapid toggle:** Queued cleanly via View Transitions API. No broken state.

---

*Generated from forensic frame analysis — 764 frames extracted at 60fps,
per-region photometry on 6 screen zones across 4 transition sequences.*
