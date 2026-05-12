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
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        requiredCapability: "compound:read",
      },
    ],
  },
  {
    title: "Community",
    items: [
      { title: "Residents", href: "/residents", icon: Users,      requiredCapability: "resident:read" },
      { title: "Units",     href: "/units",     icon: Home,       requiredCapability: "unit:read" },
      { title: "Buildings", href: "/buildings", icon: Building2,  requiredCapability: "building:read" },
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
    title: "Administration",
    items: [
      { title: "Compounds",     href: "/compounds",     icon: Warehouse, requiredCapability: "compound:write" },
      { title: "Organizations", href: "/organizations", icon: Boxes,     requiredCapability: "organization:write" },
      { title: "Settings",      href: "/settings",      icon: Settings,  requiredCapability: "compound:read" },
    ],
  },
];
