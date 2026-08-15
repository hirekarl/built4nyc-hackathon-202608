import { readFileSync } from "node:fs";
import path from "node:path";
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
      screen.getByText(/deterministic street-safety report/i),
    ).toBeInTheDocument();
  });
});

describe("layout metadata", () => {
  it("does not reference the deprecated petition pitch", () => {
    // layout.tsx isn't imported directly here because it loads next/font/google,
    // which isn't transformable outside the Next.js build pipeline in vitest.
    const layoutSource = readFileSync(
      path.join(import.meta.dirname, "layout.tsx"),
      "utf-8",
    );
    expect(layoutSource).not.toMatch(/petition/i);
  });
});
