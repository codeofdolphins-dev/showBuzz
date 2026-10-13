"use server";

import { z } from "zod";
import { runAction } from "@showbuzz/core/http/action-result";
import { searchCatalog } from "@showbuzz/core/services/catalog.service";

const searchQuerySchema = z.string().trim().max(60);

/** Header search over movies, events and cinemas (catalogue data only, so no sign-in needed). */
export async function searchCatalogAction(query: string) {
  return runAction(() => searchCatalog(searchQuerySchema.parse(query)));
}
