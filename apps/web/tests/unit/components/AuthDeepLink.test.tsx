import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthDeepLink } from "@/components/public/layout/AuthDeepLink";
import { type AuthStatus, useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const nav = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() },
  search: "",
  pathname: "/",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));

function renderWith(search: string, status: AuthStatus) {
  nav.search = search;
  useAuthStore.setState({ status });
  render(<AuthDeepLink />);
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.pathname = "/";
  useUiStore.setState({ authModalOpen: false, authNext: null });
  useAuthStore.setState({ status: "unknown", user: null, accessExpiresAt: null });
});

describe("AuthDeepLink", () => {
  it("opens the modal with next and removes auth/next from the URL", () => {
    renderWith("auth=signin&next=%2Faccount%2Fbookings&city=kolkata", "anonymous");

    expect(useUiStore.getState()).toMatchObject({ authModalOpen: true, authNext: "/account/bookings" });
    expect(nav.router.replace).toHaveBeenCalledWith("/?city=kolkata", { scroll: false });
  });

  it("never remembers an unsafe next", () => {
    renderWith("auth=signin&next=%2F%2Fevil.com", "anonymous");

    expect(useUiStore.getState().authNext).toBe("/");
  });

  it("opens the modal without next when none is given", () => {
    renderWith("auth=signin", "anonymous");

    expect(useUiStore.getState()).toMatchObject({ authModalOpen: true, authNext: null });
    expect(nav.router.replace).toHaveBeenCalledWith("/", { scroll: false });
  });

  it("sends a signed-in visitor straight to next", () => {
    renderWith("auth=signin&next=%2Faccount%2Fprofile", "authenticated");

    expect(useUiStore.getState().authModalOpen).toBe(false);
    expect(nav.router.replace).toHaveBeenCalledWith("/account/profile");
  });

  it("waits while the session is still unknown", () => {
    renderWith("auth=signin&next=%2Faccount%2Fprofile", "unknown");

    expect(useUiStore.getState().authModalOpen).toBe(false);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("does nothing without ?auth=signin", () => {
    renderWith("city=kolkata", "anonymous");

    expect(useUiStore.getState().authModalOpen).toBe(false);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });
});
