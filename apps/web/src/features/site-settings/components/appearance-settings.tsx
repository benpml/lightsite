import { useId, useRef, type Ref, type SetStateAction } from "react"
import { IconBraces } from "@tabler/icons-react"
import type { SiteContent, SiteVariableDefinition } from "@handout/site-document"

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

import { PrimaryColorSelector } from "./primary-color-selector"
import { PrimaryColorPreview } from "./primary-color-preview"
import { getPrimaryColorPreviewStyles } from "./primary-color-preview-style"

import {
  modeOptions,
  SYSTEM_SITE_VARIABLE_IDS,
  systemSiteVariables,
} from "../model"

type AppearanceSettingsProps = {
  content: SiteContent
  onChange: (content: SetStateAction<SiteContent>) => void
  siteName: string
  variables: SiteVariableDefinition[]
}

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
  const updatePresetPrimaryColor = (primaryColor: SiteContent["settings"]["primaryColor"]) => {
    onChange((currentContent) => {
      const settings = { ...currentContent.settings, primaryColor }
      delete settings.customPrimaryColor

      return { ...currentContent, settings }
    })
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
              className="h-full w-full justify-start gap-4 overflow-hidden rounded-xl border-border bg-transparent py-1.5 pr-4 pl-1.5 text-left transition-opacity data-[state=off]:opacity-80 data-[state=off]:hover:opacity-100 data-[state=on]:border-purple-foreground data-[state=on]:bg-transparent hover:bg-transparent"
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
        <PrimaryColorSelector
          ariaLabel="Primary color"
          customColor={content.settings.customPrimaryColor}
          primaryColor={content.settings.primaryColor}
          onCustomColorChange={(customPrimaryColor) => updateSettings({ customPrimaryColor })}
          onPresetColorChange={updatePresetPrimaryColor}
        />
        <PrimaryColorPreview
          mode="split"
          styles={getPrimaryColorPreviewStyles(
            content.settings.primaryColor,
            content.settings.customPrimaryColor,
          )}
        />
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

export function ModePreview({ mode }: { mode: (typeof modeOptions)[number]["value"] }) {
  if (mode === "system") {
    return (
      <span className="flex h-full w-[100px] shrink-0 overflow-hidden rounded-lg border bg-card pl-4">
        <span className="flex h-full min-w-0 flex-1 items-end pt-4">
          <span className="flex size-full items-start rounded-tl-md border border-r-0 border-b-0 border-neutral-200 bg-white-white px-3 py-2.5 text-sm leading-5 font-medium text-neutral-900">
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
            : "border-neutral-200 bg-white-white text-neutral-900",
        )}
      >
        Aa
      </span>
    </span>
  )
}

function mergeVariables(variables: SiteVariableDefinition[]) {
  const byId = new Map(systemSiteVariables.map((variable) => [variable.id, variable]))
  variables.forEach((variable) => {
    if (!SYSTEM_SITE_VARIABLE_IDS.has(variable.id)) byId.set(variable.id, variable)
  })
  return [...byId.values()]
}
