import { useEffect } from "react";
import { buildPublicScreenshotPath } from "@lightsite/site-document/renderer";

import type { PublishedSitePayload } from "./types";

export function getResolvedMetadata(payload: PublishedSitePayload, origin = "https://lightsite.app") {
  const canonicalPath = [
    "",
    payload.workspace.slug,
    payload.site.slug,
    payload.selectedVariant?.slug ?? null,
  ]
    .filter(Boolean)
    .join("/");
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const ogImageSrc = buildPublicScreenshotPath(payload);
  const ogImageUrl = new URL(ogImageSrc, origin).toString();

  return {
    title: payload.metadata.title,
    description: payload.metadata.description,
    robots: payload.metadata.robots,
    canonicalUrl,
    ogImageUrl,
  };
}

export function usePublicMetadata(payload: PublishedSitePayload) {
  useEffect(() => {
    const metadata = getResolvedMetadata(payload, window.location.origin);

    document.title = metadata.title;
    setLinkTag("canonical", metadata.canonicalUrl);
    setMetaTag("description", metadata.description);
    setMetaTag("robots", metadata.robots);
    setMetaProperty("og:title", metadata.title);
    setMetaProperty("og:description", metadata.description);
    setMetaProperty("og:image", metadata.ogImageUrl);
    setMetaProperty("og:image:type", "image/jpeg");
    setMetaProperty("og:image:width", "1200");
    setMetaProperty("og:image:height", "630");
    setMetaProperty("og:image:alt", metadata.title);
    setMetaProperty("og:url", metadata.canonicalUrl);
    setMetaProperty("og:type", "website");
    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", metadata.title);
    setMetaTag("twitter:description", metadata.description);
    setMetaTag("twitter:image", metadata.ogImageUrl);
    setMetaTag("twitter:image:alt", metadata.title);
  }, [payload]);
}

export function usePublicUnavailableMetadata() {
  useEffect(() => {
    const canonicalUrl = window.location.href;
    const fallbackImageUrl = new URL("/lightsite-logo.svg", window.location.origin).toString();

    document.title = "Page unavailable | Lightsite";
    setLinkTag("canonical", canonicalUrl);
    setMetaTag("robots", "noindex,nofollow");
    setMetaTag("description", "This Lightsite page is unavailable.");
    setMetaProperty("og:title", "Page unavailable | Lightsite");
    setMetaProperty("og:description", "This Lightsite page is unavailable.");
    setMetaProperty("og:image", fallbackImageUrl);
    setMetaProperty("og:url", canonicalUrl);
    setMetaProperty("og:type", "website");
    setMetaTag("twitter:card", "summary_large_image");
    setMetaTag("twitter:title", "Page unavailable | Lightsite");
    setMetaTag("twitter:description", "This Lightsite page is unavailable.");
    setMetaTag("twitter:image", fallbackImageUrl);
  }, []);
}

function setLinkTag(rel: string, href: string) {
  let element = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }

  element.href = href;
}

function setMetaTag(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }

  element.content = content;
}

function setMetaProperty(property: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.content = content;
}
