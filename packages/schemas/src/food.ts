import { z } from "zod";
import { idSchema, imageUrlSchema, paiseSchema } from "./common";

export const foodCategorySchema = z.enum(["Popcorn", "Snacks", "Combo Meals", "Beverages"]);

export const foodItemSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  category: foodCategorySchema,
  isVeg: z.boolean(),
  pricePaise: paiseSchema,
  size: z.string(),
  image: imageUrlSchema,
  description: z.string(),
});

export type FoodCategory = z.infer<typeof foodCategorySchema>;
export type FoodItem = z.infer<typeof foodItemSchema>;
