import Link from "next/link";
import { M3Card } from "@/components/ui/primitives";
import { Icon } from "@/components/ui/Icon";
import type { ReactNode } from "react";

export type StatusPageProps = Readonly<{
  title: string;
  description: string;
  returnHomeLabel: string;
  icon: string;
  action?: ReactNode;
}>;

export function StatusPage({
  title,
  description,
  returnHomeLabel,
  icon,
  action,
}: StatusPageProps) {
  return (
    <main className="global-status-page">
      <M3Card>
        <Icon name={icon} />
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="ui-button" href="/">
          {returnHomeLabel}
        </Link>
        {action}
      </M3Card>
    </main>
  );
}
