type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8 font-sans">
      <h1 className="text-xl font-medium">{title}</h1>
    </main>
  );
}
