import { useEffect, useRef, useState } from 'react';
import { useIssueSearch } from '../hooks/useIssueSearch';
import type { Issue } from '../lib/types';

interface IssueComboboxProps {
  value: string;
  accountId: string;
  onChange: (value: string) => void;
  onSelect: (issueKey: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function getOptionId(index: number): string {
  return `issue-option-${index}`;
}

export function IssueCombobox({
  value,
  accountId,
  onChange,
  onSelect,
  placeholder,
  autoFocus,
}: IssueComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const closeTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { data: issues = [], isLoading, isFetching } = useIssueSearch(value, accountId);

  useEffect(() => {
    setHighlightedIndex(issues.length > 0 ? 0 : -1);
  }, [issues]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  function handleSelectIssue(issue: Issue): void {
    onChange(issue.key);
    onSelect(issue.key);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function moveHighlight(direction: 1 | -1): void {
    if (!issues.length) return;

    if (!isOpen) {
      setIsOpen(true);
      setHighlightedIndex(0);
      return;
    }

    setHighlightedIndex((prev) => {
      if (prev < 0) return 0;
      const next = prev + direction;
      if (next < 0) return issues.length - 1;
      if (next >= issues.length) return 0;
      return next;
    });
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          closeTimeoutRef.current = window.setTimeout(() => {
            setIsOpen(false);
          }, 120);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
            return;
          }

          if (e.key === 'ArrowDown') {
            e.preventDefault();
            moveHighlight(1);
            return;
          }

          if (e.key === 'ArrowUp') {
            e.preventDefault();
            moveHighlight(-1);
            return;
          }

          if (e.key === 'Enter' && isOpen && highlightedIndex >= 0 && highlightedIndex < issues.length) {
            e.preventDefault();
            const selected = issues[highlightedIndex];
            if (selected) {
              handleSelectIssue(selected);
            }
          }
        }}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls="issue-combobox-listbox"
        aria-activedescendant={highlightedIndex >= 0 ? getOptionId(highlightedIndex) : undefined}
      />

      {isOpen ? (
        <div
          id="issue-combobox-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-52 overflow-auto rounded border border-gray-200 bg-white shadow-lg"
        >
          {isLoading || isFetching ? (
            <p className="px-3 py-2 text-xs text-gray-500">Searching issues...</p>
          ) : issues.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">No issues found</p>
          ) : (
            issues.map((issue, index) => (
              <button
                id={getOptionId(index)}
                key={`${issue.id}-${issue.key}`}
                type="button"
                role="option"
                aria-selected={highlightedIndex === index}
                className={`block w-full px-3 py-2 text-left text-xs ${
                  highlightedIndex === index ? 'bg-blue-50 text-blue-900' : 'text-gray-700 hover:bg-gray-50'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => handleSelectIssue(issue)}
              >
                <div className="font-medium">[{issue.key}] {issue.summary} ({issue.status})</div>
                <div className="text-[11px] text-gray-500">{issue.project.key} - {issue.project.name}</div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
