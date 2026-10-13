import { type Page, expect, test } from "@playwright/test";

/** A fresh Indian mobile number per test, so resend cooldowns and accounts never collide. */
function uniquePhone() {
  return `9${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;
}

function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

const header = (page: Page) => page.locator("header").first();
const signInButton = (page: Page) => header(page).getByRole("button", { name: "Sign In" });
const userMenuButton = (page: Page) => header(page).locator("button[aria-expanded]");
const modal = (page: Page) => page.getByRole("dialog");

/** Requests a code in the open modal and returns it from the dev-only banner. */
async function requestCode(page: Page, identifier: string) {
  await modal(page).getByLabel("Mobile Number or Email").fill(identifier);
  await modal(page)
    .getByRole("button", { name: /Continue & Get OTP/ })
    .click();
  const banner = modal(page).getByText(/Development only, no SMS provider yet/);
  await expect(banner).toBeVisible();
  const code = (await banner.textContent())?.match(/(\d{6})/)?.[1];
  if (!code) throw new Error("No code in the dev banner");
  return code;
}

async function enterCode(page: Page, code: string) {
  // Typing all six digits submits automatically.
  await modal(page).getByLabel("Digit 1").click();
  await page.keyboard.type(code);
}

async function signInWithPhone(page: Page, phone = uniquePhone()) {
  await signInButton(page).click();
  const code = await requestCode(page, phone);
  await enterCode(page, code);
  await expect(modal(page)).toBeHidden();
  await expect(userMenuButton(page)).toBeVisible();
  return phone;
}

// next dev compiles each route on first visit; warm the pages up so the first test isn't racing the compiler.
test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  for (const path of ["/", "/movies", "/account/bookings", "/account/profile"]) await request.get(path);
});

test("signs in with a phone, stays on the same page, and survives a reload", async ({ page }) => {
  await page.goto("/movies");
  await signInWithPhone(page);

  await expect(page).toHaveURL(/\/movies$/);
  await expect(signInButton(page)).toHaveCount(0);

  await page.reload();
  await expect(userMenuButton(page)).toBeVisible();
  await expect(signInButton(page)).toHaveCount(0);
});

test("registers with email and name, and shows the name", async ({ page }) => {
  await page.goto("/");
  await signInButton(page).click();
  await modal(page).getByRole("button", { name: "Create Account" }).click();
  await modal(page).getByLabel("Your Full Name").fill("Priya Sharma");
  const code = await requestCode(page, uniqueEmail());
  await enterCode(page, code);
  await expect(modal(page)).toBeHidden();

  await userMenuButton(page).click();
  // The header shows the name only from sm up; the open menu shows it on every screen size.
  await expect(page.getByText("Priya Sharma").filter({ visible: true }).first()).toBeVisible();
});

test("rejects a wrong code and blocks resend until the countdown ends", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await signInButton(page).click();
  const code = await requestCode(page, uniquePhone());

  const resend = modal(page).getByRole("button", { name: /Resend code in 0:/ });
  await expect(resend).toBeDisabled();

  await enterCode(page, code === "000000" ? "111111" : "000000");
  await expect(modal(page).getByRole("alert")).toContainText("Incorrect code");
  await expect(modal(page).getByRole("alert")).toContainText("attempts left");

  await page.clock.fastForward("00:31");
  await expect(modal(page).getByRole("button", { name: "Resend code" })).toBeEnabled();
});

test("sends a signed-out visitor from /account/bookings to sign in and back", async ({ page }) => {
  await page.goto("/account/bookings");
  await expect(page).toHaveURL(/\/$/);
  await expect(modal(page)).toBeVisible();

  const code = await requestCode(page, uniquePhone());
  await enterCode(page, code);

  await expect(page).toHaveURL(/\/account\/bookings$/);
  await expect(page.getByRole("heading", { name: /My Bookings|Booking/ }).first()).toBeVisible();
});

test("signs out, clears the header, and protects /account again", async ({ page }) => {
  await page.goto("/");
  await signInWithPhone(page);

  await userMenuButton(page).click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(signInButton(page)).toBeVisible();

  await page.goto("/account/profile");
  await expect(modal(page)).toBeVisible();
  await expect(page).not.toHaveURL(/\/account\/profile/);
});
