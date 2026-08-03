// The beach behind the title on the home page.
//
// The source is one of the business's Instagram reels — a 1440×2560 vertical
// collage of three stacked clips, 25 MB. Used as-is it would show a narrow
// horizontal band across the seam between two of them on any landscape screen,
// so the middle panel is cropped out into a proper 16:9.5 clip and re-encoded:
// 25 MB → about 1 MB. The originals are not in the repo; `docs/media.md`
// records the ffmpeg commands so the crop can be reproduced or changed.
//
// `poster` carries the first frame, so the hero is never empty while the video
// loads and is all that mobile data plans pay for when the video is skipped.

export function HeroVideo({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden">
      <video
        // muted + playsInline are what make autoplay legal on iOS and Chrome;
        // without both, the browser silently refuses and shows the poster.
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/video/hero-poster.jpg"
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover motion-reduce:hidden"
      >
        {/* WebM first: smaller where it is supported, MP4 for everyone else. */}
        <source src="/video/hero.webm" type="video/webm" />
        <source src="/video/hero.mp4" type="video/mp4" />
      </video>

      {/* Still shown to anyone who asked their system for less motion — the
          video is hidden for them, and this keeps the section from going blank. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-cover bg-center motion-reduce:block"
        style={{ backgroundImage: "url('/video/hero-poster.jpg')" }}
      />

      {/* Footage this bright cannot carry white text on its own. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-black/55 via-black/40 to-black/60"
      />

      {children}
    </section>
  );
}
