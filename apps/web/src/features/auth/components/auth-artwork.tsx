export function AuthArtwork() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden min-w-0 self-stretch overflow-hidden bg-muted md:block"
    >
      <img
        src="/auth/profile-cta-background.png"
        alt=""
        className="pointer-events-none absolute -top-10 -left-[11%] h-[119%] w-[151%] max-w-none"
      />
      <img
        src="/auth/profile-hero-background.png"
        alt=""
        className="pointer-events-none absolute -top-[92px] -left-[66px] h-[1178px] w-[1413px] max-w-none object-cover"
      />
      <div
        className="pointer-events-none absolute -inset-[56%_30%] opacity-75 mix-blend-lighten"
        style={{
          backgroundImage: "url('/auth/profile-noise.png')",
          backgroundPosition: "top left",
          backgroundSize: "141px 141px",
        }}
      />
      <div className="absolute top-[78px] left-[82px] h-[652px] w-[533px] rounded-2xl bg-background" />
    </div>
  )
}
