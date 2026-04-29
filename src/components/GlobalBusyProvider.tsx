"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

type Href = Parameters<ReturnType<typeof useRouter>["push"]>[0];

export type GlobalBusyContextValue = {
  push: (href: Href) => void;
  replace: (href: Href) => void;
  refresh: () => void;
  beginBlocking: () => void;
  endBlocking: () => void;
  runBlocking: <T,>(fn: () => Promise<T>) => Promise<T>;
  isBusy: boolean;
};

const GlobalBusyContext = createContext<GlobalBusyContextValue | null>(null);

export function GlobalBusyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [blockCount, setBlockCount] = useState(0);

  const beginBlocking = useCallback(() => {
    setBlockCount((c) => c + 1);
  }, []);

  const endBlocking = useCallback(() => {
    setBlockCount((c) => Math.max(0, c - 1));
  }, []);

  const push = useCallback(
    (href: Href) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const replace = useCallback(
    (href: Href) => {
      startTransition(() => {
        router.replace(href);
      });
    },
    [router],
  );

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
    });
  }, [router]);

  const runBlocking = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      beginBlocking();
      try {
        return await fn();
      } finally {
        endBlocking();
      }
    },
    [beginBlocking, endBlocking],
  );

  const isBusy = blockCount > 0 || isPending;

  const value = useMemo(
    (): GlobalBusyContextValue => ({
      push,
      replace,
      refresh,
      beginBlocking,
      endBlocking,
      runBlocking,
      isBusy,
    }),
    [
      push,
      replace,
      refresh,
      beginBlocking,
      endBlocking,
      runBlocking,
      isBusy,
    ],
  );

  return (
    <GlobalBusyContext.Provider value={value}>
      <div className="relative flex min-h-full flex-col bg-white">
        <div
          className={`min-h-0 flex-1 ${isBusy ? "pointer-events-none select-none" : ""}`}
          {...(isBusy ? { inert: true as const } : {})}
        >
          {children}
        </div>
        {isBusy ? (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-zinc-950/45"
            role="progressbar"
            aria-busy="true"
            aria-label="処理中"
          >
            <div className="pointer-events-none flex flex-col items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-lg">
              <span className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-200 border-t-indigo-600" />
              <span className="text-sm font-semibold text-zinc-900">読み込み中…</span>
            </div>
          </div>
        ) : null}
      </div>
    </GlobalBusyContext.Provider>
  );
}

export function useGlobalBusy(): GlobalBusyContextValue {
  const ctx = useContext(GlobalBusyContext);
  if (!ctx) throw new Error("useGlobalBusy は GlobalBusyProvider 内で使ってください");
  return ctx;
}
