"use client";

import { usePathname } from "next/navigation";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  /** narrow to one ticket, dropping filters that could hide it (e.g. a done ticket under "Open only") */
  focusTicket: (ticket: string) => void;
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
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [pendingOnly, setPendingOnly] = useState(false);
  const [authors, setAuthors] = useState<string[]>([]);
  const [registry, setRegistry] = useState<Record<number, RepoView>>({});
  const urlRead = useRef(false);

  // Filters live in the URL (?q=…&author=…&open=1) so a refresh, a bookmark or a
  // shared link brings them back. In-app links drop the query string, so this
  // also re-applies it after navigating — the state is what persists.
  useEffect(() => {
    if (!urlRead.current) return;
    const url = new URL(window.location.href);
    for (const key of ["q", "author", "open"]) url.searchParams.delete(key);
    if (query.trim()) url.searchParams.set("q", query);
    for (const author of authors) url.searchParams.append("author", author);
    if (pendingOnly) url.searchParams.set("open", "1");
    if (url.search !== window.location.search) {
      window.history.replaceState(window.history.state, "", url);
    }
  }, [query, authors, pendingOnly, pathname]);

  // Read the filters on load and on back/forward. Declared after the writer on
  // purpose: on the first commit the writer runs first and skips, instead of
  // wiping the URL with the still-empty state before this has read it.
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setQuery(params.get("q") ?? "");
      setAuthors(params.getAll("author"));
      setPendingOnly(() => params.get("open") === "1");
      urlRead.current = true;
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

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
  const focusTicket = useCallback((ticket: string) => {
    setQuery(ticket);
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
      focusTicket,
      models: Object.values(registry),
      register,
      unregister,
    }),
    [query, pendingOnly, authors, registry, clearFilters, focusTicket, register, unregister],
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
