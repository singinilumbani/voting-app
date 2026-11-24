import Link from "next/link";
import { M3Button } from "@/components/ui/primitives";

export type DesktopNavBarProps = Readonly<{
  branding: string;
  profileLabel: string;
  logoutLabel: string;
  profileHref: string;
  onLogout: () => void;
  billingHref?: string;
  billingLabel?: string;
}>;

export function DesktopNavBar({
  branding,
  profileLabel,
  logoutLabel,
  profileHref,
  onLogout,
  billingHref,
  billingLabel,
}: DesktopNavBarProps) {
  return (
    <nav className="app-desktop-nav" aria-label={branding}>
      <Link href="/" className="app-brand">
        {branding}
      </Link>
      <div className="app-desktop-nav__actions">
        {billingHref && billingLabel && (
          <Link href={billingHref}>{billingLabel}</Link>
        )}
        <Link href={profileHref}>{profileLabel}</Link>
        <M3Button variant="text" onClick={onLogout}>
          {logoutLabel}
        </M3Button>
      </div>
    </nav>
  );
}
