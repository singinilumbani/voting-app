import { M3Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export type MobileMenuButtonProps = Readonly<{
  open: boolean;
  onClick: () => void;
  openLabel: string;
  closeLabel: string;
}>;

export function MobileMenuButton({
  open,
  onClick,
  openLabel,
  closeLabel,
}: MobileMenuButtonProps) {
  return (
    <M3Button
      type="button"
      variant="fab"
      className="app-mobile-menu-button"
      aria-label={open ? closeLabel : openLabel}
      aria-expanded={open}
      onClick={onClick}
    >
      <Icon name={open ? "close" : "menu"} />
    </M3Button>
  );
}
