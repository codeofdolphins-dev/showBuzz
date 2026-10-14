import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@showbuzz/console-ui/PageParts";
import { requireVendorPage } from "@showbuzz/core/auth/partner/current-vendor";
import { getVendorFoodItem, listVendorCinemaOptions } from "@showbuzz/core/services/partner/food.service";
import { FoodForm } from "@/components/food/FoodForm";

export const metadata: Metadata = { title: "Edit menu item" };

export default async function EditFoodItemPage({ params }: PageProps<"/food/[itemId]/edit">) {
  const { itemId } = await params;
  const { vendor } = await requireVendorPage(`/food/${itemId}/edit`);
  const [item, cinemas] = await Promise.all([getVendorFoodItem(vendor.id, itemId), listVendorCinemaOptions(vendor.id)]);
  if (!item) notFound();
  return (
    <>
      <PageHeader title={item.name} crumb="Food & Beverages" subtitle="Orders already placed keep their price." />
      <FoodForm
        cinemas={cinemas}
        item={{
          id: item.id,
          values: {
            name: item.name,
            category: item.category,
            isVeg: item.isVeg,
            pricePaise: item.pricePaise,
            size: item.size,
            image: item.image,
            description: item.description,
            venueIds: item.venueIds,
            available: item.available,
          },
        }}
      />
    </>
  );
}
