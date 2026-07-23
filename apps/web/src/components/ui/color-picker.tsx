"use client"

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react"
import { IconColorPicker } from "@tabler/icons-react"
import { Slider as SliderPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  colorToHsv,
  hsvToHex,
  normalizeHexColor,
  type HsvColor,
} from "@/lib/color-picker"
import { cn } from "@/lib/utils"

type ColorPickerContextValue = HsvColor & {
  hex: string
  setColor: (color: Partial<HsvColor>) => void
  setHex: (value: string) => void
}

const ColorPickerContext = createContext<ColorPickerContextValue | null>(null)

function useColorPicker() {
  const context = useContext(ColorPickerContext)
  if (!context) {
    throw new Error("Color picker components must be used inside ColorPicker")
  }

  return context
}

type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
  value: string
  onValueChange: (value: string) => void
}

function ColorPicker({
  className,
  onValueChange,
  value,
  ...props
}: ColorPickerProps) {
  const [color, setColorState] = useState<HsvColor>(
    () => colorToHsv(value) ?? { hue: 0, saturation: 0, value: 0 },
  )

  useEffect(() => {
    const normalizedValue = normalizeHexColor(value)
    if (!normalizedValue) return

    setColorState((currentColor) => {
      if (normalizedValue === hsvToHex(currentColor)) return currentColor

      return colorToHsv(normalizedValue, currentColor.hue) ?? currentColor
    })
  }, [value])

  const updateColor = useCallback((update: Partial<HsvColor>) => {
    const nextColor = normalizePickerColor({ ...color, ...update })
    setColorState(nextColor)
    onValueChange(hsvToHex(nextColor))
  }, [color, onValueChange])

  const setHex = useCallback((nextValue: string) => {
    const nextColor = colorToHsv(nextValue, color.hue)
    if (!nextColor) return

    setColorState(nextColor)
    onValueChange(hsvToHex(nextColor))
  }, [color.hue, onValueChange])

  const contextValue = useMemo(() => ({
    ...color,
    hex: hsvToHex(color),
    setColor: updateColor,
    setHex,
  }), [color, setHex, updateColor])

  return (
    <ColorPickerContext.Provider value={contextValue}>
      <div
        data-slot="color-picker"
        className={cn("flex flex-col gap-3", className)}
        {...props}
      />
    </ColorPickerContext.Provider>
  )
}

type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>

const ColorPickerSelection = memo(function ColorPickerSelection({
  className,
  ...props
}: ColorPickerSelectionProps) {
  const { hue, saturation, setColor, value } = useColorPicker()

  const updateFromPointer = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))

    setColor({
      saturation: x * 100,
      value: (1 - y) * 100,
    })
  }, [setColor])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1
    const updates: Partial<HsvColor> = {}

    if (event.key === "ArrowLeft") updates.saturation = saturation - step
    if (event.key === "ArrowRight") updates.saturation = saturation + step
    if (event.key === "ArrowDown") updates.value = value - step
    if (event.key === "ArrowUp") updates.value = value + step
    if (Object.keys(updates).length === 0) return

    event.preventDefault()
    setColor(updates)
  }

  return (
    <div
      aria-label="Color saturation and brightness"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(saturation)}
      aria-valuetext={`${Math.round(saturation)}% saturation, ${Math.round(value)}% brightness`}
      data-slot="color-picker-selection"
      role="slider"
      tabIndex={0}
      className={cn(
        "relative h-36 w-full touch-none cursor-crosshair rounded-md ring-1 ring-foreground/10 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      style={{
        background: [
          "linear-gradient(to top, rgb(0 0 0), transparent)",
          "linear-gradient(to right, rgb(255 255 255), transparent)",
          `hsl(${hue} 100% 50%)`,
        ].join(", "),
      }}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        updateFromPointer(event)
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          updateFromPointer(event)
        }
      }}
      {...props}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background ring-1 ring-foreground/70"
        style={{
          left: `${saturation}%`,
          top: `${100 - value}%`,
        }}
      />
    </div>
  )
})

