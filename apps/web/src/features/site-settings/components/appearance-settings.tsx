import { useId, useRef, type CSSProperties, type Ref, type SetStateAction } from "react"
import { IconBraces, IconNotes } from "@tabler/icons-react"
import type { SiteContent, SiteVariableDefinition } from "@handout/site-document"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import {
  primaryColorOptions,
  SYSTEM_SITE_VARIABLE_IDS,
  systemSiteVariables,
} from "../model"

type AppearanceSettingsProps = {
  content: SiteContent
  onChange: (content: SetStateAction<SiteContent>) => void
  siteName: string
  variables: SiteVariableDefinition[]
}

const modeOptions = [
  { value: "light", label: "Light", description: "Always light mode" },
  { value: "dark", label: "Dark", description: "Always dark mode" },
  {
    value: "system",
    label: "Automatic",
    description: "Follow the users system theme",
  },
] as const

export function AppearanceSettings({
  content,
  onChange,
  siteName,
  variables,
}: AppearanceSettingsProps) {
  const allVariables = mergeVariables(variables)
  const updateSettings = (settings: Partial<SiteContent["settings"]>) => {
    onChange((currentContent) => ({
      ...currentContent,
      settings: { ...currentContent.settings, ...settings },
    }))
  }

  return (
    <div className="flex flex-col gap-7 pb-4">
      <FieldGroup className="gap-7">
        <VariableTemplateField
          label="Title"
          maxLength={160}
          onChange={(siteTitle) => updateSettings({ siteTitle })}
          placeholder="Site title..."
          value={content.settings.siteTitle || siteName}
          variables={allVariables}
        />
        <VariableTemplateField
          label="Description"
          maxLength={1000}
          multiline
          onChange={(siteDescription) => updateSettings({ siteDescription })}
          placeholder="Site description..."
          value={content.settings.siteDescription}
          variables={allVariables}
        />
      </FieldGroup>

      <Field className="gap-3">
        <div>
          <FieldLabel>Mode</FieldLabel>
          <p className="text-sm leading-5 text-muted-foreground">
            The color mode your site uses for visitors
          </p>
        </div>
        <ToggleGroup
          aria-label="Site appearance mode"
          className="grid h-[280px] w-full grid-rows-3 gap-1.5"
          orientation="vertical"
          type="single"
          value={content.themeMode}
          variant="outline"
          onValueChange={(value) => {
            if (value === "light" || value === "dark" || value === "system") {
              onChange((currentContent) => ({ ...currentContent, themeMode: value }))
            }
          }}
        >
          {modeOptions.map((option) => (
            <ToggleGroupItem
              key={option.value}
              aria-label={`${option.label}: ${option.description}`}
              className="h-full w-full justify-start gap-4 overflow-hidden rounded-xl border-border bg-transparent py-1.5 pr-4 pl-1.5 text-left data-[state=off]:opacity-80 data-[state=on]:border-purple-foreground data-[state=on]:bg-transparent hover:bg-transparent"
              value={option.value}
            >
              <ModePreview mode={option.value} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm leading-5 font-medium text-foreground">
                  {option.label}
                </span>
                <span className="block text-sm leading-5 font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field className="gap-3">
        <div>
          <FieldLabel>Primary color</FieldLabel>
          <p className="text-sm leading-5 text-muted-foreground">
            The color used for primary buttons and other elements
          </p>
        </div>
        <ToggleGroup
          aria-label="Primary color"
          className="w-full justify-start gap-2.5"
          type="single"
          value={content.settings.primaryColor}
          onValueChange={(value) => {
            if (primaryColorOptions.some((option) => option.value === value)) {
              updateSettings({ primaryColor: value as SiteContent["settings"]["primaryColor"] })
            }
          }}
        >
          {primaryColorOptions.map((option) => (
            <ToggleGroupItem
              key={option.value}
              aria-label={option.label}
              className="group size-6 min-w-6 rounded-full border border-black/15 p-0 hover:opacity-90 data-[state=on]:border-black/15 data-[state=on]:bg-transparent"
              value={option.value}
            >
              <span
                className={cn(
                  "relative size-full rounded-full after:absolute after:top-1/2 after:left-1/2 after:hidden after:size-2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-white group-data-[state=on]:after:block",
                  option.className,
                )}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <PrimaryColorPreview color={content.settings.primaryColor} />
      </Field>
    </div>
  )
}

function VariableTemplateField({
  label,
  maxLength,
  multiline = false,
  onChange,
  placeholder,
  value,
  variables,
}: {
  label: string
  maxLength: number
  multiline?: boolean
  onChange: (value: string) => void
  placeholder: string
  value: string
  variables: SiteVariableDefinition[]
}) {
  const id = useId()
  const controlRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const insertVariable = (variable: SiteVariableDefinition) => {
    const control = controlRef.current
    const token = `{{${variable.key}}}`
    const start = control?.selectionStart ?? value.length
    const end = control?.selectionEnd ?? value.length
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`)
    requestAnimationFrame(() => {
      control?.focus()
      control?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup
        size={multiline ? "md" : "lg"}
        className={cn("overflow-hidden", multiline && "min-h-20 items-start")}
      >
        {multiline ? (
          <InputGroupTextarea
            id={id}
            maxLength={maxLength}
            placeholder={placeholder}
            ref={controlRef as Ref<HTMLTextAreaElement>}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <InputGroupInput
            id={id}
            maxLength={maxLength}
            placeholder={placeholder}
            ref={controlRef as Ref<HTMLInputElement>}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
        <InputGroupAddon
          align="inline-end"
          className={cn(
            "opacity-0 transition-opacity group-focus-within/input-group:opacity-100 group-hover/input-group:opacity-100",
            multiline && "self-start",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton
                size="icon-xs"
                aria-label={`Insert a variable in ${label.toLowerCase()}`}
              >
                <IconBraces />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Insert recipient variable</DropdownMenuLabel>
              {variables.map((variable) => (
                <DropdownMenuItem key={variable.id} onSelect={() => insertVariable(variable)}>
                  <IconBraces />
                  {variable.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

function ModePreview({ mode }: { mode: (typeof modeOptions)[number]["value"] }) {
  if (mode === "system") {
    return (
      <span className="flex h-full w-[100px] shrink-0 overflow-hidden rounded-lg border bg-card pl-4">
        <span className="flex h-full min-w-0 flex-1 items-end pt-4">
          <span className="flex size-full items-start rounded-tl-md border border-r-0 border-b-0 border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm leading-5 font-medium text-neutral-900">
            Aa
          </span>
        </span>
        <span className="flex h-full min-w-0 flex-1 items-end pt-4">
          <span className="flex size-full items-start border border-r-0 border-b-0 border-l-0 border-neutral-600 bg-neutral-800 px-3 py-2.5 text-sm leading-5 font-medium text-neutral-200">
            Aa
          </span>
        </span>
      </span>
    )
  }

  return (
    <span className="flex h-full w-[100px] shrink-0 items-end overflow-hidden rounded-lg border bg-card pt-4 pl-4">
      <span
        className={cn(
          "flex size-full items-start rounded-tl-md border border-r-0 border-b-0 px-3 py-2.5 text-sm leading-5 font-medium",
          mode === "dark"
            ? "border-neutral-600 bg-neutral-800 text-neutral-200"
            : "border-neutral-200 bg-neutral-50 text-neutral-900",
        )}
      >
        Aa
      </span>
    </span>
  )
}

function PrimaryColorPreview({ color }: { color: SiteContent["settings"]["primaryColor"] }) {
  const style = getPreviewColorStyle(color)

  return (
    <div
      className="flex h-20 items-center justify-center gap-3 rounded-lg border bg-card"
      style={style}
    >
      <Button
        className="bg-[var(--preview-primary)] text-[var(--preview-foreground)] hover:bg-[var(--preview-primary)]/80"
      >
        Button
      </Button>
      <span className="flex h-8 items-center gap-2 rounded-lg bg-[var(--preview-primary-soft)] px-2 text-base leading-6 text-[var(--preview-primary)]">
        <IconNotes className="size-4 shrink-0" />
        Tab
      </span>
    </div>
  )
}

function getPreviewColorStyle(color: SiteContent["settings"]["primaryColor"]): CSSProperties {
  if (color === "neutral") {
    return {
      "--preview-primary": "var(--foreground)",
      "--preview-foreground": "var(--background)",
      "--preview-primary-soft": "var(--accent)",
    } as CSSProperties
  }

  return {
    "--preview-primary": `var(--${color}-foreground)`,
    "--preview-foreground": "var(--background)",
    "--preview-primary-soft": `var(--${color}-background-subtle)`,
  } as CSSProperties
}

function mergeVariables(variables: SiteVariableDefinition[]) {
  const byId = new Map(systemSiteVariables.map((variable) => [variable.id, variable]))
  variables.forEach((variable) => {
    if (!SYSTEM_SITE_VARIABLE_IDS.has(variable.id)) byId.set(variable.id, variable)
  })
  return [...byId.values()]
}
