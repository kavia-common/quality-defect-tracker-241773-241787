import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders app shell and primary action", () => {
  render(<App />);
  expect(screen.getByText(/Quality Defect Tracker/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /\+ New defect/i })).toBeInTheDocument();
});
