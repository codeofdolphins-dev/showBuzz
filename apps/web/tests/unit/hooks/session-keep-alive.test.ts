import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSession, withAuthRetry } from "@/hooks/use-session-keep-alive";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const user = {
  id: "652f1c0e8b3f4a2d9c1e7b55",
  name: "Aarav Roy",
  phone: "+919876543210",
  joinedAt: "2026-10-12T10:00:00.000Z",
};
const accessExpiresAt = "2026-10-12T10:15:00.000Z";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.setState({ status: "authenticated", user, accessExpiresAt: "2026-10-12T10:00:00.000Z" });
  useUiStore.setState({ authModalOpen: false, authNext: null });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("refreshSession", () => {
  it("shares one request between concurrent callers", async () => {
    let release: (response: Response) => void = () => {};
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => (release = resolve)));

    const first = refreshSession();
    const second = refreshSession();
    release(jsonResponse(200, { success: true, data: { user, accessExpiresAt } }));

    expect(await Promise.all([first, second])).toEqual(["authenticated", "authenticated"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/auth/refresh", expect.objectContaining({ method: "POST" }));
    expect(useAuthStore.getState().accessExpiresAt).toBe(accessExpiresAt);
  });

  it("starts a new request once the previous one has finished", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { user, accessExpiresAt } }));

    await refreshSession();
    await refreshSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears the store when the session has ended (401)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: "UNAUTHENTICATED" } }));

    expect(await refreshSession()).toBe("anonymous");
    expect(useAuthStore.getState()).toMatchObject({ status: "anonymous", user: null, accessExpiresAt: null });
  });

  it("keeps the store on a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    expect(await refreshSession()).toBe("error");
    expect(useAuthStore.getState().status).toBe("authenticated");
  });
});

describe("withAuthRetry", () => {
  const unauthenticated = { success: false as const, error: { code: "UNAUTHENTICATED" } };
  const done = { success: true as const };

  it("refreshes once and retries after UNAUTHENTICATED", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { success: true, data: { user, accessExpiresAt } }));
    const action = vi.fn().mockResolvedValueOnce(unauthenticated).mockResolvedValueOnce(done);

    expect(await withAuthRetry(action)).toEqual(done);
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("opens the sign-in modal when the session can't be renewed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));
    const action = vi.fn().mockResolvedValue(unauthenticated);

    expect(await withAuthRetry(action)).toEqual(unauthenticated);
    expect(action).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().authModalOpen).toBe(true);
  });

  it("passes other results straight through", async () => {
    const failed = { success: false as const, error: { code: "SEAT_UNAVAILABLE" } };
    expect(await withAuthRetry(async () => failed)).toBe(failed);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
