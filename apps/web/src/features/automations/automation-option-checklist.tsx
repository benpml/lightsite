import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"

export function AutomationOptionChecklist({ options, selected, onChange, empty, loading = false, error = false, onRetry }: { options: Array<{ id: string; label: string; secondaryLabel: string | null }>; selected: string[]; onChange: (ids: string[]) => void; empty: string; loading?: boolean; error?: boolean; onRetry?: () => void }) {
  if (loading) return <FieldDescription>Loading choices…</FieldDescription>
  if (error) return <div className="flex items-center gap-2"><FieldDescription>Choices couldn’t load.</FieldDescription><Button type="button" variant="outline" size="xs" onClick={onRetry}>Retry</Button></div>
  if (!options.length) return <FieldDescription>{empty}</FieldDescription>
  return <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border p-2">
    {options.map((option) => <FieldLabel key={option.id} className="w-full">
      <Field orientation="horizontal">
        <Checkbox checked={selected.includes(option.id)} onCheckedChange={(checked) => onChange(checked ? [...selected, option.id] : selected.filter((id) => id !== option.id))} />
        <span className="min-w-0 truncate">{option.label}{option.secondaryLabel ? <span className="ml-1 text-muted-foreground">· {option.secondaryLabel}</span> : null}</span>
      </Field>
    </FieldLabel>)}
  </div>
}
