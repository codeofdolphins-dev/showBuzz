"use client";

import { MovieForm, type MovieFormInput } from "@showbuzz/console-ui/listings/MovieForm";
import { findMovieDuplicatesAction, updateMovieByStaffAction } from "@/app/_actions/catalog";

/** The shared movie form with every field (including rating, votes and trending) for the super-admin. */
export function AdminMovieForm({
  movieId,
  values,
  options,
}: {
  movieId: string;
  values: MovieFormInput;
  options: { languages: string[]; genres: string[] };
}) {
  return (
    <MovieForm
      movie={{ id: movieId, values }}
      options={options}
      editorial
      savedMessage="Film saved. showbuzz.com updates in a moment."
      actions={{
        save: (input) => updateMovieByStaffAction(movieId, input),
        findDuplicates: findMovieDuplicatesAction,
      }}
    />
  );
}
