"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { RepoView } from "@/lib/overview";

type MatrixState = {
  query: string;
  setQuery: (query: string) => void;
  pendingOnly: boolean;
  setPendingOnly: (update: (prev: boolean) => boolean) => void;
  authors: string[];
  setAuthors: (authors: string[]) => void;
  /** true when any filter narrows the tickets shown */
  filtering: boolean;
  clearFilters: () => void;
  /**
   * Repos currently on screen. Rows stream in one by one, so nothing above them
   * gets the full list as a prop — each one registers itself once it has loaded.
   */
  models: RepoView[];
  register: (model: RepoView) => void;
  unregister: (repoId: number) => void;
};

const MatrixContext = createContext<MatrixState | null>(null);

/**
 * Lives in the root layout, so filters survive navigating between the overview
 * and a repo page.
 */
export function MatrixProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [registry, setRegistry] = useState<Record<number, RepoView>>({});

  const register = useCallback(
    (model: RepoView) => setRegistry((prev) => ({ ...prev, [model.repoId]: model })),
    [],
  );
  const unregister = useCallback(
    (repoId: number) =>
      setRegistry((prev) => {
        if (!(repoId in prev)) return prev;
        const next = { ...prev };
        delete next[repoId];
        return next;
      }),
    [],
  );
  const clearFilters = useCallback(() => {
    setQuery("");
    setPendingOnly(() => false);
    setAuthors([]);
  }, []);

  const value = useMemo<MatrixState>(
    () => ({
      query,
      setQuery,
      pendingOnly,
      setPendingOnly,
      authors,
      setAuthors,
      filtering: Boolean(query.trim()) || pendingOnly || authors.length > 0,
      clearFilters,
      models: Object.values(registry),
      register,
      unregister,
    }),
    [query, pendingOnly, authors, registry, clearFilters, register, unregister],
  );

  return <MatrixContext.Provider value={value}>{children}</MatrixContext.Provider>;
}

export function useMatrix() {
  const ctx = useContext(MatrixContext);
  if (!ctx) throw new Error("useMatrix must be used inside <MatrixProvider>");
  return ctx;
}

/** Make a loaded repo visible to the header (author list) and the overview totals. */
export function useRegisterRepo(model: RepoView) {
  const { register, unregister } = useMatrix();
  useEffect(() => {
    register(model);
    return () => unregister(model.repoId);
  }, [model, register, unregister]);
}

/** Same as useRegisterRepo for a page that shows many repos at once. */
export function useRegisterRepos(models: RepoView[]) {
  const { register, unregister } = useMatrix();
  useEffect(() => {
    for (const model of models) register(model);
    return () => {
      for (const model of models) unregister(model.repoId);
    };
  }, [models, register, unregister]);
}
