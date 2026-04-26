"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TourPicker from "./tour-picker";
import { TOURS, type TourId } from "@/lib/tour/tours";

const SESSION_KEY = "syg_tour_seen";

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type Ctx = {
  openPicker: () => void;
  enabled: boolean;
};

const TourCtx = createContext<Ctx>({ openPicker: () => {}, enabled: false });

export function useTour() {
  return useContext(TourCtx);
}

export default function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!isDemo) return;
    if (typeof window === "undefined") return;
    if (window.self !== window.top) return; // skip auto-prompt inside iframe
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;
    setPickerOpen(true);
  }, []);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
  }, []);

  const handleSkip = useCallback(() => {
    setPickerOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_KEY, "1");
    }
  }, []);

  const handlePick = useCallback(
    async (id: TourId) => {
      setPickerOpen(false);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      }
      const tour = TOURS[id];
      const { runTour } = await import("@/lib/tour/run-tour");
      await runTour(tour, async (route) => {
        router.push(route);
        await new Promise((r) => setTimeout(r, 350));
      });
    },
    [router],
  );

  return (
    <TourCtx.Provider value={{ openPicker, enabled: isDemo }}>
      {children}
      {pickerOpen && <TourPicker onPick={handlePick} onSkip={handleSkip} />}
    </TourCtx.Provider>
  );
}
