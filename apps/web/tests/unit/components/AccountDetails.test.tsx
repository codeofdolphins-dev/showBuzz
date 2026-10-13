import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetails } from "@/components/public/account/AccountDetails";
import { useAuthStore } from "@/stores/auth";
import type { AccountProfile } from "@showbuzz/schemas/types/account";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() },
  updateProfileAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/app/(public)/_actions/account", () => ({
  updateProfileAction: mocks.updateProfileAction,
  startContactChangeAction: vi.fn(),
  confirmContactChangeAction: vi.fn(),
  removeContactAction: vi.fn(),
  startReauthAction: vi.fn(),
  confirmReauthAction: vi.fn(),
}));

const user = {
  id: "652f1c0e8b3f4a2d9c1e7b55",
  name: "Aarav Roy",
  phone: "+919876543210",
  joinedAt: "2026-10-12T10:00:00.000Z",
};
const profile: AccountProfile = { user, phoneVerified: true, emailVerified: false, sessions: [] };

beforeEach(() => {
  useAuthStore.setState({ status: "authenticated", user, accessExpiresAt: "2026-10-12T10:15:00.000Z" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AccountDetails", () => {
  it("saves the name, updates the header snapshot and refreshes the page", async () => {
    const u = userEvent.setup();
    mocks.updateProfileAction.mockResolvedValueOnce({ success: true, data: { ...user, name: "Aarav K Roy" } });
    render(<AccountDetails profile={profile} />);

    const name = screen.getByLabelText("Full Name");
    await u.clear(name);
    await u.type(name, "Aarav K Roy");
    await u.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(useAuthStore.getState().user?.name).toBe("Aarav K Roy"));
    expect(mocks.updateProfileAction).toHaveBeenCalledWith({ name: "Aarav K Roy" });
    expect(useAuthStore.getState().accessExpiresAt).toBe("2026-10-12T10:15:00.000Z");
    expect(mocks.router.refresh).toHaveBeenCalled();
  });

  it("shows a validation error without calling the server", async () => {
    const u = userEvent.setup();
    render(<AccountDetails profile={profile} />);

    const name = screen.getByLabelText("Full Name");
    await u.clear(name);
    await u.type(name, "A");
    await u.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Name is too short")).toBeInTheDocument();
    expect(mocks.updateProfileAction).not.toHaveBeenCalled();
  });

  it("shows verified identifiers and offers to add the missing one", () => {
    render(<AccountDetails profile={profile} />);

    expect(screen.getByText("+919876543210")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    // The phone is the only identifier, so it can't be removed.
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });
});
