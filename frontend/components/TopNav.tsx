"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  ShoppingBag,
  LogOut,
} from "lucide-react";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/books", label: "Books", icon: BookOpen },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4">

        {/* Logo */}
        <Link href="/dashboard" className="mr-2 flex shrink-0 items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpen className="size-4" />
          </div>
          <span className="hidden font-semibold text-sm sm:inline">{"Jaslin's Pages"}</span>
        </Link>

        {/* Nav links */}
        <nav
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHoveredHref(null)}
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onMouseEnter={() => setHoveredHref(href)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Hover highlight — slides between items */}
                {hoveredHref === href && !isActive && (
                  <motion.span
                    layoutId="nav-hover"
                    className="absolute inset-0 rounded-md bg-accent"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", bounce: 0.15, duration: 0.3 }}
                  />
                )}
                {/* Active page indicator — slides on navigation */}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-muted"
                    style={{ zIndex: -1 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  />
                )}
                <Icon size={15} className="shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <ThemeSwitch iconSize={16} />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut size={15} className="shrink-0" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

      </div>
    </header>
  );
}
