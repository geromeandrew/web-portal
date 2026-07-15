const items = [
  {
    label: "Allowed",
    value: "PDF, Office docs, JPG, PNG, WEBP, ZIP",
  },
  {
    label: "Default size cap",
    value: "25 MB per file",
  },
  {
    label: "Storage",
    value: "Private AWS S3 bucket",
  },
  {
    label: "Trust boundary",
    value: "Presigned in Cloudflare Worker",
  },
];

export default function InfoBand() {
  return (
    <section className="mx-auto max-w-7xl px-5 md:px-8">
      <div className="grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-soft md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
