import type { ReactNode } from "react";

export type VoterShellProps = Readonly<{
  children: ReactNode;
  branding?: string;
}>;

export function VoterShell({ children, branding }: VoterShellProps) {
  return (
    <div className="voter-shell">
      {branding && <header className="voter-shell__header">{branding}</header>}
      <main>{children}</main>
    </div>
  );
}
