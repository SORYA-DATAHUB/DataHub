import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("landing page", () => {
  it("presents the product and contribution action", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Turn authorized documents into trusted datasets."
    );
    expect(screen.getByRole("link", { name: /become a contributor/i })).toHaveAttribute(
      "href",
      "/register"
    );
    expect(screen.getByText("$1.00", { exact: false })).toBeInTheDocument();
  });
});
