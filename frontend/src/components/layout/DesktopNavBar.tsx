import Link from "next/link";
import { M3Button } from "@/components/ui/primitives";

export type DesktopNavBarProps = Readonly<{
  branding: string;
  profileLabel: string;
  logoutLabel: string;
  profileHref: string;
  onLogout: () => void;
}>;

export function DesktopNavBar({
  branding,
  profileLabel,
  logoutLabel,
  profileHref,
  onLogout,
}: DesktopNavBarProps) {
  return (
    <nav className="app-desktop-nav" aria-label={branding}>
      <Link href="/" className="app-brand">
        {branding}
      </Link>
      <div className="app-desktop-nav__actions">
        <Link href={profileHref}>{profileLabel}</Link>
        <M3Button variant="text" onClick={onLogout}>
          {logoutLabel}
        </M3Button>
      </div>
    </nav>
  );
}
