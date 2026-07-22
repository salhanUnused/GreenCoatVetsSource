import { resolveWelcomeVideoEmbed } from "@/lib/marketing/gallery-welcome-video";

export function HomeWelcomeVideoSection({
  clinicName,
  videoUrl,
}: {
  clinicName: string;
  videoUrl: string | null;
}) {
  const embed = resolveWelcomeVideoEmbed(videoUrl);
  if (!embed) return null;

  return (
    <section className="bg-surface-container-low py-16 sm:py-20" aria-labelledby="welcome-video-heading">
      <div className="mx-auto flex max-w-7xl flex-col items-center px-6">
        <div className="mb-8 max-w-xl text-center">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Welcome</p>
          <h2 id="welcome-video-heading" className="mt-2 font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">
            Meet {clinicName}
          </h2>
          <p className="mt-3 text-on-surface-variant">A short welcome from our team — see what makes our clinic special.</p>
        </div>

        <div className="w-full max-w-md">
          <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-primary p-3 shadow-xl shadow-primary/30 sm:p-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(54,196,151,0.45),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(0,0,0,0.18),transparent_50%)]" />
            <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[1.5rem] bg-on-primary/10 ring-1 ring-white/20 backdrop-blur-[2px]">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="material-symbols-outlined text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_circle
                </span>
                <span className="font-label text-xs font-bold uppercase tracking-wider text-on-primary/90">Welcome video</span>
              </div>
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-none bg-black/20">
                {embed.kind === "video" ? (
                  <video
                    className="absolute inset-0 h-full w-full object-cover"
                    src={embed.src}
                    controls
                    playsInline
                    preload="metadata"
                  >
                    <track kind="captions" />
                  </video>
                ) : (
                  <iframe
                    title={`${clinicName} welcome video`}
                    src={embed.src}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
