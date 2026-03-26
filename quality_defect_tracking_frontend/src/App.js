import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

/**
 * LocalStorage-first, frontend-only Quality Defect Tracking & Root Cause Workflow SPA.
 * No backend/API calls are used; all persistence is in browser localStorage.
 */

/** @type {string} */
const STORAGE_KEY = "qdt.v1.state";

/** @type {string} */
const THEME_KEY = "qdt.v1.theme";

/**
 * Sorting requirements:
 * - Severity order: Critical > Major > Minor
 * - Date field: sort by created_at (latest first by default)
 *
 * Note: The app stores timestamps as createdAt/updatedAt (numbers). We map "created_at" to createdAt.
 */

/**
 * @typedef {"Open"|"In Progress"|"Resolved"|"Closed"} DefectStatus
 * @typedef {"Minor"|"Major"|"Critical"} Severity
 * @typedef {"New"|"Investigating"|"Actions In Progress"|"Validated"|"Closed"} WorkflowStage
 */

/**
 * @typedef {Object} CorrectiveAction
 * @property {string} id
 * @property {string} title
 * @property {string} owner
 * @property {string} dueDate  ISO yyyy-mm-dd
 * @property {"Planned"|"In Progress"|"Done"} status
 * @property {string} notes
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} RootCause
 * @property {WorkflowStage} stage
 * @property {string} problemStatement
 * @property {string} containment
 * @property {string} fiveWhys  Multi-line text
 * @property {string} fishbone  Multi-line text
 * @property {string[]} suspectedCauses
 * @property {string[]} verifiedCauses
 * @property {string} verificationNotes
 * @property {string} preventionNotes
 * @property {string} validationChecklist
 * @property {string} validatedBy
 * @property {string} validatedAt  ISO yyyy-mm-dd
 * @property {string} closureNotes
 */

/**
 * @typedef {Object} Defect
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {DefectStatus} status
 * @property {Severity} severity
 * @property {string} category
 * @property {string} area
 * @property {string} detectedOn  ISO yyyy-mm-dd
 * @property {string} detectedBy
 * @property {string} assignedTo
 * @property {string[]} tags
 * @property {string[]} evidenceLinks
 * @property {string} dueDate ISO yyyy-mm-dd
 * @property {string} resolutionSummary
 * @property {RootCause} rootCause
 * @property {CorrectiveAction[]} actions
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} AppState
 * @property {Defect[]} defects
 * @property {number} lastIdSeed
 */

/**
 * @typedef {Object} Filters
 * @property {string} query
 * @property {DefectStatus|"All"} status
 * @property {Severity|"All"} severity
 * @property {string} category
 * @property {string} area
 * @property {string} assignedTo
 * @property {string} tag
 * @property {"createdAt"|"severity"} sortBy
 * @property {"asc"|"desc"} sortDir
 */

/**
 * @param {string} prefix
 * @returns {string}
 */
function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return iso;
  }
}

/**
 * Severity rank per requirement: Critical > Major > Minor
 * @param {Severity} s
 * @returns {number}
 */
function severityRank(s) {
  return s === "Critical" ? 3 : s === "Major" ? 2 : 1;
}



/**
 * @returns {RootCause}
 */
function defaultRootCause() {
  return {
    stage: "New",
    problemStatement: "",
    containment: "",
    fiveWhys: "",
    fishbone: "",
    suspectedCauses: [],
    verifiedCauses: [],
    verificationNotes: "",
    preventionNotes: "",
    validationChecklist: "",
    validatedBy: "",
    validatedAt: "",
    closureNotes: "",
  };
}

/**
 * @returns {Defect}
 */
function makeEmptyDefect() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: uid("def"),
    title: "",
    description: "",
    status: "Open",
    severity: "Major",
    category: "Process",
    area: "Assembly",
    detectedOn: today,
    detectedBy: "",
    assignedTo: "",
    tags: [],
    evidenceLinks: [],
    dueDate: "",
    resolutionSummary: "",
    rootCause: defaultRootCause(),
    actions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * @returns {AppState}
 */
function seedState() {
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  /** @type {Defect[]} */
  const defects = [
    {
      id: uid("def"),
      title: "Torque out of spec on Line 2",
      description: "Fastener torque readings exceeded upper control limit in 3 consecutive checks.",
      status: "In Progress",
      severity: "Major",
      category: "Process",
      area: "Assembly",
      detectedOn: today,
      detectedBy: "QC Tech",
      assignedTo: "Alex",
      tags: ["torque", "line2", "control-chart"],
      evidenceLinks: ["https://example.com/evidence/torque-log"],
      dueDate: "",
      resolutionSummary: "",
      rootCause: {
        ...defaultRootCause(),
        stage: "Investigating",
        problemStatement: "Torque deviation beyond spec on Line 2 station A.",
        containment: "Quarantine affected lots; increase sampling to 100% for next 24h.",
        fiveWhys:
          "1) Why torque high? Tool drifted.\n2) Why drifted? Calibration overdue.\n3) Why overdue? Scheduling missed.\n4) Why missed? No alert.\n5) Why no alert? Manual tracker not updated.",
        fishbone:
          "Machine: tool wear\nMethod: calibration schedule\nMan: training\nMeasurement: sampling frequency\nMaterial: fastener batch variability\nEnvironment: humidity",
        suspectedCauses: ["Tool calibration overdue", "Operator technique variance"],
        verifiedCauses: [],
        verificationNotes: "",
        preventionNotes: "",
        validationChecklist: "",
        validatedBy: "",
        validatedAt: "",
        closureNotes: "",
      },
      actions: [
        {
          id: uid("act"),
          title: "Recalibrate torque tool and add weekly reminder",
          owner: "Alex",
          dueDate: today,
          status: "In Progress",
          notes: "Coordinate with maintenance; update calibration tracker.",
          createdAt: now - 1000 * 60 * 60 * 12,
          updatedAt: now - 1000 * 60 * 25,
        },
      ],
      createdAt: now - 1000 * 60 * 60 * 26,
      updatedAt: now - 1000 * 60 * 45,
    },
    {
      id: uid("def"),
      title: "Cosmetic scratch on finished housing",
      description: "Multiple units show surface scratch near logo region post-packaging.",
      status: "Open",
      severity: "Minor",
      category: "Material",
      area: "Packaging",
      detectedOn: today,
      detectedBy: "Inspector",
      assignedTo: "Sam",
      tags: ["cosmetic", "packaging"],
      evidenceLinks: [],
      dueDate: "",
      resolutionSummary: "",
      rootCause: {
        ...defaultRootCause(),
        stage: "New",
      },
      actions: [],
      createdAt: now - 1000 * 60 * 60 * 6,
      updatedAt: now - 1000 * 60 * 60 * 6,
    },
  ];

  return { defects, lastIdSeed: defects.length };
}

/**
 * @returns {AppState}
 */
function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.defects)) return seedState();

    // Backward compatibility: map any previous severities to the new spec
    /** @type {Defect[]} */
    const normalized = parsed.defects.map((d) => normalizeDefect(d));

    return {
      defects: normalized,
      lastIdSeed: typeof parsed.lastIdSeed === "number" ? parsed.lastIdSeed : normalized.length,
    };
  } catch {
    return seedState();
  }
}

