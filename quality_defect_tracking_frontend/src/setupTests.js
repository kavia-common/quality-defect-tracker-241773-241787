// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * Jest/JSDOM polyfills
 * --------------------
 * These are intentionally ONLY loaded in the Jest environment via CRA's `setupTests.js`.
 * They do not ship in the production bundle and therefore do not change runtime behavior.
 *
 * Some unit tests (e.g., CSV/PDF export) rely on browser APIs that are missing or partial in JSDOM.
 */

// Ensure global URL exists (it should in JSDOM, but guard anyway)
if (typeof global.URL === "undefined") {
  // eslint-disable-next-line no-global-assign
  global.URL = class URL {};
}

// Polyfill URL.createObjectURL / URL.revokeObjectURL for Blob download tests.
if (typeof global.URL.createObjectURL !== "function") {
  global.URL.createObjectURL = jest.fn(() => "blob:jest-mock");
}
if (typeof global.URL.revokeObjectURL !== "function") {
  global.URL.revokeObjectURL = jest.fn();
}

// Some environments can have Blob undefined; CRA/JSDOM usually provides it, but guard for safety.
if (typeof global.Blob === "undefined") {
  // Minimal Blob shim sufficient for tests that only assert Blob was constructed.
  // Not a full implementation.
  // eslint-disable-next-line no-global-assign
  global.Blob = function Blob(parts, options) {
    this.parts = parts;
    this.type = options?.type || "";
  };
}

// window.open exists in JSDOM but often returns null; tests typically mock it.
// We keep a harmless default stub to avoid crashes in code paths that don't mock.
if (typeof window.open !== "function") {
  window.open = () => null;
}

// print is not implemented in JSDOM; app's PDF export calls `w.print()` on the opened window.
if (typeof window.print !== "function") {
  window.print = () => {};
}
