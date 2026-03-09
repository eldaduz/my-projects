# Code Dojo — UI Implementation Plan

> **Reference Images:** See `design/ui_light_theme.png` and `design/ui_dark_theme.png` in this project.
> This plan describes the exact visual implementation based on those mockups.
> The current `styles.css` CSS variables are a good foundation — this plan specifies the **component layouts and visual details** to match the mockups.

---

## Overall Layout

The app uses a **full-height layout** with three vertical sections:

```
┌──────────────────────────────────────────────────────┐
│                    TOP BAR (HUD)                     │  ~64px height
├────────────────────────┬─────────────────────────────┤
│                        │                             │
│   LEFT PANEL           │   RIGHT PANEL               │
│   (Exercise Details)   │   (Code Editor + Output)    │
│   ~40% width           │   ~60% width                │
│                        │                             │
│                        │                             │
│                        │                             │
│                        │                             │
└────────────────────────┴─────────────────────────────┘
```

- On screens < 900px, stack vertically (left panel on top, editor below).
- The body has a subtle radial gradient background (warm gold top-left, muted green top-right, fading to `--bg-primary`).

---

## 1. Top Bar (Game HUD)

Height: `64px`. Background: `var(--bg-card)` with `var(--border-subtle)` bottom border, `var(--shadow-sm)`.

### Layout (flexbox, space-between, align-center):

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🏯 Code Dojo    [Lvl 12] ████████░░ 345/1000 XP  +50XP    User ▾  │
│                  badge    progress bar             today   🔥 3     │
└─────────────────────────────────────────────────────────────────────┘
```

### Left Group:

- **Logo**: Dojo/torii gate icon (use emoji 🏯 or ⛩️ as placeholder) + "Code Dojo" text
  - Font: Inter 700, 20px, `var(--text-primary)`
  - Icon: 24px, slight golden tint

### Center Group:

- **Level Badge**: Small shield/hexagon shape with level number inside
  - Background: the belt color for current level (use `--belt-*` variables)
  - Text: white, bold, 13px
  - Label "Lv" prefix, e.g. "Lv 12"
  - `border-radius: 8px`, `padding: 4px 10px`
- **XP Progress Bar**:
  - Width: `200px`, height: `12px`
  - Background: `var(--progress-bg)`
  - Fill: `var(--progress-fill)` (golden gradient)
  - `border-radius: 6px`
  - Has a subtle inner glow/shimmer animation on the fill
  - Text below or beside: `"345 / 1,000 XP"` in `var(--text-muted)`, 12px
- **Today's XP**: "+50 XP Today" badge
  - `color: var(--xp-color)`, 13px, bold
  - Subtle gold glow or sparkle effect

### Right Group:

- **User Display Name**: "ShogunCoder" or user's display name
  - Font: 14px, `var(--text-primary)`
- **Streak Badge**: 🔥 + number
  - `color: var(--streak-color)`
  - Font: 14px bold
  - Text: e.g. "🔥 3 daily streak"
- **Settings Icon** (gear ⚙️): opens profile/settings panel
- **Theme Toggle**: sun/moon icon button
- **Admin Button** (if admin): "Admin" pill button, subtle styling

---

## 2. Left Panel — Exercise Details

Background: `var(--bg-card)`, `border-radius: 16px`, `box-shadow: var(--shadow-md)`.
Border: `1px solid var(--border-subtle)`.
Padding: `24px`. Margin: `12px`.
Overflow-y: `auto`, max-height: `calc(100vh - 88px)`.

### Content (top to bottom):

#### 2a. Exercise Title Section

```
📋 Title:
   Implement Bubble Sort                    [Medium]
```

- Small label "Title:" in `var(--text-muted)`, 12px uppercase
- Exercise title: Inter 700, 24px, `var(--text-primary)`
- **Difficulty Badge** (inline, top-right or after title):
  - Pill shape: `border-radius: 20px`, `padding: 4px 14px`
  - Easy: `background: var(--easy-bg)`, `color: var(--easy-text)`, `border: 1px solid var(--easy-border)`
  - Medium: `background: var(--medium-bg)`, `color: var(--medium-text)`, `border: 1px solid var(--medium-border)`
  - Hard: `background: var(--hard-bg)`, `color: var(--hard-text)`, `border: 1px solid var(--hard-border)`
  - Font: 12px, bold, uppercase

#### 2b. Points Display

```
☆ Points:
   50 XP