function ColorPickerHue() {
  const { hue, setColor } = useColorPicker()

  return (
    <SliderPrimitive.Root
      aria-label="Color hue"
      className="relative flex h-4 w-full touch-none items-center select-none"
      data-slot="color-picker-hue"
      max={360}
      step={1}
      value={[hue]}
      onValueChange={([nextHue]) => setColor({ hue: nextHue })}
    >
      <SliderPrimitive.Track
        className="relative h-3 w-full grow rounded-full ring-1 ring-foreground/10"
        style={{
          background: "linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        <SliderPrimitive.Range className="absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full border-2 border-background bg-transparent ring-1 ring-foreground/60 outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/50" />
    </SliderPrimitive.Root>
  )
}

function ColorPickerControls() {
  return (
    <div className="flex items-center gap-2">
      <ColorPickerEyeDropper />
      <ColorPickerHexInput />
    </div>
  )
}

function ColorPickerEyeDropper() {
  const { hex, setHex } = useColorPicker()
  const nativeInputRef = useRef<HTMLInputElement>(null)
  const isSupported = typeof window !== "undefined" && "EyeDropper" in window

  const openNativeColorPicker = () => {
    const input = nativeInputRef.current
    if (!input) return

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker()
        return
      } catch {
        // Fall through to the broadly supported click path.
      }
    }

    input.click()
  }

  const handleEyeDropper = async () => {
    if (!isSupported) {
      openNativeColorPicker()
      return
    }

    type EyeDropperResult = { sRGBHex: string }
    type EyeDropperInstance = { open: () => Promise<EyeDropperResult> }
    type EyeDropperWindow = Window & {
      EyeDropper: new () => EyeDropperInstance
    }

    try {
      const EyeDropper = (window as unknown as EyeDropperWindow).EyeDropper
      const eyeDropper = new EyeDropper()
      const result = await eyeDropper.open()
      setHex(result.sRGBHex)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        openNativeColorPicker()
      }
    }
  }

  return (
    <>
      <Button
        aria-label="Pick a color from the screen"
        size="icon"
        title="Pick from screen"
        type="button"
        variant="outline"
        onClick={handleEyeDropper}
      >
        <IconColorPicker />
      </Button>
      <input
        ref={nativeInputRef}
        aria-hidden="true"
        className="sr-only"
        tabIndex={-1}
        type="color"
        value={hex}
        onChange={(event) => setHex(event.target.value)}
      />
    </>
  )
}

function ColorPickerHexInput() {
  const { hex, setHex } = useColorPicker()
  const [draft, setDraft] = useState(hex)
  const isInvalid = normalizeHexColor(draft) === null

  useEffect(() => {
    setDraft(hex)
  }, [hex])

  return (
    <InputGroup>
      <InputGroupAddon>
        <span
          aria-hidden="true"
          className="size-3.5 rounded-full ring-1 ring-foreground/10"
          style={{ backgroundColor: hex }}
        />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Hex color"
        aria-invalid={isInvalid || undefined}
        autoCapitalize="off"
        autoComplete="off"
        className="select-text font-mono tabular-nums"
        spellCheck={false}
        value={draft}
        onBlur={() => {
          if (isInvalid) setDraft(hex)
        }}
        onChange={(event) => {
          const nextValue = event.target.value
          const normalizedValue = normalizeHexColor(nextValue)
          setDraft(normalizedValue ?? nextValue)
          if (normalizedValue) setHex(normalizedValue)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !isInvalid) {
            setHex(draft)
          }
        }}
      />
    </InputGroup>
  )
}

function normalizePickerColor(color: HsvColor): HsvColor {
  return {
    hue: ((color.hue % 360) + 360) % 360,
    saturation: Math.min(100, Math.max(0, color.saturation)),
    value: Math.min(100, Math.max(0, color.value)),
  }
}

export {
  ColorPicker,
  ColorPickerControls,
  ColorPickerHue,
  ColorPickerSelection,
}
