import { notFound } from "next/navigation";
import { ComponentShowcase } from "@/components/ui/ComponentShowcase";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Component showcase" };

export default function ComponentSheetPage() {
  if (process.env.NEXT_PUBLIC_ENV === "production") notFound();

  return <ComponentShowcase />;
}
