"use client";

import { useEffect, useState } from "react";

import BackLink from "./back-link";
import { useMatrix, useRegisterRepo } from "./matrix-context";
import RepoCard from "./repo-card";
import TicketSheet from "./ticket-sheet";

import type { Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";

function RepoDetail({
  model,
  groups,
  tags,
}: {
  model: RepoView;
  groups: string[];
  tags: string[];
}) {
  useRegisterRepo(model);
  const { query, pendingOnly, authors, setAuthors } = useMatrix();
  // The ticket outlives `open` so the sheet keeps its content while it animates shut.
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Ticket | null>(null);

  // keep the sheet pointing at fresh data after a save revalidates the page
  useEffect(() => {
    setSelected((prev) => prev && (model.tickets.find((t) => t.id === prev.id) ?? null));
  }, [model]);

  return (
    <div className="flex flex-col gap-3 p-6">
      <BackLink />

      <RepoCard
        model={model}
        query={query}
        pendingOnly={pendingOnly}
        authors={authors}
        onSelect={(_, ticket) => {
          setSelected(ticket);
          setOpen(true);
        }}
        onAuthorClick={(author) => setAuthors([author])}
        groups={groups}
        tagSuggestions={tags}
      />

      <TicketSheet
        open={open && Boolean(selected)}
        onOpenChange={setOpen}
        model={model}
        ticket={selected}
      />
    </div>
  );
}

export default RepoDetail;
