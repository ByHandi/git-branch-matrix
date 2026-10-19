"use client";

import { ChevronRightIcon, CornerLeftUpIcon, FolderIcon, GitBranchIcon } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";

import { browseAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Listing } from "@/lib/browse";
import { cn } from "@/lib/utils";

type Props = {
  /** Called with an absolute path when the user picks a git repo. */
  onPick: (path: string) => void;
  startPath?: string;
};

function FolderPicker({ onPick, startPath }: Props) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const go = useCallback((path?: string) => {
    startTransition(async () => {
      const result = await browseAction(path);
      if (result.ok) {
        setListing(result.listing);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }, []);

  useEffect(() => {
    go(startPath);
  }, [go, startPath]);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="size-7 p-0"
          title="Up one level"
          disabled={!listing?.parent || pending}
          onClick={() => listing?.parent && go(listing.parent)}
        >
          <CornerLeftUpIcon className="size-3.5" />
        </Button>
        <span className="truncate font-mono text-xs text-muted-foreground" title={listing?.path}>
          {listing?.path ?? "…"}
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto">
        {error && <p className="px-3 py-4 text-xs text-destructive">{error}</p>}

        {!error && listing?.entries.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground">no subfolders here</p>
        )}

        {listing?.entries.map((entry) => (
          <div key={entry.path} className="flex items-center gap-2 px-2 py-1 hover:bg-accent/50">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              onClick={() => go(entry.path)}
              disabled={pending}
            >
              {entry.isRepo ? (
                <GitBranchIcon className="size-3.5 shrink-0 text-primary" />
              ) : (
                <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("truncate text-xs", entry.isRepo && "font-medium")}>
                {entry.name}
              </span>
              <ChevronRightIcon className="ml-auto size-3 shrink-0 text-muted-foreground/50" />
            </button>

            {entry.isRepo && (
              <Button size="sm" variant="outline" onClick={() => onPick(entry.path)}>
                Select
              </Button>
            )}
          </div>
        ))}
      </div>

      {listing?.isRepo && (
        <div className="border-t px-2 py-1.5">
          <Button size="sm" variant="outline" onClick={() => onPick(listing.path)}>
            Use this folder
          </Button>
        </div>
      )}
    </div>
  );
}

export default FolderPicker;
