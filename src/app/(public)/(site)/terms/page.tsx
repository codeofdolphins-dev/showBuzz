import type { Metadata } from "next";
import { LegalPage } from "@/components/public/common/LegalPage";
import { CANCELLATION_CUTOFF_MINUTES } from "@/config/constants";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions of Use"
      updated="August 2026"
      sections={[
        {
          heading: "Acceptance of Terms",
          body: "By accessing or using the ShowBuzz website, applications, or ticket booking services, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.",
        },
        {
          heading: "Ticket Booking & Admission",
          body: "ShowBuzz acts as a digital ticketing facilitator between patrons and cinema exhibitors or event organisers. Entry is subject to the venue's age classification (e.g. 'A' certificate movies require 18+ ID proof) and security policies.",
        },
        {
          heading: "Cancellation & Refund Policy",
          body: `Where cancellation is available, ticket holders may cancel up to ${CANCELLATION_CUTOFF_MINUTES} minutes before showtime from the dashboard. The amount paid, less a ₹50 cancellation fee, is credited back to the source account within 24-48 hours.`,
        },
        {
          heading: "Promotional Coupons & Offers",
          body: "Coupons (e.g. SHOW50, UPIFIRST) are subject to minimum order criteria, expiry dates and usage limits per account. ShowBuzz may withdraw promotional offers without prior notice.",
        },
      ]}
    />
  );
}
