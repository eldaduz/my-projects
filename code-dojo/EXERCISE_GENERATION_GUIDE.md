# Code Dojo — Exercise Generation Guide

> **How to use:** Copy this entire prompt and paste it into any AI (ChatGPT, Gemini, Claude).  
> Tell it how many exercises you want and which topics to focus on.  
> It will output a JSON array you can directly import into Code Dojo.

---

## Prompt to Generate Exercises

```
You are an exercise creator for "Code Dojo", a JavaScript & React coding practice platform (similar to LeetCode). Generate exercises that users will solve in a browser code editor, then an AI evaluator will score their solution 0-100.

## Exercise JSON Schema

Return a JSON array. Each exercise MUST have ALL of these fields:

{
  "id": "string — unique kebab-case id, e.g. 'array-flatten-deep'",
  "difficulty": "easy | medium | hard",
  "topics": ["array of topic tags, e.g. 'array', 'map', 'closure', 'react-hooks'"],
  "category": "string — one of: fundamentals | data-structures | algorithms | async | dom | react | patterns",
  "title": "string — short descriptive title",
  "description": "string — clear problem statement. Include:\n  - What the function should do\n  - Input/output types\n  - 2-3 example inputs and expected outputs\n  - Edge cases to handle\n  - Constraints",
  "starterCode": "string — function skeleton with // Your code here placeholder. Include example usage with console.log at the bottom.",
  "testCases": [
    { "input": "the input value(s)", "expected": "the expected output", "description": "what this tests" }
  ],
  "hint": "string — a helpful nudge without giving away the answer",
  "solutionApproach": "string — brief explanation of optimal approach + time/space complexity",
  "baseXp": "number — easy: 100-150, medium: 160-220, hard: 230-300",
  "estimatedMinutes": "number — easy: 5-15, medium: 15-30, hard: 30-60"
}

## Topic Tags (use these)

### JavaScript Fundamentals
variables, types, operators, strings, template-literals, destructuring, spread, rest, ternary

### Functions
functions, arrow-functions, closure, scope, hoisting, iife, currying, composition, recursion, memoization

### Arrays
array, map, filter, reduce, find, some, every, flat, sort, slice, splice, includes

### Objects
object, keys, values, entries, assign, freeze, prototype, this, class, getters-setters

### Async
async, promises, async-await, fetch, callbacks, event-loop, setTimeout, microtasks

### Data Structures
linked-list, stack, queue, hash-map, set, tree, graph, heap

### Algorithms
sorting, searching, binary-search, two-pointers, sliding-window, dynamic-programming, greedy, bfs, dfs, backtracking

### DOM & Browser
dom, events, event-delegation, local-storage, fetch-api, web-api

### React
react-hooks, useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, custom-hooks, react-state, react-props, react-events, react-forms, react-lists, react-conditional, react-lifecycle, react-context, react-patterns

### Design Patterns
patterns, singleton, observer, factory, module, decorator, strategy, mediator, pub-sub

## Rules for Creating Good Exercises

1. **Description must be precise** — include input types, output types, and 2-3 concrete examples with expected output
2. **starterCode must be runnable** — include a function skeleton AND example console.log calls
3. **testCases** — at least 3: one basic, one edge case, one complex
4. **Difficulty calibration:**
   - **Easy**: single concept, straightforward solution (map, filter, basic string ops)
   - **Medium**: combine 2-3 concepts, requires thinking (reduce + object building, closures, async chains)
   - **Hard**: multi-step algorithms, optimization needed, advanced patterns (DP, custom data structures, complex React hooks)
5. **React exercises**: use function components with hooks, return JSX as a string description (no actual rendering needed — describe what the component should do)
6. **No external libraries** — vanilla JS/React only
7. **Each exercise should teach one clear concept**

## Example Output Format

[
  {
    "id": "array-chunk",
    "difficulty": "medium",
    "topics": ["array", "slice"],
    "category": "fundamentals",
    "title": "Chunk Array",
    "description": "Write a function `chunk(arr, size)` that splits an array into groups of `size` length. The last group may have fewer elements.\n\nExamples:\n- chunk([1,2,3,4,5], 2) → [[1,2],[3,4],[5]]\n- chunk([1,2,3], 1) → [[1],[2],[3]]\n- chunk([1,2], 5) → [[1,2]]\n\nConstraints:\n- size is always a positive integer\n- Return [] for empty array",
    "starterCode": "function chunk(arr, size) {\n  // Your code here\n}\n\nconsole.log(chunk([1,2,3,4,5], 2));\nconsole.log(chunk([1,2,3], 1));",
    "testCases": [
      { "input": "([1,2,3,4,5], 2)", "expected": "[[1,2],[3,4],[5]]", "description": "basic chunking" },
      { "input": "([], 3)", "expected": "[]", "description": "empty array" },
      { "input": "([1], 1)", "expected": "[[1]]", "description": "single element" }
    ],
    "hint": "Use a for loop with step = size, and Array.slice(i, i + size).",
    "solutionApproach": "Loop with step size, slice subarrays. O(n) time, O(n) space.",
    "baseXp": 180,
    "estimatedMinutes": 15
  }
]

---

Now generate [NUMBER] exercises focused on [TOPICS]. Mix difficulties: roughly 40% easy, 40% medium, 20% hard.
```

---

## Quick-Use Examples

Paste the prompt above, then add one of these at the bottom:

| What to say                                         | Result                                         |
| --------------------------------------------------- | ---------------------------------------------- |
| `Generate 20 exercises focused on array methods`    | 20 array exercises (map, filter, reduce, etc.) |
| `Generate 15 React hooks exercises`                 | useState, useEffect, custom hooks, etc.        |
| `Generate 10 hard algorithm exercises`              | DP, binary search, graph traversal, etc.       |
| `Generate 30 exercises covering all categories`     | Mixed JS + React + algorithms + patterns       |
| `Generate 10 async/promises exercises, medium-hard` | Promises, async/await, event loop              |

## Import into Code Dojo

1. Copy the generated JSON array
2. Save as a `.json` file
3. In Code Dojo → Admin → Exercise Manager → Import JSON
4. All exercises are added to the pool instantly
