import type { Metadata } from "next";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { listVendorCinemaOptions } from "@showbuzz/core/services/partner/food.service";
import { FoodForm } from "@/components/food/FoodForm";

export const metadata: Metadata = { title: "Add menu item" };

export default async function NewFoodItemPage() {
  const { vendor } = await requireVendorPage("/food/new");
  const cinemas = await listVendorCinemaOptions(vendor.id);
  return (
    <>
      <PageHeader
        title="Add a menu item"
        crumb="Food & Beverages"
        subtitle="It appears on the food step for your movie shows as soon as you save it."
      />
      <FoodForm cinemas={cinemas} />
    </>
  );
}
