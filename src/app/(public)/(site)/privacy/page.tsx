import type { Metadata } from "next";
import { LegalPage } from "@/components/public/common/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="August 2026"
      sections={[
        {
          heading: "Information We Collect",
          body: "ShowBuzz Entertainment Pvt. Ltd. collects information that you provide when registering an account, booking tickets, applying discount coupons, or using our apps and website. This includes your name, email address, mobile number, location preference, and payment transaction references.",
        },
        {
          heading: "How We Use Your Data",
          body: "We use your information to generate and deliver your digital M-tickets, process payments through authorised banking gateways, send showtime reminders, and offer personalised recommendations based on your preferences.",
        },
        {
          heading: "Payment Information & Security",
          body: "ShowBuzz does not store raw card numbers or banking PINs. Payments are processed by PCI-DSS compliant gateways in line with Reserve Bank of India tokenisation mandates.",
        },
        {
          heading: "Cookies & Local Storage",
          body: "We use secure cookies to keep you signed in, and your browser's local storage to remember preferences such as your selected city and wishlist.",
        },
      ]}
    />
  );
}