```

- Label "Points:" in `var(--text-muted)`, 12px
- Value: `var(--xp-color)`, 18px, bold

#### 2c. Topic Tags

```
◇ Topic Tags:
   [Algorithms]  [Data Structures]  [Array]  [Sorting]
```

- Label "Topic Tags:" in `var(--text-muted)`, 12px
- Each tag: pill chip with `background: var(--bg-elevated)`, `border: 1px solid var(--border-default)`, `border-radius: 20px`, `padding: 4px 12px`, `color: var(--text-secondary)`, font 12px
- Tags wrap to multiple lines if needed

#### 2d. Objective / Problem Statement

```
◎ Objective:
   Write a function `bubbleSort(arr)` that sorts an array
   of numbers in ascending order using the bubble sort algorithm.
```

- Label: "Objective:" in `var(--text-muted)`, 12px
- Body text: `var(--text-primary)`, 14px, line-height 1.6
- Code inline: `background: var(--bg-input)`, `padding: 2px 6px`, `border-radius: 4px`, monospace font

#### 2e. Examples (if present in exercise description)

- Code block style: `background: var(--bg-input)`, `border-radius: 8px`, `padding: 12px`, monospace font 13px
- Copy button (clipboard icon) top-right corner of code block

#### 2f. Constraints

- Bullet list with `var(--text-secondary)`, 13px

#### 2g. Bottom Bar (within left panel)

- **Hint Button**: "💡 Use Hint (-35% XP)"
  - Ghost button style: `background: transparent`, `border: 1px solid var(--border-default)`, `color: var(--text-secondary)`
  - On hover: `background: var(--bg-elevated)`
- **Bookmark Button**: Heart ♡ / ♥ toggle
  - Unfilled: `var(--text-muted)`
  - Filled: `var(--coral-500)`
- **Timer** (optional): MM:SS countdown
  - Color transitions: green > 50%, amber 25-50%, coral < 25%

---

## 3. Right Panel — Code Editor + Output

Background: `var(--bg-card)`, `border-radius: 16px`, `box-shadow: var(--shadow-md)`.
Border: `1px solid var(--border-subtle)`.
Padding: `0` (editor fills the card). Margin: `12px`.

### 3a. Editor Header Bar

```
┌─────────────────────────────────────────────────────┐
│  Bubble Sort Challenge       ▶ RUN CODE    SUBMIT   │
└─────────────────────────────────────────────────────┘
```

- Background: `var(--bg-elevated)`, `border-radius: 16px 16px 0 0`
- Padding: `12px 16px`
- **Title**: Exercise title, 14px, `var(--text-secondary)`
- **Run Code button** (FUTURE — not implemented yet, can be a disabled placeholder):
  - `background: var(--emerald-600)`, white text, `border-radius: 8px`, `padding: 8px 16px`
  - Icon: ▶ play triangle
- **Submit button**:
  - `background: transparent`, `border: 2px solid var(--emerald-500)`, `color: var(--emerald-500)`
  - `border-radius: 8px`, `padding: 8px 20px`, font 14px bold
  - On hover: `background: var(--emerald-500)`, `color: white`
  - While submitting: show spinner, disable button

### 3b. Code Editor (CodeMirror)

- **Mac-style window dots** at top-left of the editor area: three circles (red, yellow, green), 10px each, decorative only
- Copy button (clipboard icon) at top-right
- Editor fills remaining space, min-height: `400px`
- Dark theme: use `@codemirror/theme-one-dark`
- Light theme: default CodeMirror light theme
- Line numbers: `var(--text-muted)`, subtle
- Font: `'Menlo', 'Monaco', 'Courier New', monospace`, 14px

### 3c. Console / Output Area (below editor)

- Separator: `1px solid var(--border-subtle)`
- Height: `120px`, overflow-y auto
- Background: slightly darker than card: `var(--bg-input)`
- Label: `">_ "` prefix in `var(--text-muted)`
- **Results section** (after submission):
  - "Results:" header
  - "✅ Passed 4/4 Tests" or similar in `var(--emerald-500)`

---

## 4. Feedback Panel (appears after submission)

Replaces or overlays the console area. Can also be a modal/slide-in.

### Score Ring

```
     ╭───╮
     │ 85│
     ╰───╯
     Score
