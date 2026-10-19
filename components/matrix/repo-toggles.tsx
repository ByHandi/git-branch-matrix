"use client";

import { ArchiveIcon, ArchiveRestoreIcon, StarIcon } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { patchRepoAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { RepoSettings } from "@/lib/db";
import { cn } from "@/lib/utils";

/** Star that pins a repo to the top of the overview. Flips instantly, saves behind. */
export function PinToggle({ settings, className }: { settings: RepoSettings; className?: string }) {
  const [pinned, setPinned] = useOptimistic(settings.pinned);
  const [, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      setPinned(!pinned);
      await patchRepoAction(settings.id, { pinned: !pinned });
    });
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${settings.name}` : `Pin ${settings.name}`}
      title={pinned ? "Unpin" : "Pin to the top"}
      onClick={toggle}
      className={cn("size-7 p-0", className)}
    >
      <StarIcon
        className={cn("size-4", pinned ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
      />
    </Button>
  );
}

/** Archive hides a repo from the overview but keeps it and its notes. */
export function ArchiveToggle({ settings }: { settings: RepoSettings }) {
  const [pending, startTransition] = useTransition();
  const Icon = settings.archived ? ArchiveRestoreIcon : ArchiveIcon;

  const toggle = () =>
    startTransition(async () => {
      await patchRepoAction(settings.id, { archived: !settings.archived });
      toast.success(
        settings.archived
          ? `"${settings.name}" is back on the overview`
          : `"${settings.name}" archived — find it under Manage repos`,
      );
    });

  return (
    <Button size="sm" variant="ghost" onClick={toggle} isLoading={pending}>
      <Icon className="size-4" />
      {settings.archived ? "Unarchive" : "Archive"}
    </Button>
  );
}
