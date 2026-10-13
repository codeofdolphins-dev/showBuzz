import type { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Film,
  IndianRupee,
  type LucideIcon,
  ShoppingBag,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { requireStaffPage } from "@showbuzz/core/auth/admin/current-staff";
import { Card, PageHeader, SampleBadge } from "@/components/console/PageParts";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Prototype dashboard.html layout with fixed sample figures (labelled as such) until bookings, shows and
 * payments are in MongoDB (Phase 7.7). Charts are plain CSS bars: no chart library until one is agreed.
 */

interface Kpi {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: string;
  trend?: boolean;
}

const KPIS: Kpi[] = [
  { label: "Gross Value", value: "₹18,42,600", note: "+18.4% vs last week", icon: IndianRupee, tone: "bg-indigo-50 text-admin-indigo", trend: true },
  { label: "Tickets Sold", value: "6,284", note: "+12.6% growth", icon: Ticket, tone: "bg-rose-50 text-admin-coral", trend: true },
  { label: "Orders", value: "2,915", note: "98.2% payment success", icon: ShoppingBag, tone: "bg-teal-50 text-teal-600" },
  { label: "Active Shows", value: "148", note: "Across 20 cinemas", icon: Clock, tone: "bg-amber-50 text-amber-600" },
  { label: "Concerts & Gigs", value: "24", note: "8 stadium venues", icon: Calendar, tone: "bg-purple-50 text-purple-600" },
  { label: "Now Showing", value: "18", note: "5 languages", icon: Film, tone: "bg-slate-100 text-slate-700" },
];

// Same sample series as the prototype (admin/assets/js/dashboard.js).
const MONTHLY_REVENUE = [
  { label: "Sep", value: 42.5 },
  { label: "Oct", value: 58.2 },
  { label: "Nov", value: 74.8 },
  { label: "Dec", value: 92.4 },
  { label: "Jan", value: 88.0 },
  { label: "Feb", value: 114.6 },
];
const CATEGORIES = [
  { label: "Movies", value: 58, color: "bg-admin-indigo" },
  { label: "Concerts", value: 22, color: "bg-admin-coral" },
  { label: "Comedy", value: 10, color: "bg-admin-teal" },
  { label: "Plays & Drama", value: 6, color: "bg-amber-500" },
  { label: "Sports & Fun", value: 4, color: "bg-purple-500" },
];
const CITIES = [
  { label: "Kolkata (HQ)", value: 4200 },
  { label: "Mumbai", value: 3100 },
  { label: "Bengaluru", value: 2450 },
  { label: "Delhi-NCR", value: 2100 },
  { label: "Chennai", value: 1400 },
  { label: "Pune", value: 950 },
];
const RECENT = [
  { id: "SB-883921", customer: "Ananya Sen", content: "Chrono Nexus: Origins · INOX Quest Mall", time: "Today, 06:15 PM", total: "₹1,240", status: "Confirmed" },
  { id: "SB-883917", customer: "Rohit Verma", content: "Sunburn EDM Arena · Salt Lake Stadium", time: "Sat, 05:00 PM", total: "₹4,500", status: "Confirmed" },
  { id: "SB-883904", customer: "Priya Nair", content: "Macbeth · Academy of Fine Arts", time: "Sun, 07:30 PM", total: "₹900", status: "Pending" },
  { id: "SB-883899", customer: "Arjun Das", content: "Shadows of Varanasi · PVR Mani Square", time: "Today, 09:45 PM", total: "₹620", status: "Refunded" },
];

const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-emerald-50 text-admin-success",
  Pending: "bg-amber-50 text-amber-700",
  Refunded: "bg-slate-100 text-admin-muted",
};

export default async function DashboardPage() {
  const { staff } = await requireStaffPage("/dashboard");
  const maxRevenue = Math.max(...MONTHLY_REVENUE.map((m) => m.value));
  const maxCity = Math.max(...CITIES.map((c) => c.value));

  return (
    <>
      <PageHeader
        title="Box Office & Operations Dashboard"
        subtitle={`Welcome back, ${staff.name.split(" ")[0]}. Ticketing metrics, active shows and revenue across hubs.`}
        actions={<SampleBadge />}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {KPIS.map(({ label, value, note, icon: Icon, tone, trend }) => (
          <Card key={label} className="space-y-2 p-4">
            <div className="flex items-center justify-between text-admin-subtle">
              <span className="text-[11px] font-bold tracking-wider uppercase">{label}</span>
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="text-xl font-black tracking-tight text-admin-dark">{value}</p>
            <p className={`flex items-center gap-1 text-[10px] ${trend ? "font-bold text-emerald-600" : "text-admin-subtle"}`}>
              {trend ? <TrendingUp className="h-3 w-3" aria-hidden /> : null}
              {note}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 overflow-hidden p-4 sm:p-5 lg:col-span-2">
          <SectionTitle title="Ticket Sales & Revenue Growth Trend" subtitle="Gross monthly box office collections (INR lakhs)" />
          <div className="flex h-64 items-end gap-3 border-b border-admin-border pb-2" role="img" aria-label="Monthly revenue, sample data">
            {MONTHLY_REVENUE.map((m) => (
              <div key={m.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-bold text-admin-muted">{m.value}</span>
                <div className="w-full rounded-t-md bg-admin-indigo/85" style={{ height: `${(m.value / maxRevenue) * 85}%` }} />
                <span className="text-[10px] text-admin-subtle">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-4 overflow-hidden p-4 sm:p-5">
          <SectionTitle title="Sales by Entertainment Category" subtitle="Share of ticket volume" />
          <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Category share, sample data">
            {CATEGORIES.map((c) => (
              <div key={c.label} className={c.color} style={{ width: `${c.value}%` }} />
            ))}
          </div>
          <ul className="space-y-2.5">
            {CATEGORIES.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs">
                <span className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                <span className="flex-1 text-admin-text">{c.label}</span>
                <span className="font-bold text-admin-dark">{c.value}%</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 overflow-hidden p-4 sm:p-5">
          <SectionTitle title="Bookings by Metropolitan Hub" subtitle="Volume per city region" />
          <ul className="space-y-3">
            {CITIES.map((c) => (
              <li key={c.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-admin-text">{c.label}</span>
                  <span className="font-bold text-admin-dark">{c.value.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-admin-teal" style={{ width: `${(c.value / maxCity) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-admin-border bg-slate-50/50 p-4">
            <SectionTitle title="Recent Box Office Bookings" subtitle="Customer transactions across cinemas and venues" />
            <Link href="/bookings" className="flex items-center gap-1 text-xs font-bold text-admin-indigo hover:underline">
              View All <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] tracking-wider text-admin-muted uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Booking ID</th>
                  <th className="px-4 py-2.5 font-bold">Customer</th>
                  <th className="px-4 py-2.5 font-bold">Content / Venue</th>
                  <th className="px-4 py-2.5 font-bold">Showtime</th>
                  <th className="px-4 py-2.5 font-bold">Total Paid</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {RECENT.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-mono font-bold text-admin-indigo">{row.id}</td>
                    <td className="px-4 py-3 font-semibold text-admin-dark">{row.customer}</td>
                    <td className="px-4 py-3 text-admin-muted">{row.content}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-admin-muted">{row.time}</td>
                    <td className="px-4 py-3 font-bold text-admin-dark">{row.total}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLES[row.status] ?? ""}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 className="text-sm font-bold text-admin-dark">{title}</h2>
        <p className="text-[11px] text-admin-subtle">{subtitle}</p>
      </div>
      <SampleBadge />
    </div>
  );
}
