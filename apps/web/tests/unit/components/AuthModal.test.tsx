import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "@/components/public/layout/AuthModal";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() },
  requestOtpAction: vi.fn(),
  verifyOtpAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/app/(public)/_actions/auth", () => ({
  requestOtpAction: mocks.requestOtpAction,
  verifyOtpAction: mocks.verifyOtpAction,
}));

const challengeId = "652f1c0e8b3f4a2d9c1e7b55";
const sent = {
  success: true,
  data: { challengeId, destination: "98******10", expiresInSec: 300, resendAfterSec: 30, devCode: "482913" },
};
const user = { id: challengeId, name: "Aarav Roy", phone: "+919876543210", joinedAt: "2026-10-12T10:00:00.000Z" };

function openModal(next: string | null = null) {
  useUiStore.setState({ authModalOpen: true, authNext: next });
  render(<AuthModal />);
}

async function sendCode() {
  const u = userEvent.setup();
  mocks.requestOtpAction.mockResolvedValueOnce(sent);
  await u.type(screen.getByLabelText("Mobile Number or Email"), "98765 43210");
  await u.click(screen.getByRole("button", { name: /Continue & Get OTP/ }));
  await screen.findByText("98******10");
  return u;
}

beforeEach(() => {
  useAuthStore.setState({ status: "anonymous", user: null, accessExpiresAt: null });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("AuthModal", () => {
  it("shows the masked destination, the expiry and a disabled resend countdown after sending a code", async () => {
    openModal();
    await sendCode();

    expect(mocks.requestOtpAction).toHaveBeenCalledWith({ identifier: "98765 43210", name: undefined });
    expect(screen.getByText("Code expires in 5:00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend code in 0:30" })).toBeDisabled();
    expect(screen.getByText("482913")).toBeInTheDocument();
  });

  it("enables resend when the countdown ends and sends a new code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    openModal();
    const u = await sendCode();

    act(() => vi.setSystemTime(Date.now() + 30_000));
    const resend = await screen.findByRole("button", { name: "Resend code" }, { timeout: 2500 });
    expect(resend).toBeEnabled();

    mocks.requestOtpAction.mockResolvedValueOnce(sent);
    await u.click(resend);
    expect(mocks.requestOtpAction).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("We sent you a new code.")).toBeInTheDocument();
  });

  it("submits automatically once all 6 digits are typed", async () => {
    openModal();
    const u = await sendCode();
    mocks.verifyOtpAction.mockResolvedValueOnce({
      success: true,
      data: { user, accessExpiresAt: "2026-10-12T10:15:00Z" },
    });

    await u.type(screen.getByLabelText("Digit 1"), "482913");

    expect(mocks.verifyOtpAction).toHaveBeenCalledTimes(1);
    expect(mocks.verifyOtpAction).toHaveBeenCalledWith({ challengeId, code: "482913" });
  });

  it("submits a pasted code", async () => {
    openModal();
    const u = await sendCode();
    mocks.verifyOtpAction.mockResolvedValueOnce({
      success: true,
      data: { user, accessExpiresAt: "2026-10-12T10:15:00Z" },
    });

    await u.click(screen.getByLabelText("Digit 1"));
    await u.paste("482913");

    expect(mocks.verifyOtpAction).toHaveBeenCalledWith({ challengeId, code: "482913" });
  });

  it("announces a wrong code with the attempts left", async () => {
    openModal();
    const u = await sendCode();
    mocks.verifyOtpAction.mockResolvedValueOnce({
      success: false,
      error: { code: "OTP_INVALID", message: "Incorrect code. Please try again.", details: { remainingAttempts: 3 } },
    });

    await u.type(screen.getByLabelText("Digit 1"), "111111");

    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveTextContent("Incorrect code. Please try again. 3 attempts left."));
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByLabelText("Digit 1")).toHaveValue("");
  });

  it("shows a rate-limit message from the server when requesting a code", async () => {
    openModal();
    const u = userEvent.setup();
    mocks.requestOtpAction.mockResolvedValueOnce({
      success: false,
      error: { code: "RATE_LIMITED", message: "Please wait before requesting a new code. Try again in 25 seconds." },
    });

    await u.type(screen.getByLabelText("Mobile Number or Email"), "9876543210");
    await u.click(screen.getByRole("button", { name: /Continue & Get OTP/ }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again in 25 seconds."));
  });

  it("signs in, closes and refreshes the page data", async () => {
    openModal();
    const u = await sendCode();
    mocks.verifyOtpAction.mockResolvedValueOnce({
      success: true,
      data: { user, accessExpiresAt: "2026-10-12T10:15:00Z" },
    });

    await u.type(screen.getByLabelText("Digit 1"), "482913");

    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    expect(useAuthStore.getState()).toMatchObject({ user, accessExpiresAt: "2026-10-12T10:15:00Z" });
    expect(useUiStore.getState().authModalOpen).toBe(false);
    expect(mocks.router.refresh).toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("returns to the protected page it was opened for", async () => {
    openModal("/account/bookings");
    const u = await sendCode();
    mocks.verifyOtpAction.mockResolvedValueOnce({
      success: true,
      data: { user, accessExpiresAt: "2026-10-12T10:15:00Z" },
    });

    await u.type(screen.getByLabelText("Digit 1"), "482913");

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/account/bookings"));
  });
});
