import { render, screen } from "@testing-library/react";
import { Tags } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "@/components/public/common/EmptyState";

describe("EmptyState", () => {
  it("renders the title, description and optional action", () => {
    render(
      <EmptyState
        icon={Tags}
        title="No offers here right now"
        description="Check the other categories."
        action={<a href="/offers">See all offers</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No offers here right now" })).toBeInTheDocument();
    expect(screen.getByText("Check the other categories.")).toBeVisible();
    expect(screen.getByRole("link", { name: "See all offers" })).toHaveAttribute("href", "/offers");
  });
});
