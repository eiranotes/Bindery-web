type PageIntroProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: PageIntroProps) {
  return (
    <header className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-intro__description">{description}</p>
      {children}
    </header>
  );
}
