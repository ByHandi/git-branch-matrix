"use client";

import { Check, ExternalLinkIcon, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import Ago from "./ago";
import { branchPrUrl, ticketHref, ticketLabel } from "./shared";
import TicketLink from "./ticket-link";

import { saveNoteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import InputText from "@/components/ui/input-text";
import InputTextarea from "@/components/ui/input-textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTimeZone } from "@/hooks/use-time-zone";
import type { Branch, Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";
import { formatDate } from "@/lib/time";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: RepoView | null;
  ticket: Ticket | null;
};

function BranchEditor({ model, branch }: { model: RepoView; branch: Branch }) {
  const [note, setNote] = useState(branch.note ?? "");
  const [status, setStatus] = useState(branch.status ?? "");
  const [tickets, setTickets] = useState((branch.manualTickets ?? []).join(", "));
  const [pending, startTransition] = useTransition();
  const timeZone = useTimeZone();

  // the sheet is reused across tickets, so re-sync when the branch changes
  useEffect(() => {
    setNote(branch.note ?? "");
    setStatus(branch.status ?? "");
    setTickets((branch.manualTickets ?? []).join(", "));
  }, [branch]);

  const save = () =>
    startTransition(async () => {
      const result = await saveNoteAction({
        repoId: model.repoId,
        branch: branch.name,
        note,
        status,
        tickets: tickets
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (result.ok) toast.success("Note saved");
      else toast.error(result.error);
    });

  return (
    <div className="rounded-lg border p-3">
      <p className="font-mono text-xs break-all">
        {branch.name}
        {!branch.live && <span className="text-muted-foreground"> (deleted)</span>}
      </p>

      {branch.combined && (
        <p className="mt-1 text-xs text-muted-foreground">combined: {branch.tickets.join(", ")}</p>
      )}

      {branch.author && (
        <p className="mt-1 text-xs text-muted-foreground">
          {branch.author}
          {branch.authorFromMerge && (
            <span title="branch was deleted and squash-merged, so this is the merge commit author">
              {" "}
              (from merge commit)
            </span>
          )}
        </p>
      )}

      <ul className="mt-3 space-y-1 text-xs">
        {model.envs.map((env) => {
          const cell = branch.envs[env];
          // a deleted branch has nothing left to compare against
          const prUrl = !cell && branch.live ? branchPrUrl(model, branch.name, env) : null;

          return (
            <li key={env} className="flex items-center gap-2">
              <span className="w-24 text-muted-foreground">{env}</span>
              {cell ? (
                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" /> <span>merged</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <X className="size-4" /> <span>not yet</span>
                </span>
              )}
              {cell?.pr && <span className="text-muted-foreground">PR #{cell.pr}</span>}
              {cell?.date && (
                <span className="text-muted-foreground">{formatDate(cell.date, timeZone)}</span>
              )}

              {prUrl && (
                <a
                  href={prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open a pull request: ${branch.name} → ${env}`}
                  className="ml-auto inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  Open PR
                  <ExternalLinkIcon className="size-3" />
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 space-y-3">
        <InputTextarea
          label="Note"
          placeholder="why these tickets were combined, or anything else"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <InputText
          label="Status"
          placeholder="waiting for QA, held for next release, …"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        />
        <InputText
          label="Extra tickets"
          description="Comma separated. For tickets not mentioned in the branch name."
          placeholder="SLM-112, SLM-113"
          value={tickets}
          onChange={(e) => setTickets(e.target.value)}
        />
        <Button size="sm" onClick={save} isLoading={pending} loadingText="Saving...">
          Save
        </Button>
      </div>
    </div>
  );
}

function TicketSheet({ open, onOpenChange, model, ticket }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {model && ticket && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">
                {ticketLabel(ticket.id)}
                <TicketLink href={ticketHref(model, ticket)} className="ml-2" />
              </SheetTitle>
              <SheetDescription>
                {model.repoName} · <Ago iso={ticket.date} prefix="last commit " />
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3 px-4 pb-6">
              {ticket.branches.map((name) => {
                const branch = model.branches.find((b) => b.name === name);
                if (!branch) return null;
                return <BranchEditor key={name} model={model} branch={branch} />;
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default TicketSheet;
