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
  type LucideIcon,
} from "lucide-react";
import type { Capability } from "@/lib/auth/permissions";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  requiredCapability: Capability;
}

export interface NavSection {
  title: string;
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
      { title: "Utility bills",   href: "/utility-bills",     icon: Receipt, requiredCapability: "utility:read" },
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
      { title: "Settings",      href: "/settings",      icon: Settings,  requiredCapability: "compound:read" },
    ],
  },
];