/**
 * @param {AppState} state
 */
function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * @returns {"light"|"dark"}
 */
function loadTheme() {
  const t = window.localStorage.getItem(THEME_KEY);
  return t === "dark" ? "dark" : "light";
}

/**
 * @param {"light"|"dark"} theme
 */
function saveTheme(theme) {
  window.localStorage.setItem(THEME_KEY, theme);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function splitLinesToList(text) {
  return String(text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * @param {string[]} arr
 * @returns {string}
 */
function joinListToLines(arr) {
  return (arr || []).join("\n");
}

/**
 * Normalize older records (e.g., if prior versions used Low/Medium/High).
 * @param {any} d
 * @returns {Defect}
 */
function normalizeDefect(d) {
  const base = { ...makeEmptyDefect(), ...(d || {}) };

  /** @type {Severity} */
  let sev = base.severity;
  // Map previous values into Minor/Major/Critical
  // Low -> Minor, Medium/High -> Major, Critical -> Critical
  if (sev === "Low") sev = "Minor";
  else if (sev === "Medium" || sev === "High") sev = "Major";
  else if (sev !== "Minor" && sev !== "Major" && sev !== "Critical") sev = "Major";

  return {
    ...base,
    severity: sev,
    rootCause: { ...defaultRootCause(), ...(base.rootCause || {}) },
    actions: Array.isArray(base.actions) ? base.actions : [],
    createdAt: typeof base.createdAt === "number" ? base.createdAt : Date.now(),
    updatedAt: typeof base.updatedAt === "number" ? base.updatedAt : Date.now(),
  };
}

/**
 * @param {Defect} d
 * @param {Filters} f
 * @returns {boolean}
 */
function defectMatchesFilters(d, f) {
  const q = f.query.trim().toLowerCase();
  const tag = f.tag.trim().toLowerCase();

  const qHit =
    !q ||
    [d.title, d.description, d.category, d.area, d.detectedBy, d.assignedTo, d.status, d.severity]
      .filter(Boolean)
      .some((x) => String(x).toLowerCase().includes(q)) ||
    (d.tags || []).some((t) => t.toLowerCase().includes(q)) ||
    (d.rootCause?.suspectedCauses || []).some((c) => c.toLowerCase().includes(q)) ||
    (d.rootCause?.verifiedCauses || []).some((c) => c.toLowerCase().includes(q));

  if (!qHit) return false;
  if (f.status !== "All" && d.status !== f.status) return false;
  if (f.severity !== "All" && d.severity !== f.severity) return false;
  if (f.category && d.category !== f.category) return false;
  if (f.area && d.area !== f.area) return false;
  if (f.assignedTo && d.assignedTo !== f.assignedTo) return false;
  if (tag && !(d.tags || []).some((t) => t.toLowerCase().includes(tag))) return false;

  return true;
}

/**
 * Sorting rules:
 * - createdAt desc by default (latest first)
 * - if sorting by severity: Critical > Major > Minor (desc means highest severity first)
 *
 * @param {Defect[]} defects
 * @param {Filters} filters
 * @returns {Defect[]}
 */
function filterAndSortDefects(defects, filters) {
  const filtered = defects.filter((d) => defectMatchesFilters(d, filters));
  const dir = filters.sortDir === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    const key = filters.sortBy;
    let av = 0;
    let bv = 0;

    if (key === "createdAt") {
      av = a.createdAt || 0;
      bv = b.createdAt || 0;
    } else if (key === "severity") {
      av = severityRank(a.severity);
      bv = severityRank(b.severity);
    }

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;

    // Secondary tie-break: newest createdAt first to keep stable feel
    const ac = a.createdAt || 0;
    const bc = b.createdAt || 0;
    if (ac < bc) return 1;
    if (ac > bc) return -1;
    return 0;
  });

  return filtered;
}

/**
 * @param {Defect} d
 * @returns {number} 0..100
 */
function workflowProgress(d) {
  const stage = d.rootCause?.stage || "New";
  const map = {
    New: 10,
    Investigating: 35,
    "Actions In Progress": 60,
    Validated: 85,
    Closed: 100,
  };
  return map[stage] ?? 10;
}

/**
 * @param {Defect[]} defects
 */
function exportCsv(defects) {
  const header = ["id", "title", "severity", "status", "category", "area", "detectedOn", "created_at", "updated_at", "assignedTo", "tags"];

  const rows = defects.map((d) => [
    d.id,
    d.title || "",
    d.severity,
    d.status,
    d.category || "",
    d.area || "",
    d.detectedOn || "",
    new Date(d.createdAt || 0).toISOString(),
    new Date(d.updatedAt || d.createdAt || 0).toISOString(),
    d.assignedTo || "",
    (d.tags || []).join("|"),
  ]);

  const csv =
    header.join(",") +
    "\n" +
    rows.map((r) => r.map((x) => `"${String(x ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quality-defects_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Simple client-side printable report (used as "PDF" via browser print dialog -> Save as PDF).
 * @param {Defect[]} defects
 */
function exportPrintablePdf(defects) {
  const now = new Date();
  const stamp = now.toLocaleString();

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // Keep report focused (per requirement): defect list, severity, status, dates.
  const rows = defects
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((d) => {
      const created = d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : "";
      const updated = d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 10) : "";
      return `<tr>
        <td>${escapeHtml(d.title || "(Untitled)")}</td>
        <td>${escapeHtml(d.severity)}</td>
        <td>${escapeHtml(d.status)}</td>
        <td>${escapeHtml(created)}</td>
        <td>${escapeHtml(updated)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Quality Defect Report</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 0; padding: 24px; color: #0f172a; }
    .printHeader { display:flex; justify-content: space-between; gap:16px; align-items: baseline; }
    .printTitle { font-size: 18px; font-weight: 900; letter-spacing: -0.02em; }
    .printMeta { font-size: 12px; color: #475569; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; vertical-align: top; }
    th { background: #f8fafc; text-align:left; font-weight: 900; }
    .printFooter { margin-top: 14px; font-size: 11px; color: #64748b; }
    @media print { body { padding: 0; } .wrap { padding: 18px; } }
  </style>
</head>
<body>
  <div class="wrap printReport">
    <div class="printHeader">
      <div class="printTitle">Quality Defect Report</div>
      <div class="printMeta">Generated ${escapeHtml(stamp)} • Total ${defects.length}</div>
    </div>
    <table class="printTable">
      <thead>
        <tr>
          <th>Defect</th>
          <th>Severity</th>
          <th>Status</th>
          <th>Created</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="printFooter">Tip: Use your browser print dialog to “Save as PDF”.</div>
  </div>
  <script>window.focus();</script>
</body>
</html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=960,height=720");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Let layout settle before prompting print.
  setTimeout(() => {
    w.focus();
    w.print();
  }, 250);
  return true;
}

/**
 * @param {Defect[]} defects
 * @returns {{open:number,inProgress:number,resolved:number,closed:number,total:number,critical:number,major:number,minor:number}}
 */
function computeStats(defects) {
  const total = defects.length;
  const open = defects.filter((d) => d.status === "Open").length;
  const inProgress = defects.filter((d) => d.status === "In Progress").length;
  const resolved = defects.filter((d) => d.status === "Resolved").length;
  const closed = defects.filter((d) => d.status === "Closed").length;
  const critical = defects.filter((d) => d.severity === "Critical").length;
  const major = defects.filter((d) => d.severity === "Major").length;
  const minor = defects.filter((d) => d.severity === "Minor").length;
  return { open, inProgress, resolved, closed, total, critical, major, minor };
}

/**
 * @param {Defect[]} defects
 * @returns {string[]}
 */
function uniqueValues(defects, picker) {
  const set = new Set();
  for (const d of defects) {
    const v = picker(d);
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * @param {{open: boolean, title: string, description?: string, children: any, onClose: () => void, footer?: any}} props
 */
function Modal({ open, title, description, children, onClose, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // Basic focus trap
        const el = panelRef.current;
        if (!el) return;
        const focusables = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        // @ts-ignore
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          // @ts-ignore
          last.focus();
          // @ts-ignore
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          // @ts-ignore
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const el = panelRef.current;
        if (!el) return;
        const firstInput = el.querySelector("input, textarea, select, button");
        if (firstInput && typeof firstInput.focus === "function") firstInput.focus();
      }, 0);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modalPanel" ref={panelRef}>
        <div className="modalHeader">
          <div className="modalHeaderText">
            <div className="modalTitle">{title}</div>
            {description ? <div className="modalDescription">{description}</div> : null}
          </div>
          <button className="iconButton" onClick={onClose} aria-label="Close dialog">
            ✕
          </button>
        </div>

        <div className="modalBody">{children}</div>

        {footer ? <div className="modalFooter">{footer}</div> : null}
      </div>
      <button className="modalBackdropButton" aria-label="Close" onClick={onClose} />
    </div>
  );
}

/**
 * @param {{label: string, value: string, onChange: (v: string) => void, placeholder?: string, icon?: string}} props
 */
function SearchInput({ label, value, onChange, placeholder, icon }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <div className="inputWithIcon">
        <span className="inputIcon" aria-hidden="true">
          {icon || "🔎"}
        </span>
        <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      </div>
    </label>
  );
}

/**
 * @param {{label: string, value: string, onChange: (v: string) => void, placeholder?: string}} props
 */
function TextInput({ label, value, onChange, placeholder }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * @param {{label: string, value: string, onChange: (v: string) => void, placeholder?: string, rows?: number}} props
 */
function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <textarea className="textarea" value={value} placeholder={placeholder} rows={rows} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

/**
 * @param {{label: string, value: string, onChange: (v: string) => void, options: {value: string, label: string}[]}} props
 */
function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * @param {{severity: Severity}} props
 */
function SeverityPill({ severity }) {
  const cls = severity === "Critical" ? "pill pillCritical" : severity === "Major" ? "pill pillHigh" : "pill pillLow";
  return <span className={cls}>{severity}</span>;
}

/**
 * @param {{status: DefectStatus}} props
 */
function StatusPill({ status }) {
  const cls =
    status === "Open"
      ? "pill pillOpen"
      : status === "In Progress"
        ? "pill pillProgress"
        : status === "Resolved"
          ? "pill pillResolved"
          : "pill pillClosed";
  return <span className={cls}>{status}</span>;
}

/**
 * @param {{value: number}} props
 */
function ProgressBar({ value }) {
  return (
    <div className="progressOuter" aria-label={`Workflow progress ${value}%`}>
      <div className="progressInner" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/**
 * @param {{title:string, value:string, hint?:string, tone?:"primary"|"success"|"danger"|"neutral", icon?: string}} props
 */
function StatCard({ title, value, hint, tone = "neutral", icon }) {
  const toneIcon = tone === "danger" ? "⚠" : tone === "success" ? "✓" : tone === "primary" ? "↗" : "●";
  return (
    <div className={`card statCard statTone_${tone}`}>
      <div className="statTop">
        <div className="statTitle">{title}</div>
        <div className="statIcon" aria-hidden="true">
          {icon || toneIcon}
        </div>
      </div>
      <div className="statValue">{value}</div>
      {hint ? <div className="statHint">{hint}</div> : null}
    </div>
  );
}

/**
 * @param {{defect: Defect, onSelect: () => void, selected?: boolean}} props
 */
function DefectCard({ defect, onSelect, selected = false }) {
  const progress = workflowProgress(defect);
  const openActions = (defect.actions || []).filter((a) => a.status !== "Done").length;

  return (
    <button className={`card defectRow ${selected ? "defectRowSelected" : ""}`} onClick={onSelect} aria-label={`Open defect ${defect.title || "(Untitled defect)"}`}>
      <div className="defectRowMain">
        <div className="defectRowCol defectRowTitleCol">
          <div className="defectRowTitleLine">
            <span className="defectTitle">{defect.title || "(Untitled defect)"}</span>
          </div>
          <div className="defectRowSubLine">
            <span className="mutedSmall">
              {defect.category || "—"} <span className="metaDot">•</span> {defect.area || "—"}
            </span>
            {defect.description ? <span className="defectRowDesc">{defect.description}</span> : null}
          </div>
        </div>

        <div className="defectRowCol defectRowPillsCol">
          <div className="defectPills">
            <StatusPill status={defect.status} />
            <SeverityPill severity={defect.severity} />
          </div>
        </div>

        <div className="defectRowCol defectRowMetaCol">
          <div className="defectRowMetaGrid">
            <div className="defectRowMetaItem">
              <span className="defectRowMetaKey">Detected</span>
              <span className="defectRowMetaVal">{formatDate(defect.detectedOn) || "—"}</span>
            </div>
            <div className="defectRowMetaItem">
              <span className="defectRowMetaKey">Owner</span>
              <span className="defectRowMetaVal">{defect.assignedTo || "Unassigned"}</span>
            </div>
            <div className="defectRowMetaItem">
              <span className="defectRowMetaKey">Created</span>
              <span className="defectRowMetaVal">{defect.createdAt ? formatDate(new Date(defect.createdAt).toISOString()) : "—"}</span>
            </div>
            <div className="defectRowMetaItem">
              <span className="defectRowMetaKey">Actions</span>
              <span className="defectRowMetaVal">{openActions} open</span>
            </div>
          </div>
        </div>

        <div className="defectRowCol defectRowProgressCol" aria-hidden="true">
          <div className="defectRowProgressTrack">
            <div className="defectRowProgressFill" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
          </div>
          <div className="defectRowProgressText">{progress}%</div>
        </div>
      </div>

      <div className="defectRowTags">
        {(defect.tags || []).slice(0, 6).map((t) => (
          <span key={t} className="tagChip">
            {t}
          </span>
        ))}
        {(defect.tags || []).length > 6 ? <span className="tagMore">+{(defect.tags || []).length - 6}</span> : null}
      </div>
    </button>
  );
}

/**
 * Toast manager (top-right stack).
 * @typedef {{id:string, type:"info"|"success"|"danger", message:string}} ToastItem
 */

// PUBLIC_INTERFACE
function App() {
  /** @type {[AppState, Function]} */
  const [state, setState] = useState(() => loadState());
  const [theme, setTheme] = useState(() => loadTheme());

  /** @type {[string, Function]} */
  const [view, setView] = useState("dashboard"); // "dashboard" | "defects" | "tools"
  const [selectedId, setSelectedId] = useState(/** @type {string|null} */ (null));

  /** @type {[Filters, Function]} */
  const [filters, setFilters] = useState(
    /** @type {Filters} */ ({
      query: "",
      status: "All",
      severity: "All",
      category: "",
      area: "",
      assignedTo: "",
      tag: "",
      sortBy: "createdAt",
      sortDir: "desc",
    })
  );

  const [isNewOpen, setIsNewOpen] = useState(false);
  const [draft, setDraft] = useState(/** @type {Defect|null} */ (null));

  const [toastItems, setToastItems] = useState(/** @type {ToastItem[]} */ ([]));

  // Persist state to localStorage on change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Apply & persist theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    saveTheme(theme);
  }, [theme]);

  // Auto-clear toasts
  useEffect(() => {
    if (!toastItems.length) return;
    const timers = toastItems.map((t) =>
      setTimeout(() => {
        setToastItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200)
    );
    return () => timers.forEach((id) => clearTimeout(id));
  }, [toastItems]);

  const defects = useMemo(() => state.defects || [], [state.defects]);

  const stats = useMemo(() => computeStats(defects), [defects]);

  const categories = useMemo(() => uniqueValues(defects, (d) => d.category), [defects]);
  const areas = useMemo(() => uniqueValues(defects, (d) => d.area), [defects]);
  const assignees = useMemo(() => uniqueValues(defects, (d) => d.assignedTo), [defects]);

  const filtered = useMemo(() => filterAndSortDefects(defects, filters), [defects, filters]);

  const selectedDefect = useMemo(() => defects.find((d) => d.id === selectedId) || null, [defects, selectedId]);

  const statusOptions = /** @type {{value: DefectStatus|"All", label: string}[]} */ ([
    { value: "All", label: "All statuses" },
    { value: "Open", label: "Open" },
    { value: "In Progress", label: "In Progress" },
    { value: "Resolved", label: "Resolved" },
    { value: "Closed", label: "Closed" },
  ]);

  const severityOptions = /** @type {{value: Severity|"All", label: string}[]} */ ([
    { value: "All", label: "All severities" },
    { value: "Critical", label: "Critical" },
    { value: "Major", label: "Major" },
    { value: "Minor", label: "Minor" },
  ]);

  const workflowStageOptions = /** @type {{value: WorkflowStage, label: string}[]} */ ([
    { value: "New", label: "New" },
    { value: "Investigating", label: "Investigating" },
    { value: "Actions In Progress", label: "Actions In Progress" },
    { value: "Validated", label: "Validated" },
    { value: "Closed", label: "Closed" },
  ]);

  const actionStatusOptions = [
    { value: "Planned", label: "Planned" },
    { value: "In Progress", label: "In Progress" },
    { value: "Done", label: "Done" },
  ];

  /**
   * PUBLIC_INTERFACE
   * Show a small top-right toast message.
   * @param {"info"|"success"|"danger"} type
   * @param {string} message
   */
  function showToast(type, message) {
    setToastItems((prev) => [{ id: uid("toast"), type, message }, ...prev].slice(0, 3));
  }

  // PUBLIC_INTERFACE
  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  // PUBLIC_INTERFACE
  function openNewDefect() {
    setDraft(makeEmptyDefect());
    setIsNewOpen(true);
  }

  /**
   * @param {Defect} d
   * @param {{reason?: "create"|"update"}} [opts]
   */
  function upsertDefect(d, opts) {
    setState((prev) => {
      const next = { ...prev };
      const now = Date.now();
      const updated = normalizeDefect({ ...d, updatedAt: now });

      const idx = (next.defects || []).findIndex((x) => x.id === d.id);
      if (idx >= 0) {
        next.defects = [...next.defects.slice(0, idx), updated, ...next.defects.slice(idx + 1)];
      } else {
        next.defects = [updated, ...(next.defects || [])];
      }
      return next;
    });

    if (opts?.reason === "create") showToast("success", "Defect added.");
    if (opts?.reason === "update") showToast("success", "Defect updated.");
  }

  /**
   * @param {string} id
   */
  function deleteDefect(id) {
    setState((prev) => ({ ...prev, defects: (prev.defects || []).filter((d) => d.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    showToast("success", "Defect deleted.");
  }

  /**
   * @param {Defect} d
   */
  function openDefectDetails(d) {
    setSelectedId(d.id);
    setView("defects");
  }

  /**
   * @param {Defect} base
   * @param {Partial<Defect>} patch
   */
  function patchDefect(base, patch) {
    const next = normalizeDefect({ ...base, ...patch, updatedAt: Date.now() });
    upsertDefect(next, { reason: "update" });
  }

  /**
   * @param {Defect} d
   * @param {Partial<RootCause>} patch
   */
  function patchRootCause(d, patch) {
    const next = normalizeDefect({
      ...d,
      rootCause: { ...defaultRootCause(), ...(d.rootCause || {}), ...patch },
      updatedAt: Date.now(),
    });
    upsertDefect(next, { reason: "update" });
  }

  /**
   * @param {Defect} d
   */
  function addAction(d) {
    const now = Date.now();
    const action = {
      id: uid("act"),
      title: "",
      owner: d.assignedTo || "",
      dueDate: "",
      status: "Planned",
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    const next = normalizeDefect({ ...d, actions: [action, ...(d.actions || [])], updatedAt: now });
    upsertDefect(next, { reason: "update" });
    showToast("success", "Action added.");
  }

  /**
   * @param {Defect} d
   * @param {string} actionId
   * @param {Partial<CorrectiveAction>} patch
   */
  function patchAction(d, actionId, patch) {
    const now = Date.now();
    const actions = (d.actions || []).map((a) => (a.id === actionId ? { ...a, ...patch, updatedAt: now } : a));
    upsertDefect(normalizeDefect({ ...d, actions, updatedAt: now }), { reason: "update" });
  }

  /**
   * @param {Defect} d
   * @param {string} actionId
   */
  function deleteAction(d, actionId) {
    const now = Date.now();
    const actions = (d.actions || []).filter((a) => a.id !== actionId);
    upsertDefect(normalizeDefect({ ...d, actions, updatedAt: now }), { reason: "update" });
    showToast("success", "Action deleted.");
  }

  /**
   * @param {Defect} d
   */
  function quickAdvanceWorkflow(d) {
    const stage = d.rootCause?.stage || "New";
    const order = ["New", "Investigating", "Actions In Progress", "Validated", "Closed"];
    const idx = order.indexOf(stage);
    const nextStage = order[Math.min(order.length - 1, Math.max(0, idx + 1))];
    patchRootCause(d, { stage: /** @type {WorkflowStage} */ (nextStage) });
    showToast("success", `Workflow advanced to "${nextStage}".`);
  }

  /**
   * @param {Defect} d
   */
  function quickSetResolved(d) {
    const nextStatus = d.status === "Resolved" ? "In Progress" : "Resolved";
    patchDefect(d, { status: /** @type {DefectStatus} */ (nextStatus) });
  }

  /**
   * @param {Defect} d
   */
  function quickSetClosed(d) {
    const nextStatus = d.status === "Closed" ? "Resolved" : "Closed";
    patchDefect(d, { status: /** @type {DefectStatus} */ (nextStatus) });
  }

  /**
   * @param {Defect} d
   */
  function duplicateDefect(d) {
    const now = Date.now();
    const copy = normalizeDefect({
      ...d,
      id: uid("def"),
      title: `${d.title} (copy)`,
      status: "Open",
      rootCause: { ...defaultRootCause(), ...(d.rootCause || {}), stage: "New" },
      actions: [],
      createdAt: now,
      updatedAt: now,
    });
    setState((prev) => ({ ...prev, defects: [copy, ...(prev.defects || [])] }));
    showToast("success", "Defect duplicated.");
  }

  function resetDemoData() {
    setState(seedState());
    setSelectedId(null);
    setFilters({
      query: "",
      status: "All",
      severity: "All",
      category: "",
      area: "",
      assignedTo: "",
      tag: "",
      sortBy: "createdAt",
      sortDir: "desc",
    });
    showToast("success", "Demo dataset restored.");
  }

  function clearAllData() {
    setState({ defects: [], lastIdSeed: 0 });
    setSelectedId(null);
    showToast("danger", "All defects removed (localStorage cleared for this app state).");
  }

  function doExportCsv() {
    exportCsv(defects);
    showToast("success", "Exported CSV.");
  }

  function doExportPdf() {
    const ok = exportPrintablePdf(defects);
    if (ok) showToast("success", "Opened printable report (Save as PDF).");
    else showToast("danger", "Popup blocked. Allow popups to export PDF report.");
  }

  const headerSubtitle =
    view === "dashboard"
      ? "Analytics and at-a-glance quality health"
      : view === "defects"
        ? "Log, search, triage, and drive root-cause + corrective actions"
        : "Export and local data controls";

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            Q
          </div>
          <div className="brandText">
            <div className="brandTitle">Quality Defect Tracker</div>
            <div className="brandSub">{headerSubtitle}</div>
          </div>
        </div>

        <nav className="nav" aria-label="Primary">
          <button className={`navBtn ${view === "dashboard" ? "navBtnActive" : ""}`} onClick={() => setView("dashboard")}>
            Dashboard
          </button>
          <button className={`navBtn ${view === "defects" ? "navBtnActive" : ""}`} onClick={() => setView("defects")}>
            Defects
          </button>
          <button className={`navBtn ${view === "tools" ? "navBtnActive" : ""}`} onClick={() => setView("tools")}>
            Data Tools
          </button>
        </nav>

        <div className="topbarActions">
          <button className="btn btnPrimary" onClick={openNewDefect}>
            + New defect
          </button>
          <button className="btn btnGhost" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "light" ? "Dark" : "Light"}
          </button>
        </div>
      </header>

      <main className="content">
        {view === "dashboard" ? (
          <>
            <section className="sectionHeader">
              <div className="sectionTitle">Dashboard</div>
              <div className="sectionActions">
                <button className="btn btnGhost" onClick={() => setView("defects")}>
                  View defects
                </button>
                <button className="btn btnGhost" onClick={doExportCsv}>
                  Export CSV
                </button>
                <button className="btn btnGhost" onClick={doExportPdf}>
                  Export PDF
                </button>
              </div>
            </section>

            <section className="gridStats">
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="Total defects" value={String(stats.total)} hint="All logged items" tone="neutral" icon="Σ" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="Open" value={String(stats.open)} hint="Needs attention" tone="danger" icon="!" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="In progress" value={String(stats.inProgress)} hint="Being investigated" tone="primary" icon="⟳" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="Resolved/Closed" value={String(stats.resolved + stats.closed)} hint="Completed items" tone="success" icon="✓" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="Critical" value={String(stats.critical)} hint="Highest severity" tone="danger" icon="▲" />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <StatCard title="Major/Minor" value={String(stats.major + stats.minor)} hint="Remaining items" tone="primary" icon="☑" />
              </div>
            </section>

            <section className="gridTwo">
              <div className="card">
                <div className="cardHeader">
                  <div>
                    <div className="cardTitle">Status distribution</div>
                    <div className="cardSub">Quick snapshot of triage state</div>
                  </div>
                </div>

                <div className="barList">
                  {[
                    { label: "Open", count: stats.open, cls: "barDanger" },
                    { label: "In Progress", count: stats.inProgress, cls: "barPrimary" },
                    { label: "Resolved", count: stats.resolved, cls: "barSuccess" },
                    { label: "Closed", count: stats.closed, cls: "barNeutral" },
                  ].map((x) => {
                    const pct = stats.total ? Math.round((x.count / stats.total) * 100) : 0;
                    return (
                      <div key={x.label} className="barRow">
                        <div className="barMeta">
                          <span className="barLabel">{x.label}</span>
                          <span className="barCount">
                            {x.count} <span className="barPct">({pct}%)</span>
                          </span>
                        </div>
                        <div className="barTrack">
                          <div className={`barFill ${x.cls}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="cardFooter">
                  <div className="muted">
                    Tip: Use <strong>Defects</strong> view to search, filter, and sort by <strong>created date</strong> or <strong>severity</strong>.
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="cardHeader">
                  <div>
                    <div className="cardTitle">Recently created</div>
                    <div className="cardSub">Latest logged defects</div>
                  </div>
                </div>

                <div className="recentList">
                  {(defects || [])
                    .slice()
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 5)
                    .map((d) => (
                      <button key={d.id} className="recentItem" onClick={() => openDefectDetails(d)}>
                        <div className="recentTop">
                          <div className="recentTitle">{d.title || "(Untitled defect)"}</div>
                          <div className="recentPills">
                            <StatusPill status={d.status} />
                            <SeverityPill severity={d.severity} />
                          </div>
                        </div>
                        <div className="recentBottom">
                          <span className="mutedSmall">Created {d.createdAt ? formatDate(new Date(d.createdAt).toISOString()) : "—"}</span>
                          <span className="mutedSmall">Workflow {d.rootCause?.stage || "New"}</span>
                        </div>
                      </button>
                    ))}
                  {defects.length === 0 ? <div className="emptyState">No defects yet. Create one to get started.</div> : null}
                </div>
              </div>
            </section>
          </>
        ) : null}

        {view === "defects" ? (
          <div className="gridDefects">
            <section className="card filtersCard">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Filters</div>
                  <div className="cardSub">Search, segment, and sort your defects</div>
                </div>
                <div className="cardHeaderActions">
                  <button className="btn btnGhost" onClick={() => setSelectedId(null)}>
                    Clear selection
                  </button>
                </div>
              </div>

              <div className="filtersGrid">
                <SearchInput label="Search" value={filters.query} placeholder="Title, description, tags, causes…" onChange={(v) => setFilters((f) => ({ ...f, query: v }))} />

                <Select label="Status" value={filters.status} onChange={(v) => setFilters((f) => ({ ...f, status: v }))} options={statusOptions} />

                <Select label="Severity" value={filters.severity} onChange={(v) => setFilters((f) => ({ ...f, severity: v }))} options={severityOptions} />

                <Select
                  label="Category"
                  value={filters.category}
                  onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                  options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]}
                />

                <Select label="Area" value={filters.area} onChange={(v) => setFilters((f) => ({ ...f, area: v }))} options={[{ value: "", label: "All areas" }, ...areas.map((a) => ({ value: a, label: a }))]} />

                <Select
                  label="Assigned to"
                  value={filters.assignedTo}
                  onChange={(v) => setFilters((f) => ({ ...f, assignedTo: v }))}
                  options={[{ value: "", label: "Anyone" }, ...assignees.map((a) => ({ value: a, label: a || "—" }))]}
                />

                <TextInput label="Tag contains" value={filters.tag} onChange={(v) => setFilters((f) => ({ ...f, tag: v }))} placeholder="e.g. torque" />

                <div className="inlineTwo">
                  <Select
                    label="Sort"
                    value={filters.sortBy}
                    onChange={(v) => setFilters((f) => ({ ...f, sortBy: v }))}
                    options={[
                      { value: "createdAt", label: "Created date" },
                      { value: "severity", label: "Severity" },
                    ]}
                  />
                  <Select
                    label="Dir"
                    value={filters.sortDir}
                    onChange={(v) => setFilters((f) => ({ ...f, sortDir: v }))}
                    options={[
                      { value: "desc", label: "Desc" },
                      { value: "asc", label: "Asc" },
                    ]}
                  />
                </div>
              </div>

              <div className="cardFooter">
                <div className="muted">
                  Showing <strong>{filtered.length}</strong> of <strong>{defects.length}</strong> defects
                </div>
                <div className="rightActions">
                  <button
                    className="btn btnGhost"
                    onClick={() =>
                      setFilters({
                        query: "",
                        status: "All",
                        severity: "All",
                        category: "",
                        area: "",
                        assignedTo: "",
                        tag: "",
                        sortBy: "createdAt",
                        sortDir: "desc",
                      })
                    }
                  >
                    Reset
                  </button>
                  <button className="btn btnPrimary" onClick={openNewDefect}>
                    + New
                  </button>
                </div>
              </div>
            </section>

            <section className="defectsList">
              <div className="sectionHeader compactHeader">
                <div className="sectionTitle">Defects</div>
                <div className="sectionActions">
                  <button className="btn btnGhost" onClick={doExportCsv}>
                    Export CSV
                  </button>
                  <button className="btn btnGhost" onClick={doExportPdf}>
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="defectCards defectRows">
                {filtered.map((d) => (
                  <DefectCard key={d.id} defect={d} selected={d.id === selectedId} onSelect={() => setSelectedId(d.id)} />
                ))}
                {filtered.length === 0 ? (
                  <div className="emptyState">
                    No results. Try clearing filters or create a new defect.
                    <div className="emptyActions">
                      <button className="btn btnPrimary" onClick={openNewDefect}>
                        + New defect
                      </button>
                      <button className="btn btnGhost" onClick={() => setFilters((f) => ({ ...f, query: "" }))}>
                        Clear search
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="card detailsCard">
              <div className="cardHeader">
                <div>
                  <div className="cardTitle">Defect details</div>
                  <div className="cardSub">{selectedDefect ? "Triage, workflow, and corrective actions" : "Select a defect to begin"}</div>
                </div>
              </div>

              {!selectedDefect ? (
                <div className="emptyState">Select a defect card to see details here. This panel is optimized for quick triage and deeper workflow editing.</div>
              ) : (
                <div className="detailsBody">
                  <div className="detailsHero">
                    <div className="detailsHeroTop">
                      <div className="detailsTitle">{selectedDefect.title || "(Untitled defect)"}</div>
                      <div className="detailsPills">
                        <StatusPill status={selectedDefect.status} />
                        <SeverityPill severity={selectedDefect.severity} />
                      </div>
                    </div>

                    <div className="detailsHeroMeta">
                      <div className="detailsMetaItem">
                        <div className="detailsMetaLabel">Area</div>
                        <div className="detailsMetaValue">{selectedDefect.area || "—"}</div>
                      </div>
                      <div className="detailsMetaItem">
                        <div className="detailsMetaLabel">Category</div>
                        <div className="detailsMetaValue">{selectedDefect.category || "—"}</div>
                      </div>
                      <div className="detailsMetaItem">
                        <div className="detailsMetaLabel">Detected</div>
                        <div className="detailsMetaValue">{selectedDefect.detectedOn ? formatDate(selectedDefect.detectedOn) : "—"}</div>
                      </div>
                      <div className="detailsMetaItem">
                        <div className="detailsMetaLabel">Owner</div>
                        <div className="detailsMetaValue">{selectedDefect.assignedTo || "Unassigned"}</div>
                      </div>
                      <div className="detailsMetaItem">
                        <div className="detailsMetaLabel">Created</div>
                        <div className="detailsMetaValue">{selectedDefect.createdAt ? formatDate(new Date(selectedDefect.createdAt).toISOString()) : "—"}</div>
                      </div>
                    </div>

                    <div className="detailsHeroProgress">
                      <div className="detailsProgressTop">
                        <span className="mutedSmall">Workflow progress</span>
                        <span className="mutedSmall">{workflowProgress(selectedDefect)}%</span>
                      </div>
                      <ProgressBar value={workflowProgress(selectedDefect)} />
                    </div>

                    <div className="detailsActionsRow">
                      <button className="btn btnSmall btnGhost" onClick={() => quickAdvanceWorkflow(selectedDefect)}>
                        Advance workflow
                      </button>
                      <button className="btn btnSmall btnGhost" onClick={() => quickSetResolved(selectedDefect)}>
                        Toggle Resolved
                      </button>
                      <button className="btn btnSmall btnGhost" onClick={() => quickSetClosed(selectedDefect)}>
                        Toggle Closed
                      </button>
                      <button className="btn btnSmall btnGhost" onClick={() => duplicateDefect(selectedDefect)}>
                        Duplicate
                      </button>
                      <button className="btn btnSmall btnDanger" onClick={() => deleteDefect(selectedDefect.id)}>
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="divider" />

                  <section className="detailsSection">
                    <div className="detailsSectionHeader">
                      <div>
                        <div className="detailsSectionTitle">Summary</div>
                        <div className="detailsSectionSub">Core fields to triage and route the defect</div>
                      </div>
                    </div>

                    <div className="detailsGrid">
                      <TextInput label="Title" value={selectedDefect.title} onChange={(v) => patchDefect(selectedDefect, { title: v })} placeholder="Short summary" />
                      <Select label="Status" value={selectedDefect.status} onChange={(v) => patchDefect(selectedDefect, { status: v })} options={statusOptions.filter((o) => o.value !== "All")} />
                      <Select label="Severity" value={selectedDefect.severity} onChange={(v) => patchDefect(selectedDefect, { severity: v })} options={severityOptions.filter((o) => o.value !== "All")} />
                      <TextInput label="Category" value={selectedDefect.category} onChange={(v) => patchDefect(selectedDefect, { category: v })} placeholder="e.g. Process" />
                      <TextInput label="Area" value={selectedDefect.area} onChange={(v) => patchDefect(selectedDefect, { area: v })} placeholder="e.g. Assembly" />
                      <TextInput label="Detected by" value={selectedDefect.detectedBy} onChange={(v) => patchDefect(selectedDefect, { detectedBy: v })} placeholder="Person / role" />
                      <TextInput label="Assigned to" value={selectedDefect.assignedTo} onChange={(v) => patchDefect(selectedDefect, { assignedTo: v })} placeholder="Owner" />
                      <label className="field">
                        <span className="label">Detected on</span>
                        <input className="input" type="date" value={selectedDefect.detectedOn || ""} onChange={(e) => patchDefect(selectedDefect, { detectedOn: e.target.value })} />
                      </label>
                      <label className="field">
                        <span className="label">Due date</span>
                        <input className="input" type="date" value={selectedDefect.dueDate || ""} onChange={(e) => patchDefect(selectedDefect, { dueDate: e.target.value })} />
                      </label>

                      <TextArea label="Description" value={selectedDefect.description} onChange={(v) => patchDefect(selectedDefect, { description: v })} placeholder="What happened? Where? Impact?" rows={4} />

                      <TextArea
                        label="Resolution summary"
                        value={selectedDefect.resolutionSummary}
                        onChange={(v) => patchDefect(selectedDefect, { resolutionSummary: v })}
                        placeholder="When resolved, capture summary + evidence"
                        rows={3}
                      />

                      <label className="field">
                        <span className="label">Tags (comma separated)</span>
                        <input className="input" value={(selectedDefect.tags || []).join(", ")} onChange={(e) => patchDefect(selectedDefect, { tags: asStringArray(e.target.value) })} placeholder="e.g. torque, line2" />
                      </label>

                      <label className="field">
                        <span className="label">Evidence links (comma separated)</span>
                        <input
                          className="input"
                          value={(selectedDefect.evidenceLinks || []).join(", ")}
                          onChange={(e) => patchDefect(selectedDefect, { evidenceLinks: asStringArray(e.target.value) })}
                          placeholder="URLs to logs/photos"
                        />
                      </label>
                    </div>
                  </section>

                  <div className="divider" />

                  <section className="detailsSection">
                    <div className="detailsSectionHeader">
                      <div>
                        <div className="detailsSectionTitle">Root-cause workflow</div>
                        <div className="detailsSectionSub">Capture analysis, verification, and prevention</div>
                      </div>
                      <div className="detailsSectionRight">
                        <div className="workflowStage">
                          <span className="mutedSmall">Stage</span>
                          <span className="stageValue">{selectedDefect.rootCause?.stage || "New"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="detailsGrid">
                      <Select label="Stage" value={selectedDefect.rootCause?.stage || "New"} onChange={(v) => patchRootCause(selectedDefect, { stage: v })} options={workflowStageOptions} />
                      <TextArea
                        label="Problem statement"
                        value={selectedDefect.rootCause?.problemStatement || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { problemStatement: v })}
                        placeholder="Describe the problem in measurable terms"
                        rows={3}
                      />
                      <TextArea
                        label="Containment action(s)"
                        value={selectedDefect.rootCause?.containment || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { containment: v })}
                        placeholder="Immediate actions to protect customer / isolate impact"
                        rows={3}
                      />
                      <TextArea label="5 Whys" value={selectedDefect.rootCause?.fiveWhys || ""} onChange={(v) => patchRootCause(selectedDefect, { fiveWhys: v })} placeholder="Use numbered lines; one why per line" rows={6} />
                      <TextArea
                        label="Fishbone (Ishikawa)"
                        value={selectedDefect.rootCause?.fishbone || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { fishbone: v })}
                        placeholder="Capture categories (Man, Machine, Method, Material, Measurement, Environment)"
                        rows={6}
                      />

                      <label className="field">
                        <span className="label">Suspected causes (one per line)</span>
                        <textarea
                          className="textarea"
                          rows={4}
                          value={joinListToLines(selectedDefect.rootCause?.suspectedCauses || [])}
                          onChange={(e) => patchRootCause(selectedDefect, { suspectedCauses: splitLinesToList(e.target.value) })}
                          placeholder="List candidates to verify"
                        />
                      </label>

                      <label className="field">
                        <span className="label">Verified root causes (one per line)</span>
                        <textarea
                          className="textarea"
                          rows={4}
                          value={joinListToLines(selectedDefect.rootCause?.verifiedCauses || [])}
                          onChange={(e) => patchRootCause(selectedDefect, { verifiedCauses: splitLinesToList(e.target.value) })}
                          placeholder="List confirmed causes + supporting evidence"
                        />
                      </label>

                      <TextArea
                        label="Verification notes"
                        value={selectedDefect.rootCause?.verificationNotes || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { verificationNotes: v })}
                        placeholder="How did you confirm the root cause?"
                        rows={3}
                      />

                      <TextArea
                        label="Prevention / systemic fix"
                        value={selectedDefect.rootCause?.preventionNotes || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { preventionNotes: v })}
                        placeholder="How to prevent recurrence?"
                        rows={3}
                      />

                      <TextArea
                        label="Validation checklist"
                        value={selectedDefect.rootCause?.validationChecklist || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { validationChecklist: v })}
                        placeholder="What must be true to declare success?"
                        rows={3}
                      />

                      <div className="inlineTwo">
                        <TextInput label="Validated by" value={selectedDefect.rootCause?.validatedBy || ""} onChange={(v) => patchRootCause(selectedDefect, { validatedBy: v })} placeholder="Name" />
                        <label className="field">
                          <span className="label">Validated at</span>
                          <input className="input" type="date" value={selectedDefect.rootCause?.validatedAt || ""} onChange={(e) => patchRootCause(selectedDefect, { validatedAt: e.target.value })} />
                        </label>
                      </div>

                      <TextArea
                        label="Closure notes"
                        value={selectedDefect.rootCause?.closureNotes || ""}
                        onChange={(v) => patchRootCause(selectedDefect, { closureNotes: v })}
                        placeholder="Optional: capture final notes for audit trail"
                        rows={3}
                      />
                    </div>
                  </section>

                  <div className="divider" />

                  <section className="detailsSection">
                    <div className="detailsSectionHeader">
                      <div>
                        <div className="detailsSectionTitle">Corrective actions</div>
                        <div className="detailsSectionSub">Plan, execute, and track actions for closure</div>
                      </div>
                      <div className="detailsSectionRight">
                        <button className="btn btnSmall btnPrimary" onClick={() => addAction(selectedDefect)}>
                          + Add action
                        </button>
                      </div>
                    </div>

                    <div className="actionsList">
                      {(selectedDefect.actions || []).map((a) => (
                        <div key={a.id} className="actionCard">
                          <div className="actionTop">
                            <input className="input actionTitle" value={a.title} placeholder="Action title" onChange={(e) => patchAction(selectedDefect, a.id, { title: e.target.value })} />
                            <button className="iconButton" onClick={() => deleteAction(selectedDefect, a.id)} aria-label="Delete action">
                              🗑
                            </button>
                          </div>

                          <div className="actionGrid">
                            <TextInput label="Owner" value={a.owner} onChange={(v) => patchAction(selectedDefect, a.id, { owner: v })} placeholder="Name" />
                            <Select label="Status" value={a.status} onChange={(v) => patchAction(selectedDefect, a.id, { status: v })} options={actionStatusOptions} />
                            <label className="field">
                              <span className="label">Due date</span>
                              <input className="input" type="date" value={a.dueDate || ""} onChange={(e) => patchAction(selectedDefect, a.id, { dueDate: e.target.value })} />
                            </label>
                            <TextArea label="Notes" value={a.notes} onChange={(v) => patchAction(selectedDefect, a.id, { notes: v })} placeholder="Context, links, acceptance criteria" rows={3} />
                          </div>
                        </div>
                      ))}
                      {(selectedDefect.actions || []).length === 0 ? <div className="emptyState small">No actions yet. Add corrective actions to drive closure.</div> : null}
                    </div>
                  </section>
                </div>
              )}
            </aside>
          </div>
        ) : null}

        {view === "tools" ? (
          <>
            <section className="sectionHeader">
              <div className="sectionTitle">Data Tools</div>
              <div className="sectionActions">
                <button className="btn btnGhost" onClick={doExportCsv}>
                  Export CSV
                </button>
                <button className="btn btnGhost" onClick={doExportPdf}>
                  Export PDF
                </button>
              </div>
            </section>

            <section className="gridTwo">
              <div className="card">
                <div className="cardHeader">
                  <div>
                    <div className="cardTitle">Local persistence</div>
                    <div className="cardSub">This app is demo-safe: no network calls, localStorage only.</div>
                  </div>
                </div>

                <div className="toolList">
                  <div className="toolRow">
                    <div>
                      <div className="toolTitle">Export</div>
                      <div className="muted">Download your defects as CSV or a printable report.</div>
                    </div>
                    <div className="toolActions">
                      <button className="btn btnPrimary" onClick={doExportCsv}>
                        CSV
                      </button>
                      <button className="btn btnGhost" onClick={doExportPdf}>
                        PDF
                      </button>
                    </div>
                  </div>

                  <div className="toolRow">
                    <div>
                      <div className="toolTitle">Reset demo dataset</div>
                      <div className="muted">Restores starter defects useful for presentations.</div>
                    </div>
                    <div className="toolActions">
                      <button className="btn btnGhost" onClick={resetDemoData}>
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="toolRow">
                    <div>
                      <div className="toolTitle">Clear all data</div>
                      <div className="muted">Removes all defects stored by this app.</div>
                    </div>
                    <div className="toolActions">
                      <button
                        className="btn btnDanger"
                        onClick={() => {
                          const ok = window.confirm("This will remove all defects stored by this app in your browser. Continue?");
                          if (ok) clearAllData();
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cardFooter">
                  <div className="mutedSmall">
                    Storage key: <code className="inlineCode">{STORAGE_KEY}</code>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="cardHeader">
                  <div>
                    <div className="cardTitle">Quality health checks</div>
                    <div className="cardSub">Quick heuristics to prioritize attention</div>
                  </div>
                </div>

                <div className="healthGrid">
                  <div className="healthItem">
                    <div className="healthLabel">Critical rate</div>
                    <div className="healthValue">{stats.total ? Math.round((stats.critical / stats.total) * 100) : 0}%</div>
                    <div className="mutedSmall">Critical as percent of total</div>
                  </div>

                  <div className="healthItem">
                    <div className="healthLabel">Backlog size</div>
                    <div className="healthValue">{stats.open + stats.inProgress}</div>
                    <div className="mutedSmall">Open + In Progress</div>
                  </div>

                  <div className="healthItem">
                    <div className="healthLabel">Major items</div>
                    <div className="healthValue">{stats.major}</div>
                    <div className="mutedSmall">Major severity defects</div>
                  </div>

                  <div className="healthItem">
                    <div className="healthLabel">Workflow maturity</div>
                    <div className="healthValue">{defects.length ? Math.round(defects.reduce((acc, d) => acc + workflowProgress(d), 0) / defects.length) : 0}%</div>
                    <div className="mutedSmall">Average workflow progress</div>
                  </div>
                </div>

                <div className="divider" />

                <div className="muted">
                  Suggested workflow: <strong>Contain</strong> → <strong>Analyze</strong> → <strong>Verify</strong> → <strong>Correct</strong> → <strong>Validate</strong> → <strong>Close</strong>.
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      <footer className="footer">
        <div className="mutedSmall">
          Frontend-only demo app. No backend/API calls. Data stored in <code className="inlineCode">localStorage</code>.
        </div>
      </footer>

      <Modal
        open={isNewOpen}
        title="New defect"
        description="Log a new quality defect. Saved locally in your browser."
        onClose={() => {
          setIsNewOpen(false);
          setDraft(null);
        }}
        footer={
          <div className="modalFooterRow">
            <button
              className="btn btnGhost"
              onClick={() => {
                setIsNewOpen(false);
                setDraft(null);
              }}
            >
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              onClick={() => {
                if (!draft) return;
                if (!draft.title.trim()) {
                  showToast("danger", "Please add a title before saving.");
                  return;
                }
                upsertDefect(normalizeDefect(draft), { reason: "create" });
                setIsNewOpen(false);
                setDraft(null);
              }}
            >
              Save defect
            </button>
          </div>
        }
      >
        {!draft ? null : (
          <div className="detailsGrid">
            <TextInput label="Title" value={draft.title} onChange={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Short summary" />
            <Select label="Severity" value={draft.severity} onChange={(v) => setDraft((d) => ({ ...d, severity: v }))} options={severityOptions.filter((o) => o.value !== "All")} />
            <TextInput label="Category" value={draft.category} onChange={(v) => setDraft((d) => ({ ...d, category: v }))} placeholder="e.g. Process" />
            <TextInput label="Area" value={draft.area} onChange={(v) => setDraft((d) => ({ ...d, area: v }))} placeholder="e.g. Assembly" />
            <label className="field">
              <span className="label">Detected on</span>
              <input className="input" type="date" value={draft.detectedOn || ""} onChange={(e) => setDraft((d) => ({ ...d, detectedOn: e.target.value }))} />
            </label>
            <TextInput label="Detected by" value={draft.detectedBy} onChange={(v) => setDraft((d) => ({ ...d, detectedBy: v }))} placeholder="Person / role" />
            <TextInput label="Assigned to" value={draft.assignedTo} onChange={(v) => setDraft((d) => ({ ...d, assignedTo: v }))} placeholder="Owner" />
            <TextArea label="Description" value={draft.description} onChange={(v) => setDraft((d) => ({ ...d, description: v }))} placeholder="What happened? Where? Impact?" rows={5} />
            <label className="field">
              <span className="label">Tags (comma separated)</span>
              <input className="input" value={(draft.tags || []).join(", ")} onChange={(e) => setDraft((d) => ({ ...d, tags: asStringArray(e.target.value) }))} placeholder="e.g. torque, line2" />
            </label>
          </div>
        )}
      </Modal>

      {toastItems.length ? (
        <div className="toastStack" aria-live="polite" aria-label="Notifications">
          {toastItems.map((t) => (
            <div key={t.id} className={`toast toast_${t.type}`} role="status">
              {t.message}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default App;
