import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app shell and primary action", async () => {
  // API-first boot performs an initial fetch; make it deterministic for unit tests.
  jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network unavailable in test"));

  render(<App />);
  expect(screen.getByText(/Quality Defect Tracker/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /\+ New defect/i })).toBeInTheDocument();
});
