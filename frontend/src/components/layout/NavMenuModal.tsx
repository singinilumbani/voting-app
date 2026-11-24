import Link from "next/link";
import { M3Button } from "@/components/ui/primitives";
import { M3ModalDialog } from "@/components/ui/dialogs";

export type NavMenuModalProps = Readonly<{
  open: boolean;
  onClose: () => void;
  profileHref: string;
  profileLabel: string;
  logoutLabel: string;
  onLogout: () => void;
  title: string;
  billingHref?: string;
  billingLabel?: string;
}>;

export function NavMenuModal({
  open,
  onClose,
  profileHref,
  profileLabel,
  logoutLabel,
  onLogout,
  title,
  billingHref,
  billingLabel,
}: NavMenuModalProps) {
  return (
    <M3ModalDialog
      open={open}
      onClose={onClose}
      onBackdropClick={onClose}
      title={title}
      className="ui-dialog--nav-menu"
    >
      <nav className="app-mobile-nav" aria-label={title}>
        {billingHref && billingLabel && (
          <Link href={billingHref} onClick={onClose}>
            {billingLabel}
          </Link>
        )}
        <Link href={profileHref} onClick={onClose}>
          {profileLabel}
        </Link>
        <M3Button
          variant="text"
          onClick={() => {
            onClose();
            onLogout();
          }}
        >
          {logoutLabel}
        </M3Button>
      </nav>
    </M3ModalDialog>
  );
}