```

- **Circular progress ring**: SVG circle, 100px diameter
  - Stroke width: 8px
  - Background track: `var(--progress-bg)`
  - Fill color:
    - Score ≥ 80: `var(--emerald-500)`
    - Score 50-79: `var(--amber-500)`
    - Score < 50: `var(--coral-500)`
  - Score number centered inside: 32px bold
  - Label "Score" below: 12px, `var(--text-muted)`

### XP Earned

- `"+45 XP"` in `var(--xp-color)`, 18px bold
- Subtle sparkle/fade-in animation

### Feedback Text

- Rendered with `react-markdown`
- Sections have subtle dividers
- Code snippets in feedback: same styling as editor code blocks

---

## 5. Difficulty Badge Component

Used in exercise list cards and exercise detail panel.

```css
.difficulty-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.difficulty-pill.easy {
  background: var(--easy-bg);
  color: var(--easy-text);
  border: 1px solid var(--easy-border);
}
.difficulty-pill.medium {
  background: var(--medium-bg);
  color: var(--medium-text);
  border: 1px solid var(--medium-border);
}
.difficulty-pill.hard {
  background: var(--hard-bg);
  color: var(--hard-text);
  border: 1px solid var(--hard-border);
}
```

---

## 6. Exercise List View

Grid of exercise cards. Accessible from a sidebar icon or navigation.

### Card Layout:

```
┌──────────────────────────────────┐
│ ✅ Find Duplicates in Array      │
│ [Easy] · Arrays, HashMap        │
│ ☆ 100 XP · ⏱ 10 min · 73% rate │
│                            ♡    │
└──────────────────────────────────┘
```

- Card: `background: var(--bg-card)`, `border-radius: 12px`, `border: 1px solid var(--border-subtle)`, `padding: 16px`
- Status icon: ✅ solved (green) / 🟡 attempted (amber) / ○ unsolved (muted)
- Title: 16px, 600 weight
- Difficulty pill (inline)
- Topic tags: smaller pills, 11px
- Stats row: XP, estimated time, solve rate — 12px, `var(--text-muted)`
- Bookmark heart: bottom-right
- Hover: `border-color: var(--emerald-500)`, `transform: translateY(-2px)`, `box-shadow: var(--shadow-md)`

### Filters Bar (above grid):

- Difficulty toggles: Easy / Medium / Hard (pill buttons, toggle-able)
- Category dropdown
- Status filter: All / Solved / Attempted / Unsolved
- Search input: `background: var(--bg-input)`, `border-radius: 8px`, icon prefix 🔍

---

## 7. Auth Modal

Centered card, `max-width: 420px`, `border-radius: 16px`, `background: var(--bg-card)`, `box-shadow: var(--shadow-lg)`.

### Tabs:

- "Sign In" / "Sign Up" — underline-style tabs
- Active tab: `border-bottom: 2px solid var(--emerald-500)`, `color: var(--text-primary)`
- Inactive: `color: var(--text-muted)`

### Form Fields:

- Label: 12px, `var(--text-secondary)`, uppercase
- Input: `background: var(--bg-input)`, `border: 1px solid var(--border-default)`, `border-radius: 8px`, `padding: 12px 16px`, `color: var(--text-primary)`, 14px
- Focus: `border-color: var(--emerald-500)`, subtle glow `box-shadow: 0 0 0 3px rgba(31,186,132,0.15)`
- Submit button: full width, `background: var(--emerald-500)`, white text, `border-radius: 10px`, 16px, `padding: 14px`

---

## 8. API Key Setup

Card layout similar to Auth Modal. Step-by-step wizard feel.

### Steps (numbered circles):

```
  ①  Visit Google AI Studio  ──────  ②  Create API Key  ──────  ③  Paste Below
  ●                                  ○                           ○
```

- Active step: `background: var(--emerald-500)`, white number
- Completed step: `background: var(--emerald-500)`, white checkmark ✓
- Future step: `background: var(--bg-elevated)`, `color: var(--text-muted)`
- Connector line between steps: `background: var(--border-default)`, 2px

### Key Input:

- `type="password"` with show/hide toggle (eye icon)
- Save button: emerald primary style

### Status:

- ✅ "API key saved" — green text
- ⚠️ "No API key yet" — amber text

---

## 9. Admin Dashboard

Full-page view with data table.

### Summary Cards (top row, 4 cards):

```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│   👥 156   │ │   📝 2,340 │ │ ⭐ 78.3    │ │ 📖 Array   │
│ Total Users│ │ Submissions│ │  Avg Score  │ │ Top Exercise│
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

