/**
 * Defects repository (API-first with localStorage fallback).
 *
 * This module is responsible for all persistence of Defects. It will:
 * - Prefer the Flask REST API at http://localhost:3001
 * - Fall back to localStorage if the API is unreachable or returns an error
 *
 * The UI can stay largely unchanged and call these helpers.
 */

/** @type {string} */
const STORAGE_KEY = "qdt.v1.state";

/** @type {string} */
const DEFAULT_API_BASE_URL = "http://localhost:3001";

/**
 * PUBLIC_INTERFACE
 * Get the API base URL. Uses REACT_APP_DEFECTS_API_BASE_URL if set, else defaults to localhost.
 * @returns {string}
 */
export function getApiBaseUrl() {
  // CRA exposes env vars prefixed with REACT_APP_
  const env = typeof process !== "undefined" ? process.env : undefined;
  const configured = env?.REACT_APP_DEFECTS_API_BASE_URL;
  return configured && String(configured).trim() ? String(configured).trim() : DEFAULT_API_BASE_URL;
}

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<Response>}
 */
async function apiFetch(path, init = {}, signal) {
  const url = `${getApiBaseUrl()}${path}`;
  const headers = {
    Accept: "application/json",
    ...(init.headers || {}),
  };

  // If we send a body, ensure JSON Content-Type unless already set.
  const hasBody = typeof init.body !== "undefined";
  if (hasBody) {
    const existing = Object.keys(headers).some((h) => h.toLowerCase() === "content-type");
    if (!existing) headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { ...init, headers, signal });
  return res;
}

/**
 * @param {Response} res
 * @returns {Promise<any>}
 */
async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * @returns {{defects:any[], lastIdSeed:number}}
 */
function loadLocalStateRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { defects: [], lastIdSeed: 0 };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.defects)) return { defects: [], lastIdSeed: 0 };
    return {
      defects: parsed.defects,
      lastIdSeed: typeof parsed.lastIdSeed === "number" ? parsed.lastIdSeed : parsed.defects.length,
    };
  } catch {
    return { defects: [], lastIdSeed: 0 };
  }
}

/**
 * @param {{defects:any[], lastIdSeed:number}} state
 */
function saveLocalStateRaw(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * @param {any} defect
 * @returns {any}
 */
function ensureId(defect) {
  // App already creates ids like def_xxx; backend might accept this.
  // If missing, generate a stable-ish id.
  if (defect && defect.id) return defect;
  return { ...(defect || {}), id: `def_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}` };
}

/**
 * Try a request and throw a readable error on non-2xx.
 * @param {() => Promise<Response>} req
 * @returns {Promise<any>}
 */
async function requestJson(req) {
  const res = await req();
  if (!res.ok) {
    const payload = await parseJsonSafe(res);
    const msg = payload?.error || payload?.message || `Request failed (${res.status})`;
    const err = new Error(msg);
    // @ts-ignore
    err.status = res.status;
    // @ts-ignore
    err.payload = payload;
    throw err;
  }
  return parseJsonSafe(res);
}

/**
 * PUBLIC_INTERFACE
 * Load all defects.
 * Returns defects plus a meta describing whether API or localStorage was used.
 *
 * @returns {Promise<{defects:any[], source:"api"|"local"}>}
 */
export async function listDefects() {
  try {
    const data = await requestJson(() => apiFetch("/defects", { method: "GET" }));
    const defects = Array.isArray(data) ? data : data?.defects;
    if (!Array.isArray(defects)) throw new Error("Invalid API response for GET /defects");
    return { defects, source: "api" };
  } catch {
    const local = loadLocalStateRaw();
    return { defects: Array.isArray(local.defects) ? local.defects : [], source: "local" };
  }
}

/**
 * PUBLIC_INTERFACE
 * Create a defect (API-first). Falls back to localStorage by upserting locally.
 *
 * @param {any} defect
 * @returns {Promise<{defect:any, source:"api"|"local"}>}
 */
export async function createDefect(defect) {
  const toSend = ensureId(defect);
  try {
    const created = await requestJson(() =>
      apiFetch("/defects", {
        method: "POST",
        body: JSON.stringify(toSend),
      })
    );

    // Accept either returned defect or echo.
    const out = created?.defect || created || toSend;
    return { defect: out, source: "api" };
  } catch {
    const local = loadLocalStateRaw();
    const next = [toSend, ...(local.defects || [])];
    saveLocalStateRaw({ defects: next, lastIdSeed: next.length });
    return { defect: toSend, source: "local" };
  }
}

/**
 * PUBLIC_INTERFACE
 * Update a defect (API-first). Falls back to localStorage by upserting locally.
 *
 * @param {string} id
 * @param {any} defect
 * @returns {Promise<{defect:any, source:"api"|"local"}>}
 */
export async function updateDefect(id, defect) {
  const toSend = ensureId({ ...(defect || {}), id });
  try {
    const updated = await requestJson(() =>
      apiFetch(`/defects/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(toSend),
      })
    );

    const out = updated?.defect || updated || toSend;
    return { defect: out, source: "api" };
  } catch {
    const local = loadLocalStateRaw();
    const arr = Array.isArray(local.defects) ? local.defects : [];
    const idx = arr.findIndex((d) => d?.id === id);
    const next = idx >= 0 ? [...arr.slice(0, idx), toSend, ...arr.slice(idx + 1)] : [toSend, ...arr];
    saveLocalStateRaw({ defects: next, lastIdSeed: next.length });
    return { defect: toSend, source: "local" };
  }
}

/**
 * PUBLIC_INTERFACE
 * Delete a defect (API-first). Falls back to localStorage by removing locally.
 *
 * @param {string} id
 * @returns {Promise<{source:"api"|"local"}>}
 */
export async function deleteDefectById(id) {
  try {
    await requestJson(() => apiFetch(`/defects/${encodeURIComponent(id)}`, { method: "DELETE" }));
    return { source: "api" };
  } catch {
    const local = loadLocalStateRaw();
    const arr = Array.isArray(local.defects) ? local.defects : [];
    const next = arr.filter((d) => d?.id !== id);
    saveLocalStateRaw({ defects: next, lastIdSeed: next.length });
    return { source: "local" };
  }
}
