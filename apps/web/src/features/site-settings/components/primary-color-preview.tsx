import { IconNotes } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import type {
  PrimaryColorPreviewStyle,
  PrimaryColorPreviewStyles,
} from "./primary-color-preview-style"

type PrimaryColorPreviewProps = {
  className?: string
} & (
  | {
      mode: "light" | "dark"
      style: PrimaryColorPreviewStyle
      styles?: never
    }
  | {
      mode: "split"
      style?: never
      styles: PrimaryColorPreviewStyles
    }
)

export function PrimaryColorPreview(props: PrimaryColorPreviewProps) {
  if (props.mode === "split") {
    return (
      <Card className={cn("h-40 gap-0 rounded-lg py-0", props.className)}>
        <PrimaryColorPreviewRow mode="light" style={props.styles.light} />
        <Separator />
        <PrimaryColorPreviewRow mode="dark" style={props.styles.dark} />
      </Card>
    )
  }

  return (
    <Card className={cn("h-20 gap-0 rounded-lg py-0", props.className)}>
      <PrimaryColorPreviewRow mode={props.mode} style={props.style} />
    </Card>
  )
}

function PrimaryColorPreviewRow({
  mode,
  style,
}: {
  mode: "light" | "dark"
  style: PrimaryColorPreviewStyle
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 items-center justify-center gap-3",
        mode === "light" ? "bg-white-white!" : "bg-neutral-900",
      )}
      style={{ ...style, colorScheme: mode }}
    >
      <Button tabIndex={-1}>Button</Button>
      <Tabs className="block" value="active">
        <TabsList className="h-8 bg-transparent p-0" variant="line">
          <TabsTrigger
            className="pointer-events-none h-8 flex-none gap-2 rounded-md border-0 bg-[var(--primary-background-subtle)]! px-2! py-0 text-base leading-5 font-normal tracking-[-0.03em] text-primary shadow-none after:hidden data-[state=active]:bg-[var(--primary-background-subtle)]! data-[state=active]:text-primary dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-[var(--primary-background-subtle)]! dark:data-[state=active]:text-primary"
            tabIndex={-1}
            value="active"
          >
            <IconNotes data-icon="inline-start" />
            Tab
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
