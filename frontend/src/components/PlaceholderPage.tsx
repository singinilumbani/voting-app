type PlaceholderPageProps = Readonly<{
  title: string;
  description: string;
}>;

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main>
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  );
}
