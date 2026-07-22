export function HomeGallerySection({
  clinicName,
  urls,
}: {
  clinicName: string;
  urls: string[];
}) {
  if (!urls.length) return null;

  return (
    <section className="bg-surface py-20 sm:py-24" aria-labelledby="clinic-gallery-heading">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 space-y-3 sm:mb-12">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Inside the clinic</p>
          <h2 id="clinic-gallery-heading" className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">
            Gallery
          </h2>
          <p className="max-w-2xl text-on-surface-variant">
            A look at {clinicName} — our spaces, team, and the care your pets receive every day.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {urls.map((url, index) => (
            <figure
              key={`${url}-${index}`}
              className={`overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-sm ${
                index % 5 === 0 ? "row-span-2 aspect-[3/4] sm:aspect-auto sm:min-h-[280px]" : "aspect-square"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Clinic gallery photo ${index + 1}`}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
