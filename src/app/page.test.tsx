import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the app name as the main heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "EZStreet" }),
    ).toBeInTheDocument();
  });

  it("describes what the app does", () => {
    render(<Home />);
    expect(
      screen.getByText(/draft a petition backed by NYC Open Data/i),
    ).toBeInTheDocument();
  });
});
