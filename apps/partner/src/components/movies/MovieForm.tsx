"use client";

import { MovieForm as SharedMovieForm, type MovieFormInput } from "@showbuzz/console-ui/listings/MovieForm";
import { addMovieAction, createMovieAction, findDuplicatesAction, updateMovieAction } from "@/app/_actions/movies";

interface MovieFormProps {
  movie?: { id: string; values: Omit<MovieFormInput, "rating" | "votesLabel" | "isTrending"> };
  initialTitle?: string;
  /** Active languages and movie genres (master data). */
  options: { languages: string[]; genres: string[] };
}

/** The shared movie form with the partner's actions (the vendor is taken from the session on the server). */
export function MovieForm({ movie, initialTitle, options }: MovieFormProps) {
  return (
    <SharedMovieForm
      {...(movie ? { movie } : {})}
      {...(initialTitle !== undefined ? { initialTitle } : {})}
      options={options}
      actions={{
        save: (values) => (movie ? updateMovieAction(movie.id, values) : createMovieAction(values)),
        findDuplicates: findDuplicatesAction,
        adopt: addMovieAction,
      }}
    />
  );
}
