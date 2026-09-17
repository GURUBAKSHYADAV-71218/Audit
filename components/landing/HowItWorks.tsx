const STEPS = [
  { n: 1, title: "Enter your URL", desc: "Paste any public website address." },
  { n: 2, title: "AUDIT loads your website", desc: "A real headless browser navigates the page, just like a visitor would." },
  { n: 3, title: "Resources are analyzed", desc: "Every image, script, stylesheet, font, and request is inspected." },
  { n: 4, title: "Bottlenecks are identified", desc: "Deterministic rules flag what's actually slowing things down." },
  { n: 5, title: "Get prioritized fixes", desc: "A ranked list of what to fix first, with evidence and estimated savings." },
];

export function HowItWorks() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How AUDIT works</h2>
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-5">
        {STEPS.map((s) => (
          <div key={s.n} className="relative">
            <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-subtle text-sm font-semibold text-accent">
              {s.n}
            </div>
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-foreground/50">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
