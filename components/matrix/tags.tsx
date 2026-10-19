"use client";

import { XIcon } from "lucide-react";
import { useId, useState } from "react";

import { normalizeTag, normalizeTags } from "@/lib/tags";
import { cn } from "@/lib/utils";

/** A repo tag. Clicking it (when `onClick` is given) filters the dashboard to that tag. */
export function TagChip({
  tag,
  active,
  onClick,
}: {
  tag: string;
  active?: boolean;
  onClick?: (tag: string) => void;
}) {
  const className = cn(
    "inline-flex items-center rounded-full border px-1.5 text-[11px] leading-4",
    active
      ? "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "bg-muted/60 text-muted-foreground",
  );
  if (!onClick) return <span className={className}>{tag}</span>;
  return (
    <button
      type="button"
      title={`Show only repos tagged “${tag}”`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(tag);
      }}
      className={cn(className, "hover:border-foreground/30 hover:text-foreground")}
    >
      {tag}
    </button>
  );
}

/** Chips plus a text box: Enter or comma adds a tag, Backspace on an empty box removes the last. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "add a tag…",
  className,
  id,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const listId = useId();

  const add = (raw: string) => {
    const next = normalizeTags([...value, ...raw.split(",")]);
    if (next.length !== value.length) onChange(next);
    setText("");
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  const typed = normalizeTag(text);
  const offered = suggestions
    .filter((s) => !value.includes(s) && (!typed || s.includes(typed)))
    .slice(0, 8);

  return (
    <div className={cn("relative", className)}>
      <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-0.5 rounded-full bg-muted py-0.5 pr-0.5 pl-2 text-xs"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={() => remove(tag)}
              className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => {
            // a pasted or typed comma commits what came before it
            if (e.target.value.includes(",")) add(e.target.value);
            else setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (text.trim()) add(text);
          }}
          placeholder={value.length ? "" : placeholder}
          id={id}
          aria-label={ariaLabel}
          aria-controls={listId}
          className="h-6 min-w-20 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {focused && offered.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 flex flex-wrap gap-1 rounded-md border bg-popover p-1.5 shadow-md"
        >
          {offered.map((tag) => (
            <button
              key={tag}
              type="button"
              role="option"
              aria-selected={false}
              // mousedown, not click: the input's blur would otherwise close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                add(tag);
              }}
              className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
