"use client";

import { usePathname, useRouter } from "next/navigation";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { TagInput } from "./tags";

import { removeRepoAction, updateRepoAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import InputText from "@/components/ui/input-text";
import { Label } from "@/components/ui/label";
import type { RepoSettings } from "@/lib/db";

const split = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

type Props = {
  settings: RepoSettings;
  /** existing group names, offered as suggestions */
  groups?: string[];
  /** existing tags, offered as suggestions */
  tags?: string[];
  children: React.ReactNode;
};

function EditRepoDialog({ settings, groups = [], tags: knownTags = [], children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(settings.name);
  const [path, setPath] = useState(settings.path);
  const [group, setGroup] = useState(settings.group ?? "");
  const [tags, setTags] = useState(settings.tags);
  const [envs, setEnvs] = useState(settings.envs.join(", "));
  const [doneEnvs, setDoneEnvs] = useState(settings.doneEnvs.join(", "));
  const [remote, setRemote] = useState(settings.remote);
  const [pattern, setPattern] = useState(settings.ticketPattern);
  const [ticketUrl, setTicketUrl] = useState(settings.ticketUrl ?? "");
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();

  // start from what is saved every time, not from an abandoned edit
  const reset = () => {
    setName(settings.name);
    setPath(settings.path);
    setGroup(settings.group ?? "");
    setTags(settings.tags);
    setEnvs(settings.envs.join(", "));
    setDoneEnvs(settings.doneEnvs.join(", "));
    setRemote(settings.remote);
    setPattern(settings.ticketPattern);
    setTicketUrl(settings.ticketUrl ?? "");
  };

  const save = () =>
    startSave(async () => {
      const result = await updateRepoAction(settings.id, {
        name,
        path,
        group,
        tags,
        envs: split(envs),
        doneEnvs: split(doneEnvs),
        remote,
        ticketPattern: pattern,
        ticketUrl,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Repo "${name}" saved`);
      setOpen(false);
    });

  const remove = () => {
    if (
      !window.confirm(
        `Remove "${settings.name}" from the dashboard?\n\n` +
          "Its notes in the database go with it. The git repo itself is untouched.\n" +
          "Archive it instead to hide it and keep the notes.",
      )
    )
      return;

    startRemove(async () => {
      await removeRepoAction(settings.id);
      toast.success(`Repo "${settings.name}" removed`);
      setOpen(false);
      if (pathname.startsWith("/repo/")) router.replace("/");
    });
  };

  const listId = `groups-${settings.id}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>

      {/* never taller than the screen: header and Save stay put, the fields scroll between them */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {settings.name}</DialogTitle>
          <DialogDescription>
            Only this dashboard&apos;s settings change. Branch notes are kept.
          </DialogDescription>
        </DialogHeader>

        {/* -m-1 p-1 keeps focus rings clear of the scroll clip */}
        <div className="-m-1 space-y-3 overflow-y-auto p-1">
          <InputText required label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <InputText
            required
            label="Folder path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
          />
          <InputText
            label="Group"
            placeholder="e.g. telescope"
            description="Repos in the same group sit together on the overview."
            list={listId}
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <datalist id={listId}>
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <div className="space-y-1">
            <Label htmlFor={`tags-${settings.id}`}>Tags</Label>
            <TagInput
              id={`tags-${settings.id}`}
              value={tags}
              onChange={setTags}
              suggestions={knownTags}
            />
            <p className="text-xs text-muted-foreground">
              Any number, e.g. frontend, client-x. Filter by them on the overview and Tickets.
            </p>
          </div>
          <InputText
            label="Environment branches"
            description="Comma separated, earliest stage first."
            value={envs}
            onChange={(e) => setEnvs(e.target.value)}
          />
          <InputText
            label="Done when merged into"
            description="A ticket counts as done once it reaches all of these."
            value={doneEnvs}
            onChange={(e) => setDoneEnvs(e.target.value)}
          />
          <InputText label="Remote" value={remote} onChange={(e) => setRemote(e.target.value)} />
          <InputText
            label="Ticket pattern"
            description="Regex used to find ticket IDs in branch names and commit messages."
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <InputText
            label="Ticket URL"
            placeholder="https://your-org.atlassian.net/browse/{ticket}"
            description="Issue tracker URL with {ticket} where the ID goes. Empty uses BRANCH_MATRIX_TICKET_URL, if set."
            value={ticketUrl}
            onChange={(e) => setTicketUrl(e.target.value)}
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={remove}
            isLoading={removing}
            loadingText="Removing..."
          >
            Remove repo
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} isLoading={saving} loadingText="Saving...">
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditRepoDialog;
