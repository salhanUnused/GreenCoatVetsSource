import Image from "next/image";

function canOptimizeImage(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname;
    return (
      host === "lh3.googleusercontent.com" ||
      host === "images.unsplash.com" ||
      host === "greencoatvets.com" ||
      host === "www.greencoatvets.com" ||
      host.endsWith(".supabase.co") ||
      host.endsWith(".supabase.in")
    );
  } catch {
    return false;
  }
}

export function HomeGallerySection({
  clinicName,
  urls,
}: {
  clinicName: string;
  urls: string[] | null | undefined;
}) {
  const list = Array.isArray(urls) ? urls : [];
  if (!list.length) return null;

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
          {list.map((url, index) => (
            <figure
              key={`${url}-${index}`}
              className={`relative overflow-hidden rounded-2xl border border-outline-variant/25 bg-surface-container-lowest shadow-sm ${
                index % 5 === 0 ? "row-span-2 aspect-[3/4] sm:aspect-auto sm:min-h-[280px]" : "aspect-square"
              }`}
            >
              <Image
                src={url}
                alt={`Clinic gallery photo ${index + 1}`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover transition-transform duration-500 hover:scale-[1.03]"
                loading="lazy"
                unoptimized={!canOptimizeImage(url)}
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
