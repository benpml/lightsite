import { useDeferredValue, useMemo, useState } from "react"
import { deriveHandoutColorFamily, type HandoutColorRoles } from "@handout/design-tokens/color-family"
import { Link } from "@tanstack/react-router"
import { IconArrowLeft, IconArrowRight, IconCheck, IconPalette } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  PrimaryColorPreview,
} from "@/features/site-settings/components/primary-color-preview"
import type { PrimaryColorPreviewStyle } from "@/features/site-settings/components/primary-color-preview-style"

import { ColorSpectrumButton } from "./color-spectrum-button"

const DEFAULT_SEED = "#fff5d2"
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const exampleSeeds = [
  { label: "Cream", value: "#fff5d2" },
  { label: "Purple", value: "#755bde" },
  { label: "Blue", value: "#0085ee" },
  { label: "Cyan", value: "#05c5f0" },
  { label: "Green", value: "#2b9a66" },
  { label: "Red", value: "#dc3e42" },
] as const

const modeSurfaces = {
  light: {
    label: "Light",
    canvas: "#ffffff",
    card: "#fafafa",
    foreground: "#0a0a0a",
    border: "rgb(128 128 128 / 20%)",
  },
  dark: {
    label: "Dark",
    canvas: "#191919",
    card: "#252525",
    foreground: "#f5f5f5",
    border: "rgb(128 128 128 / 24%)",
  },
} as const

export function ColorPlaygroundPage() {
  const [seed, setSeed] = useState(DEFAULT_SEED)
  const deferredSeed = useDeferredValue(seed)
  const result = useMemo(() => {
    if (!HEX_COLOR.test(deferredSeed)) {
      return null
    }

    return deriveHandoutColorFamily(deferredSeed)
  }, [deferredSeed])
  const isInvalid = !HEX_COLOR.test(seed)

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-2xl flex-col gap-1">
          <Badge variant="outline">OKLCH color family</Badge>
          <h1 className="mt-2 text-2xl font-semibold tracking-normal">Custom color playground</h1>
          <p className="text-sm leading-5 text-muted-foreground">
            Start with one color. Handout preserves its hue and chroma, adjusts lightness for
            contrast, and generates the same semantic roles used by the primary-color system.
          </p>
        </div>
        <Button variant="outline" size="compact" asChild>
          <Link to="/design-system">
            <IconArrowLeft data-icon="inline-start" />
            Design system
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Seed color</CardTitle>
          <CardDescription>
            Very light colors are intentionally darkened for light-mode foreground use.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(420px,1.2fr)]">
          <FieldGroup>
            <Field data-invalid={isInvalid || undefined}>
              <FieldLabel htmlFor="color-playground-seed">HEX</FieldLabel>
              <div className="flex items-center gap-2">
                <ColorSpectrumButton
                  value={result?.source ?? DEFAULT_SEED}
                  onValueChange={setSeed}
                />
                <Input
                  id="color-playground-seed"
                  aria-invalid={isInvalid || undefined}
                  className="font-mono tabular-nums"
                  spellCheck={false}
                  value={seed}
                  onChange={(event) => setSeed(event.target.value)}
                />
              </div>
              <FieldDescription>Enter a six-digit hex value or use the color picker.</FieldDescription>
              {isInvalid ? <FieldError>Enter a color such as #fff5d2.</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel>Examples</FieldLabel>
              <ToggleGroup
                aria-label="Example seed colors"
                className="flex-wrap justify-start"
                type="single"
                value={HEX_COLOR.test(seed) ? seed.toLowerCase() : ""}
                onValueChange={(value) => {
                  if (value) setSeed(value)
                }}
              >
                {exampleSeeds.map((example) => (
                  <ToggleGroupItem
                    key={example.value}
                    aria-label={example.label}
                    className="size-8 rounded-full p-1"
                    value={example.value}
                  >
                    <span
                      className="size-full rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: example.value }}
                    />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Field>
          </FieldGroup>

          {result ? (
            <div className="flex min-w-0 flex-col justify-center gap-3">
              <div className="flex items-center gap-3">
                <TransformationChip label="Seed" value={result.source} swatch={result.source} />
                <IconArrowRight aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <TransformationChip
                  label="Light foreground"
                  value={result.light.foreground}
                  swatch={result.light.foreground}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {result.adjusted ? (
                  <Badge variant="secondary">Contrast adjusted</Badge>
                ) : (
                  <Badge variant="secondary">
                    <IconCheck data-icon="inline-start" />
                    Seed retained
                  </Badge>
                )}
                <code className="text-xs text-muted-foreground">{result.sourceOklch}</code>
              </div>
            </div>
          ) : (
            <div className="flex min-h-28 items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
              Enter a valid color to generate its roles.
            </div>
          )}
        </CardContent>
      </Card>

      {result ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <ModeColorCard mode="light" roles={result.light} />
          <ModeColorCard mode="dark" roles={result.dark} />
        </section>
      ) : null}
    </div>
  )
}

function ModeColorCard({
  mode,
  roles,
}: {
  mode: keyof typeof modeSurfaces
  roles: HandoutColorRoles
}) {
  const surface = modeSurfaces[mode]
  const previewStyle = {
    "--primary": roles.foreground,
    "--primary-background-subtle": roles.backgroundSubtle,
    "--primary-foreground": roles.onForeground,
    "--background": surface.canvas,
    "--foreground": surface.foreground,
    "--card": surface.card,
    "--border": surface.border,
  } as PrimaryColorPreviewStyle

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconPalette aria-hidden="true" />
            <CardTitle>{surface.label} mode</CardTitle>
          </div>
          <Badge variant="outline">{roles.contrast.toFixed(2)}:1</Badge>
        </div>
        <CardDescription>Foreground contrast measured against the subtle surface.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div
          className="grid grid-cols-2 gap-2 rounded-xl p-2 sm:grid-cols-4"
          style={{ backgroundColor: surface.canvas }}
        >
          <RoleChip
            label="Foreground"
            mode={mode}
            onColor={roles.onForeground}
            value={roles.foreground}
          />
          <RoleChip label="Background" mode={mode} value={roles.background} />
          <RoleChip label="Subtle" mode={mode} value={roles.backgroundSubtle} />
          <RoleChip label="Border" mode={mode} value={roles.border} />
        </div>
        <PrimaryColorPreview className="h-28" mode={mode} style={previewStyle} />
      </CardContent>
    </Card>
  )
}

function RoleChip({
  label,
  mode,
  onColor,
  value,
}: {
  label: string
  mode: keyof typeof modeSurfaces
  onColor?: string
  value: string
}) {
  const surface = modeSurfaces[mode]

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-lg ring-1 ring-black/10"
      style={{ backgroundColor: surface.card, color: surface.foreground }}
    >
      <div
        className="flex h-20 items-center justify-center text-sm font-medium"
        style={{ backgroundColor: value, color: onColor ?? surface.foreground }}
      >
        {onColor ? "Aa" : null}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-2 py-2">
        <span className="text-xs font-medium">{label}</span>
        <code className="truncate text-[10px] opacity-60" title={value}>{value}</code>
      </div>
    </div>
  )
}

function TransformationChip({
  label,
  swatch,
  value,
}: {
  label: string
  swatch: string
  value: string
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-card p-2">
      <span
        className="size-10 shrink-0 rounded-md ring-1 ring-foreground/10"
        style={{ backgroundColor: swatch }}
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        <code className="block truncate text-[11px] text-muted-foreground" title={value}>
          {value}
        </code>
      </span>
    </div>
  )
}
