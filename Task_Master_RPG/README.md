# 🛡️ Task Master RPG

**Turn your productivity into a game.**
Task Master RPG is a gamified to-do list application that rewards you with XP, levels, and ranks for completing real-world tasks.

🚀 **Live Demo:** [https://task-master-rpg.vercel.app/](https://task-master-rpg.vercel.app/)

## ✨ Features

### 🎮 Gamification

- **XP System:** Earn XP based on task priority (Low: 25xp, Medium: 50xp, High: 100xp).
- **Leveling:** Level up and unlock new ranks (from "Novice Adventurer" to "The Task Master").
- **Streaks:** Maintain a daily streak by completing at least one task every day.
- **Audio Feedback:** Satisfying sound effects when leveling up.

### 📝 Task Management

- **CRUD:** Create, Read, Update, and Delete quests.
- **Priorities:** Assign importance levels to tasks.
- **Deadlines:** Set due dates and see visual warnings for overdue quests.
- **Filtering:** View All, Active, or Completed quests.
- **Sorting:** Sort by Priority (High to Low) or Deadline (Urgent first).
- **Search:** Real-time search filtering.

## 🏗️ Architecture

### Project Structure

```
src/
├── constants/
│   └── gameConfig.js        # Shared game values (XP, ranks, defaults)
├── hooks/
│   └── useTaskManager.js    # Custom hook — all task state & logic
├── components/
│   ├── TaskCard.jsx          # Single quest card (priority, date, XP)
│   ├── QuestInput.jsx        # New quest form with validation
│   ├── GamificationHUD.jsx   # Level, XP bar, streak display
│   ├── DeleteModal.jsx       # Confirmation dialog
│   ├── ToastNotification.jsx # Auto-dismissing popup
│   ├── EmptyState.jsx        # Placeholder when no quests shown
│   ├── FilterPill.jsx        # Filter tab button
│   └── SearchInput.jsx       # Search bar
├── utils/
│   └── FormatDate.js         # Date formatting utility
├── styles/
│   └── theme.css             # Design tokens & component styles
├── App.jsx                   # Root component — XP/level logic + layout
└── main.jsx                  # Entry point
```

### Key Patterns

- **Custom Hook (`useTaskManager`):** Groups all task-related state and logic in one reusable function, keeping the App component focused on UI.
- **Shared Constants (`gameConfig.js`):** XP values, rank titles, and defaults live in one file — single source of truth.
- **`useMemo`:** Caches the filtered/sorted task list to avoid recalculating on every render.
- **`useCallback`:** Keeps function references stable when passing handlers to child components.
- **`useEffect`:** Syncs state to `localStorage` for data persistence.

## ⚙️ Tech Stack

- **Frontend:** React 19, Vite 7
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React
- **Date Picker:** react-datepicker
- **Persistence:** localStorage (data saves automatically)
- **Deployment:** Vercel

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/eldaduz/my-projects.git
   cd my-projects/Task_Master_RPG
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```
