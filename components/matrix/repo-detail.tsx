"use client";

import Link from "next/link";

import { ChevronLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { useMatrix, useRegisterRepo } from "./matrix-context";
import RepoCard from "./repo-card";
import TicketSheet from "./ticket-sheet";

import type { Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";

function RepoDetail({ model }: { model: RepoView }) {
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
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-3.5" />
        All repos
      </Link>

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
