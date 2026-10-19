"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import FolderPicker from "./folder-picker";
import ScanRepos from "./scan-repos";

import { addRepoAction, probeRepoAction } from "@/app/actions";
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
import { cn } from "@/lib/utils";

const DEFAULT_ENVS = "development, staging, release, main";
const DEFAULT_DONE_ENVS = "release, main";
const DEFAULT_PATTERN = "[A-Z][A-Z0-9]{1,9}-\\d+";

function AddRepoDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"one" | "scan">("one");
  const [browsing, setBrowsing] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [envs, setEnvs] = useState(DEFAULT_ENVS);
  const [remote, setRemote] = useState("origin");
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [doneEnvs, setDoneEnvs] = useState(DEFAULT_DONE_ENVS);
  const [hint, setHint] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [probing, startProbe] = useTransition();

  const reset = () => {
    setName("");
    setPath("");
    setEnvs(DEFAULT_ENVS);
    setRemote("origin");
    setPattern(DEFAULT_PATTERN);
    setDoneEnvs(DEFAULT_DONE_ENVS);
    setHint(null);
    setBrowsing(false);
    setMode("one");
  };

  // Picking a folder prefills everything we can read off the repo itself.
  const pick = (picked: string) => {
    setPath(picked);
    setBrowsing(false);

    startProbe(async () => {
      const result = await probeRepoAction(picked);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { probe } = result;
      const folder = probe.toplevel.split("/").filter(Boolean).pop() ?? "";
      if (!name) setName(folder);
      setRemote(probe.remote);

      if (probe.guessedEnvs.length) {
        setEnvs(probe.guessedEnvs.join(", "));
        // the last stages of the pipeline are the ones that mean "shipped"
        setDoneEnvs(probe.guessedEnvs.slice(-2).join(", "));
        setHint(`Detected from the ${probe.branches.length} branches in this repo.`);
      } else {
        setHint(
          `None of the ${probe.branches.length} branches look like environments. Fill these in manually.`,
        );
      }
    });
  };

  const submit = () =>
    startTransition(async () => {
      const result = await addRepoAction({
        name,
        path,
        envs: envs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        remote,
        ticketPattern: pattern,
        doneEnvs: doneEnvs
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Repo "${name}" added`);
      reset();
      setOpen(false);
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          + Repo
        </Button>
      </DialogTrigger>

      <DialogContent className={mode === "scan" ? "sm:max-w-xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>Add repo</DialogTitle>
          <DialogDescription>
            Read from a local clone, read-only. Nothing is ever written to git.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {(
            [
              ["one", "One repo"],
              ["scan", "Scan a folder"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors",
                mode === value && "bg-background text-foreground shadow-xs",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "scan" ? (
          <ScanRepos
            onDone={() => {
              setOpen(false);
              reset();
            }}
          />
        ) : (
          <>
            <div className="space-y-3">
              <div className="space-y-2">
                <InputText
                  required
                  label="Folder path"
                  placeholder="/Users/handiani/projects/cg-erp"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  description="Type it, or browse for it."
                />

                <Button size="sm" variant="ghost" onClick={() => setBrowsing((v) => !v)}>
                  {browsing ? "Close browser" : "Browse…"}
                </Button>

                {browsing && <FolderPicker onPick={pick} startPath={path || undefined} />}

                {probing && <p className="text-xs text-muted-foreground">Reading repo…</p>}
                {hint && !probing && <p className="text-xs text-muted-foreground">{hint}</p>}
              </div>

              <InputText
                required
                label="Name"
                placeholder="cg-erp"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
              <InputText
                label="Remote"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
              />
              <InputText
                label="Ticket pattern"
                description="Regex used to find ticket IDs in branch names and commit messages."
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} isLoading={pending} loadingText="Saving...">
                Save
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AddRepoDialog;
