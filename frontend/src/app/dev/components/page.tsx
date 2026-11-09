import { notFound } from "next/navigation";
import { ComponentShowcase } from "@/components/ui/ComponentShowcase";

export default function ComponentSheetPage() {
  if (process.env.NEXT_PUBLIC_ENV === "production") notFound();

  return <ComponentShowcase />;
}
