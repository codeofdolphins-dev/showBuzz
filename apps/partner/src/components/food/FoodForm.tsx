"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "@showbuzz/console-ui/PageParts";
import {
  ImageUrlField,
  MoneyInput,
  MultiSelect,
  SelectField,
  TextAreaField,
  TextField,
  Toggle,
} from "@showbuzz/console-ui/fields";
import { Button, FormMessage } from "@showbuzz/console-ui/form";
import { useToast } from "@showbuzz/console-ui/Toaster";
import { foodCategorySchema } from "@showbuzz/schemas/food";
import { type FoodItemInput, type FoodItemValues, foodItemInputSchema } from "@showbuzz/schemas/partner-box-office";
import { createFoodItemAction, updateFoodItemAction } from "@/app/_actions/menu-offers";
import { applyActionError } from "@/lib/action-errors";

const CATEGORY_OPTIONS = foodCategorySchema.options.map((c) => ({ value: c, label: c }));
const DIET_OPTIONS = [
  { value: "veg", label: "Veg" },
  { value: "non-veg", label: "Non-veg" },
];

interface FoodFormProps {
  cinemas: { value: string; label: string }[];
  item?: { id: string; values: FoodItemInput };
}

/** A menu item, with the fields the public food step shows (name, category, veg mark, size, price, image, text). */
export function FoodForm({ cinemas, item }: FoodFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<FoodItemInput, unknown, FoodItemValues>({
    resolver: zodResolver(foodItemInputSchema),
    defaultValues: item?.values ?? {
      name: "",
      category: "Popcorn",
      isVeg: true,
      pricePaise: 0,
      size: "",
      image: "",
      description: "",
      venueIds: [],
      available: true,
    },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setMessage(null);
      const result = item ? await updateFoodItemAction(item.id, values) : await createFoodItemAction(values);
      if (!result.success) {
        setMessage(applyActionError(form, result.error));
        return;
      }
      toast.success(item ? "Menu item saved." : "Menu item added.");
      router.push("/food");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {message ? <FormMessage tone="error">{message}</FormMessage> : null}
      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Item</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TextField
            label="Name"
            required
            placeholder="e.g. Large Caramel Popcorn"
            error={errors.name?.message}
            {...form.register("name")}
          />
          <SelectField
            label="Category"
            required
            options={CATEGORY_OPTIONS}
            error={errors.category?.message}
            {...form.register("category")}
          />
          <Controller
            control={form.control}
            name="isVeg"
            render={({ field }) => (
              <SelectField
                label="Veg / non-veg"
                required
                options={DIET_OPTIONS}
                value={field.value ? "veg" : "non-veg"}
                onChange={(e) => field.onChange(e.target.value === "veg")}
              />
            )}
          />
          <Controller
            control={form.control}
            name="pricePaise"
            render={({ field }) => (
              <MoneyInput
                label="Price"
                required
                value={field.value || undefined}
                onChange={(v) => field.onChange(v ?? 0)}
                error={errors.pricePaise?.message}
              />
            )}
          />
          <TextField
            label="Size / quantity"
            placeholder="e.g. 90 g, 500 ml, Regular"
            error={errors.size?.message}
            {...form.register("size")}
          />
          <TextAreaField
            label="Description"
            containerClassName="md:col-span-2"
            maxLength={200}
            placeholder="Shown under the name on the food step"
            error={errors.description?.message}
            {...form.register("description")}
          />
          <Controller
            control={form.control}
            name="image"
            render={({ field }) => (
              <ImageUrlField
                label="Image URL"
                required
                aspect="aspect-square"
                hint="An https:// link to a square photo."
                value={field.value}
                onChange={field.onChange}
                error={errors.image?.message}
              />
            )}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="border-b border-admin-border pb-2 text-sm font-bold text-admin-dark">Where and when</h2>
        <Controller
          control={form.control}
          name="venueIds"
          render={({ field }) => (
            <MultiSelect
              label="Cinemas"
              hint="Leave empty to offer it at all your cinemas."
              options={cinemas}
              value={field.value ?? []}
              onChange={field.onChange}
              error={errors.venueIds?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="available"
          render={({ field }) => (
            <Toggle
              label="Available"
              hint="Switch off when it runs out; it disappears from the food step at once."
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/food"
          className="rounded-md border border-admin-border bg-white px-4 py-2 text-xs font-bold text-admin-text hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : item ? "Save item" : "Add item"}
        </Button>
      </div>
    </form>
  );
}
