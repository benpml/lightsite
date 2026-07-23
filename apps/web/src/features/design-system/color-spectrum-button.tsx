import { ColorPickerMenu } from "@/components/common/color-picker-menu"
import { ColorSpectrumSwatch } from "@/components/common/color-spectrum-swatch"
import { Button } from "@/components/ui/button"

export function ColorSpectrumButton({
  onValueChange,
  value,
}: {
  onValueChange: (value: string) => void
  value: string
}) {
  return (
    <ColorPickerMenu value={value} onValueChange={onValueChange}>
      <Button
        aria-label="Choose seed color"
        size="icon-lg"
        type="button"
        variant="ghost"
      >
        <ColorSpectrumSwatch className="size-8 ring-1 ring-foreground/10 transition-transform group-hover/button:scale-105 motion-reduce:transition-none" />
      </Button>
    </ColorPickerMenu>
  )
}
