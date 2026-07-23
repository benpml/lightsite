import type { SiteContent, SitePrimaryColor } from "@handout/site-document"

import { ColorPickerMenu } from "@/components/common/color-picker-menu"
import { ColorSpectrumSwatch } from "@/components/common/color-spectrum-swatch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

import { primaryColorOptions } from "../model"

const CUSTOM_COLOR_VALUE = "custom"
const DEFAULT_CUSTOM_COLOR = "#755bde"
const colorSwatchClassName =
  "relative size-full after:absolute after:top-1/2 after:left-1/2 after:hidden after:size-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-white group-data-[state=on]:after:block"

export function PrimaryColorSelector({
  ariaLabel,
  customColor,
  onCustomColorChange,
  onPresetColorChange,
  primaryColor,
}: {
  ariaLabel: string
  customColor?: SiteContent["settings"]["customPrimaryColor"]
  onCustomColorChange: (value: string) => void
  onPresetColorChange: (value: SitePrimaryColor) => void
  primaryColor: SitePrimaryColor
}) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      className="w-full flex-wrap justify-start gap-2.5"
      type="single"
      value={customColor ? CUSTOM_COLOR_VALUE : primaryColor}
      onValueChange={(value) => {
        const option = primaryColorOptions.find((candidate) => candidate.value === value)
        if (option) onPresetColorChange(option.value)
      }}
    >
      {primaryColorOptions.map((option) => (
        <ToggleGroupItem
          key={option.value}
          aria-label={option.label}
          className="group size-[22px] min-w-[22px] rounded-full border border-black/15 p-0 hover:opacity-90 data-[state=on]:border-black/15 data-[state=on]:bg-transparent"
          value={option.value}
        >
          <span className={cn(colorSwatchClassName, "rounded-full", option.className)} />
        </ToggleGroupItem>
      ))}
      <ColorPickerMenu
        align="end"
        value={customColor ?? DEFAULT_CUSTOM_COLOR}
        onValueChange={onCustomColorChange}
      >
        <ToggleGroupItem
          aria-label="Custom color"
          className="group size-[22px] min-w-[22px] rounded-full border border-black/15 p-0 hover:opacity-90 data-[state=on]:border-black/15 data-[state=on]:bg-transparent"
          value={CUSTOM_COLOR_VALUE}
        >
          <ColorSpectrumSwatch className={colorSwatchClassName} />
        </ToggleGroupItem>
      </ColorPickerMenu>
    </ToggleGroup>
  )
}
