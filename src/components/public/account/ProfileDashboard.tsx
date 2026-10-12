"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreditCard, Heart, IdCard, LogOut } from "lucide-react";
import { EventCard } from "@/components/public/cards/EventCard";
import { MovieCard } from "@/components/public/cards/MovieCard";
import { EmptyState } from "@/components/public/common/EmptyState";
import { Field, inputClass } from "@/components/public/form/Field";
import { cn } from "@/lib/cn";
import { formatMonthYear } from "@/lib/dates";
import { updateProfileSchema, type UpdateProfileInput } from "@/schemas/auth";
import type { EventListing } from "@/schemas/event";
import type { Movie } from "@/schemas/movie";
import { useAuthStore, type CustomerProfile } from "@/stores/auth";
import { toast } from "@/stores/ui";
import { useWishlistStore } from "@/stores/wishlist";

const SECTION_PATHS: Record<EventListing["kind"], string> = {
  event: "/events",
  play: "/plays",
  sport: "/sports",
  activity: "/activities",
};

type Tab = "wishlist" | "edit" | "payments";

interface ProfileDashboardProps {
  movies: Movie[];
  events: EventListing[];
}

export function ProfileDashboard({ movies, events }: ProfileDashboardProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const wishlist = useWishlistStore((s) => s.ids);
  const [tab, setTab] = useState<Tab>("wishlist");

  if (!user) return null;

  const savedMovies = movies.filter((m) => wishlist.includes(m.id));
  const savedEvents = events.filter((e) => wishlist.includes(e.id));

  return (
    <>
      <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:mb-8 sm:flex-row sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-rose-500 to-purple-600 text-2xl font-black text-white shadow-lg shadow-rose-500/20 sm:h-20 sm:w-20 sm:text-3xl">
            {user.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{user.name}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{user.email ?? user.phone}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Member since {formatMonthYear(new Date(user.joinedAt))}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            toast("Signed out.", "info");
          }}
          className="tap-active flex items-center gap-1.5 rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </button>
      </div>

      <div className="no-scrollbar mb-6 flex w-fit max-w-full overflow-x-auto rounded-2xl bg-slate-200/80 p-1 text-xs font-bold" role="tablist">
        {(
          [
            ["wishlist", `Saved Wishlist (${wishlist.length})`, Heart, "text-rose-500"],
            ["edit", "Account Details", IdCard, "text-blue-500"],
            ["payments", "Payment Methods", CreditCard, "text-emerald-500"],
          ] as const
        ).map(([value, label, Icon, color]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "tap-active flex items-center gap-1.5 rounded-xl px-4 py-2 whitespace-nowrap transition-all",
              tab === value ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", color)} /> {label}
          </button>
        ))}
      </div>

      {tab === "wishlist" &&
        (savedMovies.length + savedEvents.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Explore trending blockbusters and tap the heart icon to save for later."
            action={
              <Link href="/movies" className="gradient-btn tap-active inline-block rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md">
                Browse Movies
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
            {savedMovies.map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
            {savedEvents.map((e) => (
              <div key={e.id} className="col-span-2 sm:col-span-1">
                <EventCard event={e} href={`${SECTION_PATHS[e.kind]}/${e.slug}`} />
              </div>
            ))}
          </div>
        ))}

      {tab === "edit" && <ProfileForm user={user} />}

      {tab === "payments" && (
        <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-8">
          <h3 className="border-b border-slate-100 pb-3 text-base font-extrabold text-slate-900">Saved Payment Methods</h3>
          <p className="mt-4 text-xs leading-relaxed text-slate-600">
            ShowBuzz never stores card numbers. Cards and UPI IDs you choose to save are tokenised and kept by our payment
            partner, and will appear here once online payments go live.
          </p>
        </div>
      )}
    </>
  );
}

function ProfileForm({ user }: { user: CustomerProfile }) {
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name, email: user.email ?? "", phone: user.phone ?? "" },
  });
  const errors = form.formState.errors;

  const save = form.handleSubmit((values) => {
    // Stored on this device only until the profile API exists.
    updateProfile({ name: values.name, email: values.email, phone: values.phone });
    toast("Profile details saved.", "success");
  });

  return (
    <form onSubmit={save} noValidate className="max-w-xl space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 text-xs shadow-xs sm:p-8">
      <h3 className="mb-4 border-b border-slate-100 pb-3 text-base font-extrabold text-slate-900">Personal Information</h3>
      <Field id="p-name" label="Full Name" error={errors.name?.message}>
        <input id="p-name" autoComplete="name" {...form.register("name")} className={inputClass} />
      </Field>
      <Field id="p-email" label="Email Address" error={errors.email?.message}>
        <input id="p-email" type="email" autoComplete="email" {...form.register("email")} className={inputClass} />
      </Field>
      <Field id="p-phone" label="Mobile Number" error={errors.phone?.message}>
        <input id="p-phone" type="tel" autoComplete="tel" {...form.register("phone")} className={inputClass} />
      </Field>
      <button type="submit" className="gradient-btn tap-active rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-md">
        Save Changes
      </button>
    </form>
  );
}
