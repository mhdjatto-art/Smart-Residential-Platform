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
  /**
   * Optional feature_flag key. If set, the item is hidden when the flag is
   * disabled for the active org. Maps to keys seeded in `feature_flags`.
   * Examples: "marketplace", "parking", "iot", "erp_integration", "wallets".
   */
  feature?: string;
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
      { title: "Announcements", href: "/announcements", icon: Megaphone,   requiredCapability: "compound:read", feature: "announcements" },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Tickets",     href: "/tickets",     icon: Tag,        requiredCapability: "ticket:read",    feature: "tickets" },
      { title: "Maintenance", href: "/maintenance", icon: ClipboardList, requiredCapability: "ticket:read", feature: "tickets" },
      { title: "Technicians", href: "/technicians", icon: Wrench,     requiredCapability: "ticket:write",   feature: "tickets" },
      { title: "Visitors",    href: "/visitors",    icon: UserPlus,   requiredCapability: "visitor:read",   feature: "visitors" },
      { title: "Facilities",  href: "/facilities",  icon: Building2,  requiredCapability: "facility:read",  feature: "facilities" },
      { title: "Bookings",    href: "/bookings",    icon: CalendarDays, requiredCapability: "booking:read", feature: "facilities" },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Finance",   href: "/finance",   icon: Wallet,     requiredCapability: "payment:read" },
      { title: "Contracts", href: "/contracts", icon: FileText,   requiredCapability: "contract:read", feature: "contracts" },
      { title: "Payments",  href: "/payments",  icon: DollarSign, requiredCapability: "payment:read" },
      { title: "Reminders", href: "/reminders", icon: Bell,       requiredCapability: "payment:read" },
      { title: "ERP bridge", href: "/erp",     icon: BookOpen,    requiredCapability: "erp:read",        feature: "erp_integration" },
    ],
  },
  {
    title: "Utilities",
    items: [
      { title: "Utilities",       href: "/utilities",         icon: Zap,     requiredCapability: "utility:read", feature: "utilities" },
      { title: "Providers",       href: "/providers",         icon: Zap,     requiredCapability: "utility:read", feature: "utilities" },
      { title: "Subscriptions",   href: "/subscriptions",     icon: Repeat,  requiredCapability: "utility:read", feature: "utilities" },
      { title: "Meters",          href: "/meters",            icon: Gauge,   requiredCapability: "utility:read", feature: "meters" },
      { title: "Internet plans",  href: "/internet-packages", icon: Wifi,    requiredCapability: "utility:read", feature: "utilities" },
      { title: "Utility bills",   href: "/utility-bills",     icon: Receipt,     requiredCapability: "utility:read", feature: "utilities" },
      { title: "Pricing rules",   href: "/pricing-rules",     icon: Calculator,  requiredCapability: "pricing:read", feature: "utilities" },
      { title: "Integrations",    href: "/integrations",      icon: Cable,       requiredCapability: "integrations:read" },
      { title: "Hardware testing", href: "/hardware-test",    icon: Cable,       requiredCapability: "integrations:read" },
    ],
  },
  {
    title: "Smart infrastructure",
    items: [
      { title: "Devices",       href: "/devices",       icon: Cpu,      requiredCapability: "devices:read", feature: "iot" },
      { title: "Access zones",  href: "/access-zones",  icon: DoorOpen, requiredCapability: "access:read",  feature: "iot" },
      { title: "Access logs",   href: "/access-logs",   icon: Radio,    requiredCapability: "access:read",  feature: "iot" },
      { title: "Parking",       href: "/parking",       icon: Car,      requiredCapability: "parking:read", feature: "parking" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { title: "Marketplace",        href: "/marketplace",        icon: ShoppingBag, requiredCapability: "marketplace:read", feature: "marketplace" },
      { title: "Service providers",  href: "/service-providers",  icon: Store,       requiredCapability: "marketplace:read", feature: "marketplace" },
      { title: "Orders",             href: "/orders",             icon: ShoppingBag, requiredCapability: "marketplace:read", feature: "marketplace" },
      { title: "Reviews",            href: "/reviews",            icon: Star,        requiredCapability: "marketplace:read", feature: "marketplace" },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { title: "Control Center", href: "/control-center",   icon: Activity,     requiredCapability: "analytics:read" },
      { title: "Risk scoring",   href: "/analytics/risk",   icon: Sparkles,     requiredCapability: "analytics:read" },
      { title: "Automation",     href: "/automation",       icon: Workflow,     requiredCapability: "automation:read" },
      { title: "Alerts",         href: "/alerts",           icon: AlertOctagon, requiredCapability: "alerts:read" },
      { title: "Audit log",      href: "/audit-log",        icon: History,      requiredCapability: "audit:read",   feature: "audit_log" },
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
      { title: "Permissions",   href: "/master/permissions",    icon: Sparkles, requiredCapability: "saas:admin" },
    ],
  },
];
