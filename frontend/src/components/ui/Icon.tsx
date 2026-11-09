import type { HTMLAttributes } from "react";

type IconProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  name: string;
  label?: string;
};

export function Icon({ name, label, ...props }: IconProps) {
  return (
    <span
      {...props}
      className={`material-symbols-outlined ${props.className ?? ""}`.trim()}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
