export function PageShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-sans text-2xl font-semibold">{title}</h1>
        {action}
      </div>
      {children}
    </div>
  );
}
