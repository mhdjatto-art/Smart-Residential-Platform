import {
  Building2,
  Home,
  LayoutDashboard,
  Settings,
  Users,
  Warehouse,
  Boxes,
  FileText,
  DollarSign,
  Wallet,
  Bell,
  ClipboardList,
  Tag,
  Wrench,
  UserPlus,
  CalendarDays,
  Megaphone,
  Activity,
  Zap,
  Repeat,
  Gauge,
  Wifi,
  Receipt,
  ShoppingBag,
  Store,
  Star,
  Sparkles,
  AlertOctagon,
  Workflow,
  History,
  Palette,
  Globe,
  CreditCard,
  Crown,
  Calculator,
  Cable,
  Cpu,
  DoorOpen,
  Car,
  Radio,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/auth/permissions";

export interface NavItem {
  title: string;
  /** Optional i18n key under `nav.*` — falls back to `title` if not translated. */
  i18nKey?: string;
  href: string;
  icon: LucideIcon;
  requiredCapability: Capability;
}

export interface NavSection {
  title: string;
  /** Optional i18n key for the section heading. */
  i18nKey?: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard, requiredCapability: "compound:read" },
      { title: "Operations", href: "/operations", icon: Activity,        requiredCapability: "ticket:read" },
    ],
  },
  {
    title: "Community",
    items: [
      { title: "Residents",     href: "/residents",     icon: Users,       requiredCapability: "resident:read" },
      { title: "Units",         href: "/units",         icon: Home,        requiredCapability: "unit:read" },
      { title: "Buildings",     href: "/buildings",     icon: Building2,   requiredCapability: "building:read" },
      { title: "Announcements", href: "/announcements", icon: Megaphone,   requiredCapability: "compound:read" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Tickets",     href: "/tickets",     icon: Tag,        requiredCapability: "ticket:read" },
      { title: "Maintenance", href: "/maintenance", icon: ClipboardList, requiredCapability: "ticket:read" },
      { title: "Technicians", href: "/technicians", icon: Wrench,     requiredCapability: "ticket:write" },
      { title: "Visitors",    href: "/visitors",    icon: UserPlus,   requiredCapability: "visitor:read" },
      { title: "Facilities",  href: "/facilities",  icon: Building2,  requiredCapability: "facility:read" },
      { title: "Bookings",    href: "/bookings",    icon: CalendarDays, requiredCapability: "booking:read" },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Finance",   href: "/finance",   icon: Wallet,     requiredCapability: "payment:read" },
      { title: "Contracts", href: "/contracts", icon: FileText,   requiredCapability: "contract:read" },
      { title: "Payments",  href: "/payments",  icon: DollarSign, requiredCapability: "payment:read" },
      { title: "Reminders", href: "/reminders", icon: Bell,       requiredCapability: "payment:read" },
      { title: "ERP bridge", href: "/erp",     icon: BookOpen,    requiredCapability: "erp:read" },
    ],
  },
  {
    title: "Utilities",
    items: [
      { title: "Utilities",       href: "/utilities",         icon: Zap,     requiredCapability: "utility:read" },
      { title: "Providers",       href: "/providers",         icon: Zap,     requiredCapability: "utility:read" },
      { title: "Subscriptions",   href: "/subscriptions",     icon: Repeat,  requiredCapability: "utility:read" },
      { title: "Meters",          href: "/meters",            icon: Gauge,   requiredCapability: "utility:read" },
      { title: "Internet plans",  href: "/internet-packages", icon: Wifi,    requiredCapability: "utility:read" },
      { title: "Utility bills",   href: "/utility-bills",     icon: Receipt,     requiredCapability: "utility:read" },
      { title: "Pricing rules",   href: "/pricing-rules",     icon: Calculator,  requiredCapability: "pricing:read" },
      { title: "Integrations",    href: "/integrations",      icon: Cable,       requiredCapability: "integrations:read" },
    ],
  },
  {
    title: "Smart infrastructure",
    items: [
      { title: "Devices",       href: "/devices",       icon: Cpu,      requiredCapability: "devices:read" },
      { title: "Access zones",  href: "/access-zones",  icon: DoorOpen, requiredCapability: "access:read" },
      { title: "Access logs",   href: "/access-logs",   icon: Radio,    requiredCapability: "access:read" },
      { title: "Parking",       href: "/parking",       icon: Car,      requiredCapability: "parking:read" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { title: "Marketplace",        href: "/marketplace",        icon: ShoppingBag, requiredCapability: "marketplace:read" },
      { title: "Service providers",  href: "/service-providers",  icon: Store,       requiredCapability: "marketplace:read" },
      { title: "Orders",             href: "/orders",             icon: ShoppingBag, requiredCapability: "marketplace:read" },
      { title: "Reviews",            href: "/reviews",            icon: Star,        requiredCapability: "marketplace:read" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { title: "Control Center", href: "/control-center",   icon: Activity,     requiredCapability: "analytics:read" },
      { title: "Risk scoring",   href: "/analytics/risk",   icon: Sparkles,     requiredCapability: "analytics:read" },
      { title: "Automation",     href: "/automation",       icon: Workflow,     requiredCapability: "automation:read" },
      { title: "Alerts",         href: "/alerts",           icon: AlertOctagon, requiredCapability: "alerts:read" },
      { title: "Audit log",      href: "/audit-log",        icon: History,      requiredCapability: "audit:read" },
    ],
  },
  {
    title: "Administration",
    items: [
      { title: "Compounds",     href: "/compounds",     icon: Warehouse, requiredCapability: "compound:write" },
      { title: "Organizations", href: "/organizations", icon: Boxes,     requiredCapability: "organization:write" },
      { title: "Branding",      href: "/settings/branding", icon: Palette,    requiredCapability: "branding:write" },
      { title: "Domains",       href: "/settings/domains",  icon: Globe,      requiredCapability: "domains:write" },
      { title: "Billing",       href: "/settings/billing",  icon: CreditCard, requiredCapability: "billing:read" },
      { title: "Settings",      href: "/settings",      icon: Settings,  requiredCapability: "compound:read" },
    ],
  },
  {
    title: "Platform",
    items: [
      { title: "SaaS console",  href: "/saas-console",          icon: Crown,    requiredCapability: "saas:admin" },
      { title: "Plans",         href: "/saas-console/plans",    icon: Crown,    requiredCapability: "saas:admin" },
      { title: "Features",      href: "/saas-console/features", icon: Sparkles, requiredCapability: "saas:admin" },
    ],
  },
];
