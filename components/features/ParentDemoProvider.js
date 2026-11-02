"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { decodeDemo } from "@/lib/parent";
import { getSnapshot, hasPersistence, serverSnapshot, subscribe, updateDemo } from "@/services/parent-demo-store";

const DemoContext = createContext(null);
const subscribeReady = () => () => { };
const clientReady = () => true;
const serverReady = () => false;
export default function ParentDemoProvider({ children }) {
  const raw = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const hydrated = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const state = useMemo(() => decodeDemo(raw), [raw]);
  return <DemoContext.Provider value={{ state, update: updateDemo, hydrated, persistent: hasPersistence() }}>{children}</DemoContext.Provider>;
}
export function useParentDemo() { const context = useContext(DemoContext); if (!context) throw new Error("ParentDemoProvider diperlukan."); return context; }
