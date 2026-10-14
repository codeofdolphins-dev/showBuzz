import "server-only";
import { z } from "zod";
import { personNameSchema } from "@showbuzz/schemas/common";
import { newPasswordSchema, staffEmailSchema } from "@showbuzz/schemas/staff";
import { connect } from "@showbuzz/db/connect";
import { Vendor } from "@showbuzz/db/models/Vendor";
import { VendorUser } from "@showbuzz/db/models/VendorUser";
import { AppError } from "../../http/app-error";
import { hashPassword } from "../password";

/**
 * Vendor logins created by ShowBuzz rather than by signup: the create-vendor-user script today, the super-admin's
 * vendor screen later (back-office prompt 6). One login per vendor for now (role "owner").
 */

export const newVendorUserSchema = z.object({
  vendorSlug: z.string().trim().min(1).max(80),
  name: personNameSchema,
  email: staffEmailSchema,
  password: newPasswordSchema,
});

export async function createVendorUser(
  input: unknown,
  now = new Date(),
): Promise<{ id: string; email: string; vendor: string }> {
  const { vendorSlug, name, email, password } = newVendorUserSchema.parse(input);
  await connect();
  const vendor = await Vendor.findOne({ slug: vendorSlug }, { _id: 1, businessName: 1 }).lean();
  if (!vendor) throw new AppError("NOT_FOUND", `No vendor has the slug "${vendorSlug}".`, 404);
  if (await VendorUser.exists({ vendorId: vendor._id })) {
    throw new AppError("CONFLICT", "This vendor already has a login (one per vendor for now).", 409);
  }
  try {
    const user = await VendorUser.create({
      vendorId: vendor._id,
      name,
      email,
      passwordHash: await hashPassword(password),
      passwordChangedAt: now,
      role: "owner",
      status: "active",
    });
    return { id: user.id, email: user.email, vendor: vendor.businessName };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === 11000) {
      throw new AppError("CONFLICT", "A partner login with that email already exists.", 409);
    }
    throw err;
  }
}