- Each card: `background: var(--bg-card)`, `border-radius: 12px`, `padding: 20px`, `text-align: center`
- Number: 28px bold, `var(--text-primary)`
- Label: 12px, `var(--text-muted)`

### Users Table:

- Header row: `background: var(--bg-elevated)`, `color: var(--text-muted)`, 12px uppercase
- Body rows: `border-bottom: 1px solid var(--border-subtle)`, `padding: 12px`
- Hover: `background: var(--bg-elevated)`
- Columns: Name, Email, Level (with belt color dot), XP, Streak, Exercises Done, Joined
- Clickable rows → expand to show submissions

---

## 10. Leaderboard

### Table Layout:

```
 #   Name           Level           XP      Streak
 1   🥇 Alice       ⭐ Master       2,150   🔥 45
 2   🥈 Bob         🖤 Black Belt   1,890   🔥 12
 3   🥉 Charlie     ❤️ Red Belt     1,450   🔥 8
 ─────────────────────────────────────────────────
 27  → You          💚 Green Belt   480     🔥 3    ← highlighted row
```

- Top 3: gold/silver/bronze medal emoji
- Current user row: `background: rgba(31,186,132,0.08)`, `border-left: 3px solid var(--emerald-500)`
- Belt color shown as a small dot or the belt emoji from the levels system

---

## 11. Sidebar Navigation (Optional Enhancement)

Left edge, narrow (60px collapsed, 200px expanded).

Icons (vertical):

- 🏠 Home (exercise view)
- 📋 Exercise List
- 🏆 Leaderboard
- 👤 Profile
- ⚙️ Settings
- 👑 Admin (if admin)

Active icon: `background: var(--bg-elevated)`, `border-left: 3px solid var(--emerald-500)`

---

## 12. Animations & Micro-interactions

- **All interactive elements**: `transition: all 0.18s ease`
- **Card hover**: `transform: translateY(-2px)`, shadow deepens
- **Button hover**: darken 10% on primary buttons, add background on ghost buttons
- **XP earned popup**: fade-in + slight scale-up (`transform: scale(0.9) → scale(1)`, `opacity: 0 → 1`), 0.3s ease-out
- **Score ring**: animate fill from 0% to final score over 0.8s
- **Theme switch**: `transition: background-color 0.3s, color 0.3s` on body and all cards
- **Streak fire**: subtle pulse animation on the 🔥 emoji (scale 1 → 1.1 → 1, 2s infinite)
- **Belt badge**: subtle glow matching belt color

---

## 13. Typography Scale

| Element                          | Size | Weight | Color                     |
| -------------------------------- | ---- | ------ | ------------------------- |
| Page title (Code Dojo)           | 20px | 700    | `--text-primary`          |
| Exercise title                   | 24px | 700    | `--text-primary`          |
| Section labels (Title:, Points:) | 12px | 600    | `--text-muted`, uppercase |
| Body text                        | 14px | 400    | `--text-primary`          |
| Secondary text                   | 13px | 400    | `--text-secondary`        |
| Muted text / stats               | 12px | 400    | `--text-muted`            |
| Buttons                          | 14px | 600    | varies                    |
| Code / monospace                 | 14px | 400    | Menlo/Monaco              |
| Score number (in ring)           | 32px | 700    | score color               |
| XP display                       | 18px | 700    | `--xp-color`              |

---

## 14. Button Styles

### Primary (Submit, Save):

```css
background: var(--emerald-500);
color: #fff;
border: none;
border-radius: 10px;
padding: 10px 24px;
font-weight: 600;
cursor: pointer;
```

Hover: `background: var(--emerald-600)`

### Secondary (outlined):

```css
background: transparent;
color: var(--emerald-500);
border: 2px solid var(--emerald-500);
border-radius: 10px;
padding: 10px 24px;
font-weight: 600;
```

Hover: `background: var(--emerald-500); color: #fff`

### Ghost (Hint, secondary actions):

```css
background: transparent;
color: var(--text-secondary);
border: 1px solid var(--border-default);
border-radius: 8px;
padding: 8px 16px;
```

Hover: `background: var(--bg-elevated)`

### Danger (Delete):

```css
background: transparent;
color: var(--coral-500);
border: 1px solid var(--coral-500);
border-radius: 8px;
```

Hover: `background: var(--coral-500); color: #fff`
