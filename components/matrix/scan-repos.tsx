"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type ScanCandidate,
  type ScanResult,
  addReposAction,
  browseRootAction,
  scanReposAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { InputGroupButton } from "@/components/ui/input-group";
import InputText from "@/components/ui/input-text";

type Found = Extract<ScanResult, { ok: true }>;

function CandidateRow({
  candidate,
  root,
  checked,
  onToggle,
}: {
  candidate: ScanCandidate;
  root: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const relative = candidate.path.startsWith(root + "/")
    ? candidate.path.slice(root.length + 1)
    : candidate.path;

  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-accent">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-medium">{candidate.name}</span>
          <span className="truncate font-mono text-xs text-muted-foreground">{relative}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {candidate.envs.length ? (
            candidate.envs.join(" › ")
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              no env branches among {candidate.branchCount} — defaults will be used
            </span>
          )}
        </p>
      </div>
    </label>
  );
}

/** Find every untracked repo under a folder and add the chosen ones in one go. */
function ScanRepos({ onDone }: { onDone: () => void }) {
  const [root, setRoot] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [scanning, startScan] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    browseRootAction().then((r) => setRoot((prev) => prev || r));
  }, []);

  const scan = () =>
    startScan(async () => {
      const result = await scanReposAction(root);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setFound(result);
      setRoot(result.root);
      // Nearly every repo has a `main`; one env is no pipeline to track. Pre-pick
      // only repos that promote through at least two env branches.
      setPicked(new Set(result.candidates.filter((c) => c.envs.length >= 2).map((c) => c.path)));
    });

  const toggle = (path: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const save = () =>
    startSave(async () => {
      const chosen = (found?.candidates ?? []).filter((c) => picked.has(c.path));
      const result = await addReposAction(
        chosen.map(({ name, path, remote, envs }) => ({ name, path, remote, envs })),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const n = result.added.length;
      toast.success(`${n} repo${n === 1 ? "" : "s"} added`);
      if (result.skipped.length) {
        toast.warning(`Skipped, name already taken: ${result.skipped.join(", ")}`);
      }
      onDone();
    });

  const candidates = found?.candidates ?? [];
  const allPicked = candidates.length > 0 && picked.size === candidates.length;

  return (
    <>
      <div className="space-y-3">
        <InputText
          label="Folder to scan"
          value={root}
          onChange={(e) => setRoot(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && scan()}
          description="Searched up to 3 folders deep, e.g. projects/group/repo."
          endContent={
            <InputGroupButton variant="secondary" onClick={scan} isLoading={scanning}>
              Scan
            </InputGroupButton>
          }
        />

        {found && (
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-xs text-muted-foreground">
              <span>
                {candidates.length} new repo{candidates.length === 1 ? "" : "s"}
                {found.tracked > 0 && ` · ${found.tracked} already tracked`}
                {found.truncated && " · stopped early, scan a narrower folder"}
              </span>
              {candidates.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-6 px-2 text-xs"
                  onClick={() =>
                    setPicked(allPicked ? new Set() : new Set(candidates.map((c) => c.path)))
                  }
                >
                  {allPicked ? "Select none" : "Select all"}
                </Button>
              )}
            </div>

            {candidates.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing new here.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto p-1">
                {candidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.path}
                    candidate={candidate}
                    root={found.root}
                    checked={picked.has(candidate.path)}
                    onToggle={() => toggle(candidate.path)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={picked.size === 0}
          isLoading={saving}
          loadingText="Adding..."
        >
          Add {picked.size || ""} repo{picked.size === 1 ? "" : "s"}
        </Button>
      </DialogFooter>
    </>
  );
}

export default ScanRepos;
