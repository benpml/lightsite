import { IconPhoto } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatVariableToken, type EditorVariable } from "../editor-data"
import { VariableChip } from "./editor-atoms"

export function VariableInputCard({
  onChange,
  variable,
  value,
}: {
  onChange: (value: string) => void
  variable: EditorVariable
  value: string
}) {
  const imagePreview = value || variable.defaultValue

  return (
    <div className="rounded-xl border bg-background p-2">
      <div className="mb-2 flex items-center gap-2">
        <VariableChip>{formatVariableToken(variable)}</VariableChip>
        <Badge variant="outline" className="ml-auto">
          {variable.type}
        </Badge>
      </div>
      {variable.type === "text" ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={variable.defaultValue || "Use default value"}
        />
      ) : variable.type === "url" ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={variable.defaultValue || "https://example.com"}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={variable.defaultValue || "https://example.com/logo.png"}
          />
          <div className="flex h-[96px] items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 text-muted-foreground">
            {imagePreview ? (
              <img src={imagePreview} alt="" className="h-auto max-h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <IconPhoto />
                <span className="text-sm">Uses default image when empty</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
