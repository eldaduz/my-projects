// ──────────────────────────────────────────────
// useTaskManager.js — Custom Hook
//
// A custom hook is a regular function whose name
// starts with "use". It lets us group related
// state and logic in one place, outside the
// component, so the component stays short and
// focused on rendering the UI.
//
// This hook manages everything about tasks:
//   - the task list (add / edit / delete / toggle)
//   - filtering and sorting
//   - the delete-confirmation modal
//
// The App component simply calls this hook and
// receives all the data and functions it needs.
// ──────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react';
import { XP_VALUES } from '../constants/gameConfig';

// Load saved quests from the browser's localStorage.
// If nothing is saved or the data is broken, return an empty array.
function loadQuests() {
  try {
    const savedData = localStorage.getItem('quests');
    if (!savedData) return [];

    const parsedData = JSON.parse(savedData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    return [];
  }
}

export default function useTaskManager({ onTaskCompletionChange, showToast }) {
  // ── State ─────────────────────────────────────
  // useState creates a value that React tracks.
  // When we call the setter (e.g. setTasks), React re-renders the UI.

  const [tasks, setTasks] = useState(loadQuests); // all quests
  const [filter, setFilter] = useState('All'); // "All" | "Active" | "Completed"
  const [searchTerm, setSearchTerm] = useState(''); // text typed in the search bar
  const [sortBy, setSortBy] = useState('priority'); // "priority" | "deadline"
  const [editingTaskID, setEditingTaskID] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // ── Side Effect: persist tasks ────────────────
  // useEffect runs code AFTER React finishes rendering.
  // Here we save the task list to localStorage every time it changes,
  // so the data survives a page refresh.
  useEffect(() => {
    try {
      localStorage.setItem('quests', JSON.stringify(tasks));
    } catch {
      console.warn('Failed to save quests to localStorage.');
    }
  }, [tasks]);

  // ── Derived Data: filtered + sorted list ──────
  // useMemo caches a computed value and only recalculates it
  // when one of its dependencies changes.
  // This avoids filtering and sorting the entire list on every render.
  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        // Step 1 — match the active filter tab
        let statusMatch = true;

        if (filter === 'Active') {
          statusMatch = !task.completed;
        } else if (filter === 'Completed') {
          statusMatch = task.completed;
        }

        // Step 2 — match the search text
        const matchSearch = (task.title?.toLowerCase() ?? '').includes(searchTerm.toLowerCase());
        return statusMatch && matchSearch;
      })
      .sort((a, b) => {
        // Sort by priority (high → low) or by deadline (soonest first)
        if (sortBy === 'priority') {
          const left = XP_VALUES[a.priority] ?? 0;
          const right = XP_VALUES[b.priority] ?? 0;
          return right - left;
        }

        if (sortBy === 'deadline') {
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date) - new Date(b.date);
        }

        return 0;
      });
  }, [tasks, filter, searchTerm, sortBy]);

  // ── Actions ───────────────────────────────────
  // useCallback keeps the same function reference between renders.
  // Without it, React would create a brand-new function object on
  // every render and pass it to child components, forcing those
  // children to re-render even if nothing actually changed.

  // Create a new quest and add it to the list.
  const addTask = useCallback((questData) => {
    const newTask = {
      id: crypto.randomUUID(),
      completed: false,
      ...questData,
    };

    setTasks((prevTasks) => [...prevTasks, newTask]);
  }, []);

  // Remove all completed quests (after the user confirms).
  const clearCompleted = useCallback(() => {
    const userConfirm = window.confirm('Are you sure you want to delete all completed quests?');

    if (!userConfirm) return;

    setTasks((prevTasks) => prevTasks.filter((task) => !task.completed));
    showToast('All completed quests are deleted');
  }, [showToast]);

  // Toggle a quest between "completed" and "not completed".
  // Also tells App so it can update XP and level.
  const toggleTaskComplete = useCallback(
    (taskId) => {
      setTasks((prevTasks) => {
        const targetTask = prevTasks.find((task) => task.id === taskId);
        if (!targetTask) return prevTasks;

        const willComplete = !targetTask.completed;
        onTaskCompletionChange(targetTask, willComplete);

        return prevTasks.map((task) =>
          task.id === taskId ? { ...task, completed: willComplete } : task,
        );
      });
    },
    [onTaskCompletionChange],
  );

  // Open the delete-confirmation modal for a specific quest.
  // We read the current task list via the setter function so
  // we don't need to add "tasks" as a dependency.
  const requestDelete = useCallback((id) => {
    setTasks((currentTasks) => {
      const task = currentTasks.find((item) => item.id === id);
      if (task) {
        setTaskToDelete(task);
        setIsDeleteModalOpen(true);
      }
      return currentTasks; // return unchanged — we only read here
    });
  }, []);

  // The user confirmed deletion in the modal.
  const confirmDelete = useCallback(() => {
    if (!taskToDelete) {
      setIsDeleteModalOpen(false);
      return;
    }

    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskToDelete.id));
    setTaskToDelete(null);
    setIsDeleteModalOpen(false);
  }, [taskToDelete]);

  // The user cancelled — close the modal without deleting.
  const cancelDelete = useCallback(() => {
    setIsDeleteModalOpen(false);
    setTaskToDelete(null);
  }, []);

  // Enter edit mode for a specific quest.
  const editTask = useCallback((taskId) => {
    setEditingTaskID(taskId);
  }, []);

  // Save the new title and exit edit mode.
  const saveTask = useCallback((taskId, newTitle) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, title: newTitle } : task)),
    );
    setEditingTaskID(null);
  }, []);

  // ── Return ────────────────────────────────────
  // Everything the App component needs from this hook.
  return {
    tasks,
    filteredTasks,
    filter,
    setFilter,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    editingTaskID,
    isDeleteModalOpen,
    taskToDelete,
    addTask,
    clearCompleted,
    toggleTaskComplete,
    requestDelete,
    confirmDelete,
    cancelDelete,
    editTask,
    saveTask,
  };
}
