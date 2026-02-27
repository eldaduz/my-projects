# 💻 Code Dojo

Code Dojo is a split-screen coding practice game built with React + Vite.

Users solve JavaScript exercises, submit answers for Gemini-powered feedback, and progress through a gamified XP + level system.

## ✨ Features

- **Split-screen UI**
  - Left: task panel (title, description, progress, filters)
  - Right: code editor, controls, score, and feedback
- **Gemini API key onboarding modal**
  - Save + verify API key before using evaluations
- **AI code evaluation**
  - Returns score and feedback for submitted solutions
- **Gamification**
  - XP rewards per exercise
  - 10 nerd-themed levels
  - XP progress bar
  - Hint usage reduces earned XP
- **Exercise filtering**
  - Difficulty: `easy`, `medium`, `hard`
  - Topics: e.g. `map`, `filter`, `reduce`, `async`
- **Markdown feedback rendering**
  - Uses `react-markdown` for readable output
- **Local persistence**
  - API key + session data in `localStorage`

## 🧱 Tech Stack

- React 18
- Vite 5
- JavaScript (ES6+)
- `react-markdown`
- Google Gemini API (`gemini-2.5-flash`)

## 🚀 Getting Started

### 1) Install dependencies

```bash
npm install
