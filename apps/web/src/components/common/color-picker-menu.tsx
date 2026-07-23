import { useState, type ReactElement } from "react"

import { Button } from "@/components/ui/button"
import {
  ColorPicker,
  ColorPickerControls,
  ColorPickerHue,
  ColorPickerSelection,
} from "@/components/ui/color-picker"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"

type ColorPickerMenuProps = {
  align?: "start" | "center" | "end"
  children: ReactElement
  description?: string
  onValueChange: (value: string) => void
  title?: string
  value: string
}

export function ColorPickerMenu({
  align = "start",
  children,
  description = "Contrast adjusts automatically.",
  onValueChange,
  title = "Custom color",
  value,
}: ColorPickerMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-72 gap-3"
        data-handout-color-picker-menu=""
        onMouseDown={(event) => event.stopPropagation()}
      >
        <PopoverHeader className="gap-0">
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <ColorPicker value={value} onValueChange={onValueChange}>
          <ColorPickerSelection />
          <ColorPickerHue />
          <ColorPickerControls />
        </ColorPicker>
        <Button type="button" className="w-full" onClick={() => setOpen(false)}>
          Done
        </Button>
      </PopoverContent>
    </Popover>
  )
}
