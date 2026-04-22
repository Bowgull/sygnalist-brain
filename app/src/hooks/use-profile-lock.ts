"use client";

import { useEffect, useState } from "react";
import { useViewAs } from "@/components/view-as/view-as-context";

const LOCKED_STATUS = "inactive_soft_locked";

interface ProfileLockState {
  /** True when the effective profile (own or view-as target) is soft-locked. */
  locked: boolean;
  /** True while the underlying profile fetch is in flight. */
  loading: boolean;
}

/**
 * Returns the effective profile-lock state for the current page context.
 *
 * - In view-as mode, derives the lock state from the client profile that
 *   ViewAsContext already fetches; no extra request is issued.
 * - Outside view-as mode, fetches the caller's own profile once.
 */
export function useProfileLock(): ProfileLockState {
  const viewAs = useViewAs();
  const [ownStatus, setOwnStatus] = useState<string | null>(null);
  const [ownLoading, setOwnLoading] = useState(!viewAs.active);

  useEffect(() => {
    if (viewAs.active) {
      setOwnLoading(false);
      return;
    }

    let cancelled = false;
    setOwnLoading(true);
    fetch("/api/profile")
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setOwnStatus(data?.status ?? null);
        }
      })
      .catch(() => { /* leave status null on failure */ })
      .finally(() => {
        if (!cancelled) setOwnLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewAs.active]);

  if (viewAs.active) {
    return {
      locked: viewAs.clientStatus === LOCKED_STATUS,
      loading: viewAs.loading,
    };
  }

  return {
    locked: ownStatus === LOCKED_STATUS,
    loading: ownLoading,
  };
}
