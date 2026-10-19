"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Option = { value: string; count: number };

type Props = {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  /** button text while nothing is selected */
  label?: string;
  empty?: string;
};

/** Multi-select popover used for authors and tags. */
function AuthorFilter({
  options,
  value,
  onChange,
  label: name = "Author",
  empty = "no authors yet",
}: Props) {
  const toggle = (name: string) =>
    onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name]);

  const label =
    value.length === 0 ? name : value.length === 1 ? value[0] : `${name} · ${value.length}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={value.length ? "secondary" : "outline"}>
          <span className="max-w-32 truncate">{label}</span>
          <ChevronDownIcon className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 p-1">
        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">{empty}</p>
          )}

          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={checked}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {/* drawn, not <Checkbox>: that one is a <button> and can't nest in this one */}
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input dark:bg-input/30",
                    checked && "border-primary bg-primary text-primary-foreground dark:bg-primary",
                  )}
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                <span className="flex-1 truncate">{option.value}</span>
                <span className="text-xs text-muted-foreground">{option.count}</span>
              </button>
            );
          })}
        </div>

        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="mt-1 flex w-full items-center gap-2 border-t px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            <CheckIcon className="size-3" />
            Clear selection
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default AuthorFilter;
