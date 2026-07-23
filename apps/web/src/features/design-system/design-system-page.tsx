import { Link } from "@tanstack/react-router"
import { IconArrowRight, IconArrowUpRight, IconColorPicker, IconPalette } from "@tabler/icons-react"

import {
  baseColorTokens,
  nonGraySemanticColorTokens,
  semanticColorTokens,
  type TokenModeValue,
} from "./color-token-data"
import { PrimitiveGallery } from "./primitive-gallery"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const radiusTokens = [
  { name: "xs", className: "rounded-xs" },
  { name: "sm", className: "rounded-sm" },
  { name: "md", className: "rounded-md" },
  { name: "lg", className: "rounded-lg" },
  { name: "xl", className: "rounded-xl" },
  { name: "2xl", className: "rounded-2xl" },
]

export function DesignSystemPage() {
  return (
    <div className="flex flex-col gap-10 p-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-normal">Design system</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            The complete color reference for app chrome, editor interactions, and recipient-facing
            sites. Hex values resolve each token through its current inheritance chain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="compact" asChild>
            <Link to="/design-system/colors">
              <IconColorPicker data-icon="inline-start" />
              Color playground
            </Link>
          </Button>
          <Button variant="outline" size="compact" asChild>
            <Link to="/design-system/audit">
              Audit sheet
              <IconArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </section>
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconPalette aria-hidden="true" />
              <Badge variant="secondary">Base palette</Badge>
            </div>
            <CardTitle className="text-xl">Our base colors are all gray.</CardTitle>
            <CardDescription className="max-w-2xl text-primary-foreground/70">
              The foundation contains 11 neutral steps and 9 neutral alpha steps. Every non-gray
              color is named for a job—status, chart, selection, variable, link, or editor color.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Current inventory</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {baseColorTokens.length + semanticColorTokens.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <TokenCount label="Base" value={baseColorTokens.length} />
            <TokenCount label="Semantic" value={semanticColorTokens.length} />
            <TokenCount label="Non-gray" value={nonGraySemanticColorTokens.length} />
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Non-gray semantic colors"
          description="The chromatic part of the system. A split swatch shows light mode on the left and dark mode on the right."
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {nonGraySemanticColorTokens.map((token) => (
            <Card key={token.name} size="sm">
              <CardContent className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 grid-cols-2 overflow-hidden rounded-md ring-1 ring-foreground/10">
                  <div style={{ backgroundColor: token.light.hex }} />
                  <div style={{ backgroundColor: token.dark.hex }} />
                </div>
                <div className="min-w-0">
                  <code className="block truncate text-xs font-medium">--{token.name}</code>
                  <span className="text-xs text-muted-foreground">
                    {token.light.hex} · {token.dark.hex}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Base color tokens"
          description="Foundation values do not inherit from another token. Eight-digit hex values include alpha."
        />
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Inherits from</TableHead>
                  <TableHead>Resolved hex</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baseColorTokens.map((token) => (
                  <TableRow key={token.name}>
                    <TableCell><TokenName name={token.name} /></TableCell>
                    <TableCell className="text-muted-foreground">-</TableCell>
                    <TableCell><ColorValue hex={token.hex} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Semantic color tokens"
          description="Every semantic token, including app, chart, editor, variable, selection, and sidebar roles."
        />
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead rowSpan={2}>Token</TableHead>
                  <TableHead colSpan={2}>Light</TableHead>
                  <TableHead colSpan={2}>Dark</TableHead>
                </TableRow>
                <TableRow>
                  <TableHead>Inherits from</TableHead>
                  <TableHead>Resolved hex</TableHead>
                  <TableHead>Inherits from</TableHead>
                  <TableHead>Resolved hex</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semanticColorTokens.map((token) => (
                  <TableRow key={token.name}>
                    <TableCell><TokenName name={token.name} /></TableCell>
                    <TableCell><InheritedToken value={token.light} /></TableCell>
                    <TableCell><ColorValue hex={token.light.hex} /></TableCell>
                    <TableCell><InheritedToken value={token.dark} /></TableCell>
                    <TableCell><ColorValue hex={token.dark.hex} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Shape tokens" description="The radius scale used by shared primitives." />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Radius</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {radiusTokens.map((token) => (
              <div key={token.name} className="flex items-center gap-3">
                <div className={`size-10 border bg-card ${token.className}`} />
                <span className="text-sm text-muted-foreground">{token.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      <PrimitiveGallery />
    </div>
  )
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function TokenCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-lg font-semibold tabular-nums text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  )
}

function TokenName({ name }: { name: string }) {
  return <code className="text-xs font-medium text-foreground">--{name}</code>
}

function InheritedToken({ value }: { value: TokenModeValue }) {
  if (!value.inherits) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <IconArrowUpRight aria-hidden="true" />
      <code>--{value.inherits}</code>
    </span>
  )
}

function ColorValue({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="size-5 shrink-0 rounded-sm ring-1 ring-foreground/10"
        style={{ backgroundColor: hex }}
      />
      <code className="text-xs tabular-nums">{hex}</code>
    </span>
  )
}
