import { fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";

const STORAGE_KEY = "qdt.v1.state";
const THEME_KEY = "qdt.v1.theme";

/**
 * Helper to build a minimal Defect record (App normalizes on load).
 * createdAt/updatedAt are numeric timestamps.
 */
function makeDefect({ id, title, severity, createdAt }) {
  return {
    id,
    title,
    description: "",
    status: "Open",
    severity,
    category: "Process",
    area: "Assembly",
    detectedOn: "2025-01-01",
    detectedBy: "",
    assignedTo: "",
    tags: [],
    evidenceLinks: [],
    dueDate: "",
    resolutionSummary: "",
    rootCause: {
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
    },
    actions: [],
    createdAt,
    updatedAt: createdAt,
  };
}

function seedLocalStorageWithDefects(defects) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      defects,
      lastIdSeed: defects.length,
    })
  );
}

function openDefectsView() {
  fireEvent.click(screen.getByRole("button", { name: "Defects" }));
}

function getDefectRowTitlesInOrder() {
  // Each defect card uses an aria-label: `Open defect ${title || "(Untitled defect)"}`
  const defectButtons = screen.getAllByRole("button", { name: /^Open defect /i });
  return defectButtons.map((btn) => btn.getAttribute("aria-label").replace(/^Open defect /i, ""));
}

describe("App UI behaviors: sorting, export triggers, theme persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  test("default defects sorting is created_at latest-first (createdAt desc)", () => {
    // Arrange: oldest/major, newest/minor, middle/critical
    const defects = [
      makeDefect({
        id: "d_old_major",
        title: "Old Major",
        severity: "Major",
        createdAt: 1700000000000,
      }),
      makeDefect({
        id: "d_new_minor",
        title: "New Minor",
        severity: "Minor",
        createdAt: 1700000002000,
      }),
      makeDefect({
        id: "d_mid_critical",
        title: "Mid Critical",
        severity: "Critical",
        createdAt: 1700000001000,
      }),
    ];
    seedLocalStorageWithDefects(defects);

    render(<App />);
    openDefectsView();

    // Default is Sort=Created date, Dir=Desc => newest first
    const titles = getDefectRowTitlesInOrder();
    expect(titles).toEqual(["New Minor", "Mid Critical", "Old Major"]);
  });

  test("severity sorting uses Critical > Major > Minor when sorting by Severity desc", () => {
    // Arrange: set createdAt such that createdAt ordering differs from severity ordering.
    const defects = [
      makeDefect({
        id: "d_minor_newest",
        title: "Minor Newest",
        severity: "Minor",
        createdAt: 1700000002000,
      }),
      makeDefect({
        id: "d_critical_oldest",
        title: "Critical Oldest",
        severity: "Critical",
        createdAt: 1700000000000,
      }),
      makeDefect({
        id: "d_major_middle",
        title: "Major Middle",
        severity: "Major",
        createdAt: 1700000001000,
      }),
    ];
    seedLocalStorageWithDefects(defects);

    render(<App />);
    openDefectsView();

    // Change Sort -> Severity, keep Dir -> Desc
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "severity" } });
    fireEvent.change(screen.getByLabelText("Dir"), { target: { value: "desc" } });

    const titles = getDefectRowTitlesInOrder();
    expect(titles).toEqual(["Critical Oldest", "Major Middle", "Minor Newest"]);
  });

  test("Export CSV triggers Blob creation and anchor click", () => {
    // Arrange
    seedLocalStorageWithDefects([
      makeDefect({ id: "d1", title: "Defect 1", severity: "Major", createdAt: 1700000000000 }),
    ]);

    const realCreateElement = document.createElement.bind(document);

    const clickSpy = jest.fn();
    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return {
          set href(_) {},
          set download(_) {},
          click: clickSpy,
          remove: jest.fn(),
        };
      }
      // IMPORTANT: call the original implementation to avoid recursion.
      return realCreateElement(tagName);
    });

    // Blob exists in JSDOM; we only verify it was constructed.
    const blobSpy = jest.spyOn(global, "Blob");

    // These are polyfilled in src/setupTests.js as jest.fn() for JSDOM.
    URL.createObjectURL.mockReturnValue("blob:mock");

    render(<App />);

    // Trigger from Dashboard (also exists on other views; dashboard is simplest)
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    // Assert: csv export should create a Blob and click an anchor
    expect(blobSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    // Assert toast shown
    expect(screen.getByText("Exported CSV.")).toBeInTheDocument();
  });

  test("Export PDF triggers window.open + print (after timer)", () => {
    jest.useFakeTimers();

    // Arrange
    seedLocalStorageWithDefects([
      makeDefect({ id: "d1", title: "Defect 1", severity: "Major", createdAt: 1700000000000 }),
    ]);

    const printSpy = jest.fn();
    const focusSpy = jest.fn();
    const writeSpy = jest.fn();
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {
      return {
        document: {
          open: jest.fn(),
          write: writeSpy,
          close: jest.fn(),
        },
        focus: focusSpy,
        print: printSpy,
      };
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));

    // Immediately opens a new window
    expect(openSpy).toHaveBeenCalledTimes(1);

    // Not printed yet until timer elapses
    expect(printSpy).toHaveBeenCalledTimes(0);

    // Let the exportPrintablePdf setTimeout fire (250ms)
    jest.advanceTimersByTime(260);

    expect(focusSpy).toHaveBeenCalled();
    expect(printSpy).toHaveBeenCalledTimes(1);

    // Success toast for OK case
    expect(screen.getByText(/Opened printable report \(Save as PDF\)\./)).toBeInTheDocument();

    jest.useRealTimers();
  });

  test("dark mode toggle persists in localStorage and is applied on reload", () => {
    // Arrange: start with light (default)
    render(<App />);

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("light");

    // Act: toggle theme
    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    // Assert: now dark and persisted
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");

    // "Reload" by mounting a fresh app; theme should be loaded from localStorage
    const { unmount } = render(<App />);
    unmount();
    render(<App />);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  test("Data Tools view export buttons trigger corresponding exports", () => {
    // Arrange
    seedLocalStorageWithDefects([
      makeDefect({ id: "d1", title: "Defect 1", severity: "Major", createdAt: 1700000000000 }),
    ]);

    const realCreateElement = document.createElement.bind(document);

    const clickSpy = jest.fn();
    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      if (tagName === "a") {
        return {
          set href(_) {},
          set download(_) {},
          click: clickSpy,
          remove: jest.fn(),
        };
      }
      // IMPORTANT: call the original implementation to avoid recursion.
      return realCreateElement(tagName);
    });

    URL.createObjectURL.mockReturnValue("blob:mock");
    const blobSpy = jest.spyOn(global, "Blob");

    jest.useFakeTimers();
    const printSpy = jest.fn();
    jest.spyOn(window, "open").mockImplementation(() => {
      return {
        document: {
          open: jest.fn(),
          write: jest.fn(),
          close: jest.fn(),
        },
        focus: jest.fn(),
        print: printSpy,
      };
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Data Tools" }));

    // There are multiple "CSV"/"PDF" buttons on this view (top section + tool row).
    // Use the "Export" tool row to avoid ambiguity and ensure the correct controls exist.
    const exportRow = screen.getByText("Export").closest(".toolRow");
    expect(exportRow).toBeTruthy();

    const exportRowQueries = within(exportRow);

    fireEvent.click(exportRowQueries.getByRole("button", { name: "CSV" }));
    expect(blobSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

    fireEvent.click(exportRowQueries.getByRole("button", { name: "PDF" }));
    jest.advanceTimersByTime(260);
    expect(printSpy).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});
