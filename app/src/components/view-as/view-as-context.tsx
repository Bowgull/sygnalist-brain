"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ViewAsState {
  /** Whether we're currently in view-as mode */
  active: boolean;
  /** The client profile ID we're viewing as */
  clientId: string | null;
  /** The client's display name */
  clientName: string | null;
  /** The client's email */
  clientEmail: string | null;
  /** Whether we're still loading the client info */
  loading: boolean;
}

const ViewAsContext = createContext<ViewAsState>({
  active: false,
  clientId: null,
  clientName: null,
  clientEmail: null,
  loading: false,
});

export function useViewAs() {
  return useContext(ViewAsContext);
}

export function ViewAsProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const viewAsId = searchParams.get("view_as");

  const [state, setState] = useState<ViewAsState>({
    active: false,
    clientId: null,
    clientName: null,
    clientEmail: null,
    loading: !!viewAsId,
  });

  useEffect(() => {
    if (!viewAsId) {
      setState({ active: false, clientId: null, clientName: null, clientEmail: null, loading: false });
      return;
    }

    setState((prev) => ({ ...prev, active: true, clientId: viewAsId, loading: true }));

    fetch(`/api/admin/view-as/profile?client_id=${viewAsId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setState({
            active: true,
            clientId: viewAsId,
            clientName: data.display_name || data.email || "Unknown Client",
            clientEmail: data.email || null,
            loading: false,
          });
        } else {
          setState((prev) => ({ ...prev, loading: false, clientName: "Unknown Client" }));
        }
      })
      .catch(() => {
        setState((prev) => ({ ...prev, loading: false, clientName: "Unknown Client" }));
      });
  }, [viewAsId]);

  return (
    <ViewAsContext.Provider value={state}>
      {children}
    </ViewAsContext.Provider>
  );
}
