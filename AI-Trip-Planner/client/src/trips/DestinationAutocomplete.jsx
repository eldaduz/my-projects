import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/apiClient';

const DEBOUNCE_MS = 300;

export function DestinationAutocomplete({ id, value, onChange, ...inputProps }) {
  const [suggestions, setSuggestions] = useState([]);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const listRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  function handleInputChange(event) {
    onChange(event);
    const query = event.target.value;
    clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const data = await apiClient.get(`/enrichment/autocomplete?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        // abort() can't retroactively cancel a response that already landed
        // over the network before a newer query started — comparing against
        // the latest controller (not just catching ABORT_ERROR) is what
        // actually stops a stale response from overwriting a fresher one.
        if (abortRef.current === controller) setSuggestions(data.suggestions ?? []);
      } catch (err) {
        if (err.code === 'ABORT_ERROR') return;
        // Best-effort: a failed lookup just means no suggestions this keystroke.
        if (abortRef.current === controller) setSuggestions([]);
      }
    }, DEBOUNCE_MS);
  }

  function selectSuggestion(label) {
    clearTimeout(debounceRef.current);
    // The debounced fetch may already be in flight (its own controller
    // already assigned to abortRef.current) rather than merely scheduled —
    // clearing the timer alone doesn't stop that request from resolving
    // afterward and reopening the dropdown. Abort and invalidate it too.
    abortRef.current?.abort();
    abortRef.current = null;
    onChange({ target: { value: label } });
    setSuggestions([]);
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      listRef.current?.querySelector('button')?.focus();
    }
  }

  function handleOptionKeyDown(event) {
    const currentItem = event.currentTarget.closest('li');
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      currentItem.nextElementSibling?.querySelector('button')?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const previous = currentItem.previousElementSibling?.querySelector('button');
      previous ? previous.focus() : document.getElementById(id)?.focus();
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      document.getElementById(id)?.focus();
    }
  }

  return (
    <div className="destination-autocomplete">
      <input
        id={id}
        className="input"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        autoComplete="off"
        {...inputProps}
      />
      {suggestions.length > 0 && (
        <ul role="listbox" className="destination-autocomplete__list" ref={listRef}>
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lon}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => selectSuggestion(suggestion.label)}
                onKeyDown={handleOptionKeyDown}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
