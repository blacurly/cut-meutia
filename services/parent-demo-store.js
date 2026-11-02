"use client";

import { decodeDemo, emptyDemo } from "../lib/parent.js";
export const DEMO_KEY="ayomi-parent-demo-v1";
const initial=JSON.stringify(emptyDemo);
let memory=initial;
let persistent=true;
export const serverSnapshot=()=>initial;
export function getSnapshot() {
  if (!persistent) return memory;
  try { return localStorage.getItem(DEMO_KEY)||initial; }
  catch { persistent=false; return memory; }
}
export const hasPersistence=()=>persistent;
export function subscribe(listener) {
  const onStorage=(event)=>{if(event.key===DEMO_KEY || event.key===null)listener();};
  window.addEventListener("storage",onStorage); window.addEventListener(DEMO_KEY,listener);
  return ()=>{window.removeEventListener("storage",onStorage);window.removeEventListener(DEMO_KEY,listener);};
}
export function updateDemo(updater) {
  const next=updater(decodeDemo(getSnapshot()));
  memory=JSON.stringify(next);
  try { localStorage.setItem(DEMO_KEY,memory); persistent=true; } catch { persistent=false; }
  window.dispatchEvent(new Event(DEMO_KEY));
  return next;
}
