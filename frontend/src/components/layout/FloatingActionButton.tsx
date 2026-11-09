import { M3Button } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";

export type FloatingActionButtonProps = Readonly<{
  label: string;
  onClick: () => void;
  hidden?: boolean;
}>;

export function FloatingActionButton({
  label,
  onClick,
  hidden = false,
}: FloatingActionButtonProps) {
  if (hidden) return null;
  return (
    <M3Button
      type="button"
      variant="fab"
      className="app-floating-action"
      aria-label={label}
      onClick={onClick}
    >
      <Icon name="add" />
    </M3Button>
  );
}
