// ──────────────────────────────────────────────
// gameConfig.js — Shared game constants
//
// All game-related numbers and labels live here
// so every file uses the same values.
// If we change XP or add a rank, we only update
// this one file.
// ──────────────────────────────────────────────

// How much XP each priority level is worth.
export const XP_VALUES = { High: 100, Medium: 50, Low: 25 };

// Rank titles — the player earns a new title each time they level up.
export const RANK_TITLES = [
  'Novice Adventurer',
  'Scroll Apprentice',
  'Quest Ranger',
  'Knight of the Realm',
  'Dungeon Raider',
  'Archmage of Focus',
  'Grand Paladin',
  'Dragon Slayer',
  'Demi-God',
  'The Task Master',
];

// Starting values for a brand-new player.
// Also used as a safe fallback when localStorage is empty.
export const DEFAULT_USER_DATA = {
  level: 1,
  currentXP: 0,
  maxXP: 100,
  streak: 0,
  lastActiveDate: null,
};

// Timezone used for the daily-streak calculation.
export const APP_TIMEZONE = 'Asia/Jerusalem';
