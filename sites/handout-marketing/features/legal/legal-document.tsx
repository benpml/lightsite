import type { ReactNode } from "react"
import Link from "next/link"

import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SectionFrame } from "@/components/layout/section-frame"
import { cn } from "@/lib/utils"

export type LegalSection = {
  id: string
  number: string
  title: string
  shortTitle?: string
  children: ReactNode
}

type LegalDocumentProps = {
  eyebrow: string
  title: string
  description: string
  effectiveDate: string
  updatedDate?: string
  scopeItems: ReadonlyArray<{
    label: string
    description: string
  }>
  sections: ReadonlyArray<LegalSection>
  relatedLink: {
    href: string
    label: string
  }
  children?: ReactNode
}

function LegalDocument({
  eyebrow,
  title,
  description,
  effectiveDate,
  updatedDate = effectiveDate,
  scopeItems,
  sections,
  relatedLink,
  children,
}: LegalDocumentProps) {
  return (
    <main id="top" className="min-h-screen bg-background text-foreground">
      <SectionFrame
        divider="none"
        handles="none"
        innerClassName="flex min-h-[88px] items-center justify-center px-4 sm:px-8"
      >
        <SiteHeader width="full" items={[]} />
      </SectionFrame>

      <SectionFrame
        handles="both"
        bottomDivider
        innerClassName="px-6 py-16 sm:px-10 sm:py-20 lg:px-16 lg:py-24"
      >
        <div className="mx-auto max-w-[840px]">
          <p className="text-label-md text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-5 max-w-[760px] text-title-xl text-foreground">
            {title}
          </h1>
          <p className="mt-7 max-w-[720px] text-body-2xl text-muted-foreground">
            {description}
          </p>
          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-5 text-body-sm">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Effective</dt>
              <dd className="text-foreground">{effectiveDate}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="text-foreground">{updatedDate}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Related</dt>
              <dd>
                <Link
                  href={relatedLink.href}
                  className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  {relatedLink.label}
                </Link>
              </dd>
            </div>
          </dl>
        </div>
      </SectionFrame>

      <SectionFrame
        handles="none"
        bottomDivider
        innerClassName="grid sm:grid-cols-3"
      >
        {scopeItems.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "px-6 py-7 sm:px-8",
              index > 0 && "border-t border-border sm:border-t-0 sm:border-l",
            )}
          >
            <p className="text-label-xs text-foreground">{item.label}</p>
            <p className="mt-2 text-body-sm text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </SectionFrame>

      <SectionFrame
        handles="none"
        bottomDivider
        innerClassName="px-6 py-12 sm:px-10 lg:px-16 lg:py-16"
      >
        <div className="mx-auto grid max-w-[900px] gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
          <aside className="self-start lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-3">
            <p className="text-label-xs text-muted-foreground">On this page</p>
            <nav aria-label={`${title} sections`} className="mt-4">
              <ol className="grid gap-2">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-sm py-1 text-body-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="mr-2 tabular-nums text-foreground">
                        {section.number}
                      </span>
                      {section.shortTitle ?? section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <article className="min-w-0">
            {children}
            <div className="divide-y divide-border border-y border-border">
              {sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-8 py-10 first:pt-0 last:pb-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-label-xs tabular-nums text-muted-foreground">
                      {section.number}
                    </span>
                    <h2 className="text-title-xs text-foreground">
                      {section.title}
                    </h2>
                  </div>
                  <div className="legal-copy mt-6">{section.children}</div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </SectionFrame>

      <SiteFooter />
    </main>
  )
}

type LegalTableProps = {
  headers: ReadonlyArray<string>
  rows: ReadonlyArray<ReadonlyArray<ReactNode>>
  caption?: string
}

export function LegalTable({ headers, rows, caption }: LegalTableProps) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[620px] border-collapse text-left text-body-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-muted">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="border-b border-border px-4 py-3 text-label-xs text-foreground"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-4 py-3 text-muted-foreground first:text-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LegalCallout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="my-6 rounded-lg border border-border bg-muted px-5 py-4">
      <p className="text-label-sm text-foreground">{title}</p>
      <div className="mt-2 text-body-sm text-muted-foreground">{children}</div>
    </div>
  )
}

export function LegalAddress({ children }: { children: ReactNode }) {
  return (
    <address className="my-5 rounded-lg border border-border px-5 py-4 text-body-sm not-italic text-muted-foreground">
      {children}
    </address>
  )
}

export { LegalDocument }
