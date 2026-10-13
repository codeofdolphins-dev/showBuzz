import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CheckoutForm } from "@/components/public/booking/CheckoutForm";
import { useAuthStore } from "@/stores/auth";
import { useBookingCart } from "@/stores/booking-cart";
import { useUiStore } from "@/stores/ui";
import type { OrderQuote } from "@showbuzz/schemas/types/booking";

const mocks = vi.hoisted(() => ({ router: { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() } }));

const quote: OrderQuote = {
  kind: "event",
  title: "Sunburn EDM Arena 2026",
  poster: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",
  venueName: "Eco Park Arena",
  scheduleLabel: "Sat, 14 Nov 2026 • 05:00 PM",
  ticketLabel: "General Access",
  seatLabels: ["1 × General Access"],
  ticketCount: 1,
  food: [],
  foodAllowed: false,
  amounts: {
    ticketsPaise: 99_900,
    foodPaise: 0,
    convenienceFeePaise: 8_492,
    gstPaise: 1_529,
    discountPaise: 0,
    totalPaise: 109_921,
  },
};

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
// next/image needs the Next runtime config; a labelled placeholder is enough here.
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@/hooks/use-order-quote", () => ({ useOrderQuote: () => ({ status: "ready", quote }) }));

const customer = {
  id: "652f1c0e8b3f4a2d9c1e7b55",
  name: "Aarav Roy",
  phone: "+919876543210",
  email: "aarav@example.com",
  joinedAt: "2026-10-12T10:00:00.000Z",
};

beforeEach(() => {
  useUiStore.setState({ authModalOpen: false, authNext: null });
  useBookingCart.setState({ tickets: { kind: "event", eventId: "eve-1", tierId: "ga", quantity: 1 }, food: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

async function fillAndProceed() {
  const u = userEvent.setup();
  await u.clear(screen.getByLabelText("Full Name"));
  await u.type(screen.getByLabelText("Full Name"), "Aarav Roy");
  const phone = screen.getByLabelText("Mobile Number");
  if (!phone.hasAttribute("readonly")) {
    await u.clear(phone);
    await u.type(phone, "9876543210");
  }
  const email = screen.getByLabelText("Email Address");
  if (!email.hasAttribute("readonly")) {
    await u.clear(email);
    await u.type(email, "aarav@example.com");
  }
  await u.click(screen.getByRole("button", { name: /Proceed to Payment/ }));
}

describe("CheckoutForm", () => {
  it("asks a signed-out visitor to sign in and comes back to checkout", async () => {
    useAuthStore.setState({ status: "anonymous", user: null, accessExpiresAt: null });
    render(<CheckoutForm />);

    await fillAndProceed();

    await waitFor(() =>
      expect(useUiStore.getState()).toMatchObject({ authModalOpen: true, authNext: "/booking/checkout" }),
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
    // The typed contact is kept in the cart, so nothing is lost while signing in.
    expect(useBookingCart.getState().contact).toMatchObject({ name: "Aarav Roy" });
  });

  it("goes on to payment when signed in, with the account's phone and email fixed", async () => {
    useAuthStore.setState({ status: "authenticated", user: customer, accessExpiresAt: "2026-10-12T10:15:00Z" });
    render(<CheckoutForm />);

    await waitFor(() => expect(screen.getByLabelText("Mobile Number")).toHaveValue("+919876543210"));
    expect(screen.getByLabelText("Mobile Number")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Email Address")).toHaveAttribute("readonly");

    await fillAndProceed();

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/booking/payment"));
    expect(useUiStore.getState().authModalOpen).toBe(false);
  });
});
