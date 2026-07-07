import {
  IconBox,
  IconCalendarEvent,
  IconChevronDown,
  IconGif,
  IconPhoto,
  IconPlayerPlayFilled,
  IconQuote,
  IconVideo,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

import { LightsitePageFooter } from "@/components/common/lightsite-page-footer";
import { cn } from "@/lib/utils";

import { resolvePublicAssetSrc } from "./asset-resolution";
import type { PublishedSitePayload, PublicBlock, PublicButtonBlock } from "./types";
import { buildVariableValueMap, resolveUrl, resolveVariables } from "./variable-resolution";

type PublicSiteRendererProps = {
  payload: PublishedSitePayload;
};

export function PublicSiteRenderer({ payload }: PublicSiteRendererProps) {
  const values = buildVariableValueMap(payload, payload.selectedVariant);
  const hero = payload.chrome.hero;
  const siteHeader = payload.chrome.siteHeader;
  const title = resolveVariables(hero.title, values);
  const subtitle = hero.subtitle ? resolveVariables(hero.subtitle, values) : null;
  const logoSrc = siteHeader.logoUrl ? resolvePublicAssetSrc(resolveVariables(siteHeader.logoUrl, values)) : null;
  const primaryButton = resolveHeaderButton({
    href: siteHeader.primaryButtonHref,
    label: siteHeader.primaryButtonText,
    values,
  });
  const secondaryButton = siteHeader.showSecondaryButton
    ? resolveHeaderButton({
      href: siteHeader.secondaryButtonHref,
      label: siteHeader.secondaryButtonText,
      values,
    })
    : null;
  const primaryHeroAvatarSrc = hero.avatarImageUrl
    ? resolvePublicAssetSrc(resolveVariables(hero.avatarImageUrl, values))
    : null;
  const secondaryHeroAvatarSrc = hero.avatarMode === "duo" && hero.avatarImageSecondaryUrl
    ? resolvePublicAssetSrc(resolveVariables(hero.avatarImageSecondaryUrl, values))
    : null;

  return (
    <main className="min-h-svh bg-background font-site text-foreground">
      <article className="mx-auto flex min-h-svh w-full min-w-[720px] flex-col bg-background max-[720px]:min-w-0">
        <div className="mx-auto flex h-[54px] w-full max-w-[600px] items-center gap-2.5 py-3">
          <div className="min-w-0 flex-1">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={siteHeader.brandName ? `${siteHeader.brandName} logo` : "Logo"}
                className="h-5 w-auto object-contain"
              />
            ) : (
              <p className="truncate text-sm font-medium">{siteHeader.brandName || payload.workspace.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {secondaryButton ? (
              <PublicHeaderButton
                tone="secondary"
                href={secondaryButton.href}
                label={secondaryButton.label}
                trackId="site-header-secondary"
              />
            ) : null}
            {primaryButton ? (
              <PublicHeaderButton
                tone="primary"
                href={primaryButton.href}
                label={primaryButton.label}
                trackId="site-header-primary"
              />
            ) : null}
          </div>
        </div>
        <section className="mx-auto flex min-h-[204px] w-full max-w-[600px] flex-col items-center justify-center gap-4 overflow-hidden border-y border-border-subtle px-7 py-8 text-center">
          <HeroLogos
            primaryAlt={hero.avatarImageAlt ?? ""}
            primarySrc={primaryHeroAvatarSrc}
            secondaryAlt={hero.avatarImageSecondaryAlt ?? ""}
            secondarySrc={secondaryHeroAvatarSrc}
          />
          <div className="flex max-w-full flex-col items-center gap-1">
            <h1 className="w-[400px] max-w-full text-center text-[28px] leading-9 font-medium tracking-normal text-balance">
              {title}
            </h1>
            {subtitle ? (
              <p className="w-[400px] max-w-full text-center text-xl leading-7 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
        </section>

        <div className="mx-auto flex w-full max-w-[600px] flex-1 flex-col pt-5">
          {payload.blocks.map((block, index) => (
            <PublicBlockRenderer key={block.id} block={block} blockIndex={index} values={values} />
          ))}
        </div>

        <LightsitePageFooter className="mx-auto w-full max-w-[600px]" />
      </article>
    </main>
  );
}

function PublicBlockRenderer({
  block,
  blockIndex,
  values,
}: {
  block: PublicBlock;
  blockIndex: number;
  values: ReturnType<typeof buildVariableValueMap>;
}) {
  const shell = (children: ReactNode) => (
    <PublicBlockShell block={block} blockIndex={blockIndex}>{children}</PublicBlockShell>
  );

  switch (block.type) {
    case "heading": {
      const text = resolveVariables(block.text, values);
      const Heading = block.level === 1 ? "h1" : (block.level === 2 ? "h2" : "h3");

      return shell(
        <Heading
          className={cn(
            "block min-h-7 whitespace-pre-wrap font-medium tracking-normal",
            block.level === 1 ? "text-xl leading-7" : "text-base leading-7",
          )}
        >
          {text}
        </Heading>,
      );
    }

    case "text":
      return shell(
        <p className="block min-h-6 whitespace-pre-wrap text-base leading-6 text-secondary-foreground">
          {resolveVariables(block.text, values)}
        </p>,
      );

    case "divider":
      return shell(<div className="py-3" aria-hidden="true"><div className="h-px bg-border-subtle" /></div>);

    case "bullet-list":
      return shell(
        <ul className="my-1 list-disc pl-8 text-base leading-6 text-secondary-foreground [&>li]:pl-1">
          {block.items.map((item) => <li key={item}>{resolveVariables(item, values)}</li>)}
        </ul>,
      );

    case "number-list":
      return shell(
        <ol className="my-1 list-decimal pl-8 text-base leading-6 text-secondary-foreground [&>li]:pl-1">
          {block.items.map((item) => <li key={item}>{resolveVariables(item, values)}</li>)}
        </ol>,
      );

    case "icon-list":
      return shell(
        <div className="flex w-[544px] max-w-full flex-col gap-1.5">
          {block.items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className="flex size-6 shrink-0 items-center justify-center rounded-md border bg-background [&_svg]:size-4"
                style={{ color: getIconToneValue(item.iconTone) }}
              >
                <PublicIconGlyph icon={item.icon} />
              </span>
              <span className="block min-h-6 min-w-0 flex-1 whitespace-pre-wrap text-base leading-6">
                {resolveVariables(item.text, values)}
              </span>
            </div>
          ))}
        </div>,
      );

    case "image": {
      const imageSrc = resolvePublicAssetSrc(block.asset.src);

      return shell(
        <MediaSurface src={imageSrc} alt={block.asset.alt} icon={<IconPhoto />} />
      );
    }

    case "gif": {
      const gifSrc = resolvePublicAssetSrc(block.asset.src);

      return shell(<MediaSurface src={gifSrc} alt={block.asset.alt} icon={<IconGif />} />);
    }

    case "image-card": {
      const src = block.src ? resolvePublicAssetSrc(resolveVariables(block.src, values)) : null;

      return shell(
        <div className="rounded-[14px] border bg-background p-1.5 pr-5">
          <div className="flex h-32 items-center gap-6 rounded-xl">
            <MediaSurface
              src={src}
              alt={block.alt}
              icon={<IconPhoto />}
              className="h-32 w-[200px] shrink-0 rounded-[10px] border-0 bg-transparent"
            />
            <div className="min-w-0 flex-1">
              <p className="text-base leading-6 font-medium">{resolveVariables(block.title, values)}</p>
              <p className="text-sm leading-6 text-tertiary-foreground">{resolveVariables(block.body, values)}</p>
              {block.includeButton && block.buttonText ? (
                <PublicSmallButton
                  href={resolveUrl(block.buttonUrl, values)}
                  label={resolveVariables(block.buttonText, values)}
                  style="outline"
                  trackId={`${block.id}-button`}
                />
              ) : null}
            </div>
          </div>
        </div>,
      );
    }

    case "icon-card":
      return shell(
        <div className="rounded-[14px] border bg-background px-4 pt-4 pb-4">
          {block.includeIcon ? (
            <span
              className="flex size-10 items-center justify-center rounded-[10px] border bg-background [&_svg]:size-5"
              style={{ color: getIconToneValue(block.iconTone) }}
            >
              <PublicIconGlyph icon={block.icon} />
            </span>
          ) : null}
          <p className={cn("text-xl leading-7 font-medium", block.includeIcon && "mt-3")}>{resolveVariables(block.title, values)}</p>
          <p className="text-sm leading-6 text-tertiary-foreground">{resolveVariables(block.body, values)}</p>
        </div>,
      );

    case "button":
      return shell(<PublicButton block={block} values={values} />);

    case "calendar": {
      const href = resolveUrl(block.href, values);
      const label = resolveVariables(block.label, values);

      return shell(
        <PublicSmallButton href={href} label={label} style="filled" trackId={block.id} icon={<IconCalendarEvent data-icon="inline-start" />} />,
      );
    }

    case "accordion":
      return shell(
        <div className="overflow-hidden rounded-[14px] border bg-background">
          {block.items.map((item) => (
            <details key={item.id} open={item.expanded || undefined} className="group/accordion border-b last:border-b-0">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex size-6 shrink-0 -rotate-90 items-center justify-center rounded-md text-muted-foreground transition-all group-open/accordion:rotate-0 hover:bg-muted hover:text-foreground [&_svg]:size-3.5">
                  <IconChevronDown />
                </span>
                <span className="min-w-0 flex-1 text-base leading-6 font-medium">{resolveVariables(item.title, values)}</span>
              </summary>
              <p className="mx-4 mb-3 ml-12 text-sm leading-6 text-tertiary-foreground">{resolveVariables(item.body, values)}</p>
            </details>
          ))}
        </div>,
      );

    case "video": {
      const thumbnail = block.thumbnail ? resolvePublicAssetSrc(resolveVariables(block.thumbnail, values)) : null;

      return shell(
        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="relative h-[241px] w-full overflow-hidden bg-primary text-primary-foreground">
            {thumbnail ? (
              <img src={thumbnail} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center bg-primary text-primary-foreground/80">
                <IconVideo />
              </div>
            )}
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-[72px] items-center justify-center rounded-full bg-primary-foreground/35">
                <IconPlayerPlayFilled />
              </span>
            </span>
          </div>
        </div>,
      );
    }

    case "testimonial": {
      const avatar = block.avatar ? resolvePublicAssetSrc(resolveVariables(block.avatar, values)) : null;

      return shell(
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-base leading-6">{resolveVariables(block.quote, values)}</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center overflow-hidden rounded-full border bg-secondary text-secondary-foreground">
              {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : <IconQuote />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-5 font-medium">{resolveVariables(block.name, values)}</p>
              <p className="text-sm leading-5 text-tertiary-foreground">{resolveVariables(block.role, values)}</p>
            </div>
          </div>
        </div>,
      );
    }

    case "logo-grid":
      return shell(
        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
          {block.logos.map((logo) => {
            const src = logo.image ? resolvePublicAssetSrc(resolveVariables(logo.image, values)) : null;

            return (
              <div key={logo.id} className="relative flex h-[116px] flex-col items-center justify-start rounded-lg text-center text-tertiary-foreground">
                <span className="mt-4 flex size-10 items-center justify-center overflow-hidden rounded-lg border bg-background text-muted-foreground">
                  {src ? <img src={src} alt="" className="size-full object-contain" /> : <IconPhoto />}
                </span>
                <span className="mt-2 h-6 px-2 text-center text-base leading-6 text-foreground">{resolveVariables(logo.name, values)}</span>
              </div>
            );
          })}
        </div>,
      );
  }
}

function PublicBlockShell({
  block,
  blockIndex,
  children,
}: {
  block: PublicBlock
  blockIndex: number
  children: ReactNode
}) {
  return (
    <div
      data-block-type={block.type}
      className={cn(
        "relative w-full rounded-[10px] px-1.5 outline-none",
        block.type === "heading" ? "py-0.5" : block.type === "text" ? "py-1" : "py-1.5",
        blockIndex > 0 && "mt-1",
      )}
    >
      {children}
    </div>
  );
}

function MediaSurface({
  alt,
  className,
  icon,
  src,
}: {
  alt: string
  className?: string
  icon: ReactNode
  src: string | null
}) {
  return (
    <div
      className={cn(
        "flex h-[220px] w-full items-center justify-center overflow-hidden rounded-lg text-muted-foreground",
        src ? "bg-background" : "border border-dashed bg-muted/40",
        className,
      )}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : icon}
    </div>
  );
}

function PublicButton({ block, values }: { block: PublicButtonBlock; values: ReturnType<typeof buildVariableValueMap> }) {
  const href = resolveUrl(block.href, values);
  const label = resolveVariables(block.label, values);

  return <PublicSmallButton href={href} label={label} style={block.style} trackId={block.id} />;
}

function PublicSmallButton({
  href,
  icon,
  label,
  style,
  trackId,
}: {
  href: string | null
  icon?: ReactNode
  label: string
  style: "filled" | "outline"
  trackId: string
}) {
  if (!href) {
    return null;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-track-click-id={trackId}
      data-track-label={label}
      className={cn(
        "inline-flex h-[30px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-transparent bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        style === "filled"
          ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/80"
          : "border-border bg-background text-foreground shadow-xs hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </a>
  );
}

function PublicHeaderButton({
  href,
  label,
  tone,
  trackId,
}: {
  href: string
  label: string
  tone: "primary" | "secondary"
  trackId: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-track-click-id={trackId}
      data-track-label={label}
      className={cn(
        "inline-flex h-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-clip-padding px-2.5 text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px",
        tone === "primary"
          ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/80"
          : "border-border bg-background text-foreground shadow-xs hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </a>
  )
}

function HeroLogos({
  primaryAlt,
  primarySrc,
  secondaryAlt,
  secondarySrc,
}: {
  primaryAlt: string
  primarySrc: string | null
  secondaryAlt: string
  secondarySrc: string | null
}) {
  if (!primarySrc && !secondarySrc) {
    return null
  }

  return (
    <div className="flex items-center justify-center gap-[5px]">
      {primarySrc ? <HeroLogo src={primarySrc} alt={primaryAlt} /> : null}
      {primarySrc && secondarySrc ? <span className="h-px w-[17px] bg-border-subtle" /> : null}
      {secondarySrc ? <HeroLogo src={secondarySrc} alt={secondaryAlt} /> : null}
    </div>
  )
}

function HeroLogo({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
      <span className="relative size-full">
        <img
          src={src}
          alt={alt}
          className="absolute top-1/2 left-1/2 h-auto w-10 -translate-x-1/2 -translate-y-1/2 object-contain"
        />
      </span>
    </div>
  )
}

function PublicIconGlyph({ icon }: { icon: string }) {
  if (icon === "calendar") return <IconCalendarEvent />;
  if (icon === "quote") return <IconQuote />;
  if (icon === "video") return <IconVideo />;
  return <IconBox />;
}

function getIconToneValue(tone: string) {
  if (tone === "amber") return "#d97706";
  if (tone === "blue") return "#2563eb";
  if (tone === "cyan") return "#0891b2";
  if (tone === "pink") return "#db2777";
  if (tone === "rose") return "#e11d48";
  if (tone === "teal") return "#0d9488";
  if (tone === "violet") return "#7c3aed";
  return "currentColor";
}

function resolveHeaderButton({
  href,
  label,
  values,
}: {
  href: string | null
  label: string | null
  values: ReturnType<typeof buildVariableValueMap>
}) {
  if (!href || !label) {
    return null
  }

  const resolvedHref = resolveUrl(href, values)
  const resolvedLabel = resolveVariables(label, values).trim()

  if (!resolvedHref || !resolvedLabel) {
    return null
  }

  return {
    href: resolvedHref,
    label: resolvedLabel,
  }
}
