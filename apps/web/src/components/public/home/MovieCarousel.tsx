"use client";

import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { MovieCard } from "@/components/public/cards/MovieCard";
import { useMounted } from "@/hooks/use-mounted";
import type { Movie } from "@showbuzz/schemas/movie";

export function MovieCarousel({ movies }: { movies: Movie[] }) {
  // Swiper can't render during prerender; a scroll-snap row stands in until it mounts.
  const mounted = useMounted();
  if (!mounted) {
    return (
      <div className="no-scrollbar flex snap-x gap-4 overflow-x-auto pt-1 pb-2">
        {movies.map((movie, i) => (
          <div key={movie.id} className="w-[70%] shrink-0 snap-start sm:w-[30%] lg:w-[23%] xl:w-[19%]">
            <MovieCard movie={movie} priority={i < 2} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Swiper
      modules={[Navigation]}
      navigation
      slidesPerView={1.4}
      spaceBetween={14}
      breakpoints={{
        480: { slidesPerView: 2.2, spaceBetween: 16 },
        640: { slidesPerView: 3.2, spaceBetween: 16 },
        1024: { slidesPerView: 4.2, spaceBetween: 18 },
        1280: { slidesPerView: 5.2, spaceBetween: 20 },
        1536: { slidesPerView: 6, spaceBetween: 22 },
      }}
      className="pb-2! [&_.swiper-button-next]:hidden [&_.swiper-button-prev]:hidden sm:[&_.swiper-button-next]:flex sm:[&_.swiper-button-prev]:flex"
    >
      {movies.map((movie, i) => (
        <SwiperSlide key={movie.id} className="h-auto! pt-1">
          <MovieCard movie={movie} priority={i < 2} />
        </SwiperSlide>
      ))}
    </Swiper>
  );
}
