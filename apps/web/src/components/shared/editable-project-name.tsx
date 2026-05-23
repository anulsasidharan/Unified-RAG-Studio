'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

import { cn } from '@/lib/utils';

const MAX_NAME_LEN = 255;

type EditableProjectNameProps = {
  name: string;
  onSave: (next: string) => void;
  /** When set, the main label acts as a control (e.g. select active project). */
  onSelect?: () => void;
  leading?: React.ReactNode;
  isActive?: boolean;
  variant: 'sidebar' | 'list';
  /** Hide pencil (e.g. collapsed sidebar). */
  hidePencil?: boolean;
  /** When false, only `leading` is shown in the select control (narrow sidebar). */
  showLabel?: boolean;
};

export function EditableProjectName({
  name,
  onSave,
  onSelect,
  leading,
  isActive,
  variant,
  hidePencil,
  showLabel = true,
}: EditableProjectNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim().slice(0, MAX_NAME_LEN);
    if (!trimmed) {
      setDraft(name);
      setEditing(false);
      return;
    }
    if (trimmed !== name) {
      onSave(trimmed);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
        {leading}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onInputKeyDown}
          maxLength={MAX_NAME_LEN + 32}
          className={cn(
            'bg-background ring-offset-background focus-visible:ring-ring min-w-0 flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm text-neutral-900 outline-none focus-visible:ring-2 dark:border-neutral-600 dark:text-neutral-100',
            variant === 'list' && 'text-base font-medium',
          )}
          aria-label="Project name"
        />
      </div>
    );
  }

  const nameEl =
    variant === 'sidebar' ? (
      <span className="truncate text-sm">{name}</span>
    ) : (
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{name}</span>
    );

  const main =
    onSelect !== undefined ? (
      <button
        type="button"
        onClick={onSelect}
        title={name}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-transparent',
          !showLabel && 'md:justify-center md:px-0',
          isActive && 'text-primary-900 dark:text-primary-100 font-medium',
        )}
      >
        {leading}
        {showLabel ? nameEl : null}
      </button>
    ) : (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {leading}
        {nameEl}
      </div>
    );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-0.5">
      {main}
      {!hidePencil ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="hover:bg-accent inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          title="Rename project"
          aria-label={`Rename project ${name}`}
        >
          <Pencil className={variant === 'sidebar' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      ) : null}
    </div>
  );
}
