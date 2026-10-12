import { z } from "zod";
import { indianPhoneSchema, personNameSchema } from "./common";

const optionalPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^(\+91)?[6-9]\d{9}$/, "Enter a valid mobile number")]));

export const supportTopics = [
  "Ticket Not Received on WhatsApp/Email",
  "Cancellation & Refund Status",
  "Payment Debited but Booking Failed",
  "Cinema Hall / Seating Issue",
  "Feedback or General Enquiry",
] as const;

export const contactLeadSchema = z.object({
  name: personNameSchema,
  email: z.email("Enter a valid email address"),
  phone: optionalPhone,
  bookingCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(SB-\d{6})?$/, "Booking ids look like SB-123456"),
  topic: z.enum(supportTopics),
  message: z.string().trim().min(10, "Please add a few more details").max(2000),
});

export const corporateLeadSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name").max(120),
  contactName: personNameSchema,
  email: z.email("Enter a valid work email"),
  phone: indianPhoneSchema,
  requirements: z.string().trim().max(2000),
});

export const organiserCategories = [
  "Live Music / Concert",
  "Standup Comedy",
  "Theatre & Drama",
  "Sports Match / Marathon",
  "Food & Beer Festival",
  "Workshop & Conference",
] as const;

export const organiserCapacities = [
  "100 - 500 Attendees",
  "500 - 2,000 Attendees",
  "2,000 - 10,000 Attendees",
  "10,000+ Mega Stadium",
] as const;

export const showSubmissionSchema = z.object({
  name: personNameSchema,
  companyName: z.string().trim().min(2, "Enter your company or production name").max(120),
  email: z.email("Enter a valid email address"),
  phone: indianPhoneSchema,
  category: z.enum(organiserCategories),
  city: z.string().trim().min(2, "Enter the host city").max(60),
  capacity: z.enum(organiserCapacities),
  overview: z.string().trim().max(2000),
});

export type ContactLeadInput = z.input<typeof contactLeadSchema>;
export type CorporateLeadInput = z.input<typeof corporateLeadSchema>;
export type ShowSubmissionInput = z.input<typeof showSubmissionSchema>;
