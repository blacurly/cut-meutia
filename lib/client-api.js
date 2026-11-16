"use client";

// Browser helpers for the Ayomi REST API (same-origin, session cookie).
import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "./api-client";

async function parse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiRequestError(payload.error || "Permintaan gagal.", response.status, payload.code);
  return payload;
}

// JSON by default; pass `form` (FormData) for multipart uploads.
export async function apiSend(path, { method = "POST", body, form, signal } = {}) {
  const init = { method, credentials: "same-origin", cache: "no-store", signal };
  if (form) init.body = form;
  else if (body !== undefined) Object.assign(init, { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return parse(await fetch(path, init));
}

export const apiGet = (path, options = {}) => apiSend(path, { ...options, method: "GET" });

// Loads `path` (skipped while it is null) and exposes { data, error, loading, reload }.
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    if (!path) return undefined;
    const controller = new AbortController();
    let active = true;
    Promise.resolve().then(() => active && setState(s => ({ ...s, loading: true, error: null })));
    apiGet(path, { signal: controller.signal })
      .then(data => { if (active) setState({ data, error: null, loading: false }); })
      .catch(error => { if (active && error.name !== "AbortError") setState({ data: null, error, loading: false }); });
    return () => { active = false; controller.abort(); };
  }, [path, version]);
  return { ...state, reload };
}

export const errorMessage = error => error?.message || "Terjadi kesalahan. Coba lagi beberapa saat.";
