"use client";

import { useState, type ReactNode } from "react";
import { DesktopNavBar } from "./DesktopNavBar";
import { FloatingActionButton } from "./FloatingActionButton";
import { MobileMenuButton } from "./MobileMenuButton";
import { NavMenuModal } from "./NavMenuModal";

export type AppShellProps = Readonly<{
  children: ReactNode;
  branding: string;
  profileHref: string;
  profileLabel: string;
  logoutLabel: string;
  menuLabel: string;
  closeMenuLabel: string;
  onLogout: () => void;
  floatingActionLabel?: string;
  onFloatingAction?: () => void;
  hideFloatingAction?: boolean;
}>;

export function AppShell({
  children,
  branding,
  profileHref,
  profileLabel,
  logoutLabel,
  menuLabel,
  closeMenuLabel,
  onLogout,
  floatingActionLabel,
  onFloatingAction,
  hideFloatingAction = false,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <DesktopNavBar
        branding={branding}
        profileHref={profileHref}
        profileLabel={profileLabel}
        logoutLabel={logoutLabel}
        onLogout={onLogout}
      />
      <MobileMenuButton
        open={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
        openLabel={menuLabel}
        closeLabel={closeMenuLabel}
      />
      <NavMenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={menuLabel}
        profileHref={profileHref}
        profileLabel={profileLabel}
        logoutLabel={logoutLabel}
        onLogout={onLogout}
      />
      <main className="app-shell__content">{children}</main>
      {floatingActionLabel && onFloatingAction && (
        <FloatingActionButton
          label={floatingActionLabel}
          onClick={onFloatingAction}
          hidden={hideFloatingAction}
        />
      )}
    </div>
  );
}
