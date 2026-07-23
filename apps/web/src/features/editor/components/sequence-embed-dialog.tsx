import { useState, type ReactNode } from "react"
import type { SiteVariableDefinition } from "@handout/site-document"
import {
  IconArrowLeft,
  IconArrowRight,
  IconBraces,
  IconCheck,
  IconCopy,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getPublicSiteOrigin } from "@/lib/public-site-url"
import { cn } from "@/lib/utils"
import apolloTutorialUrl from "../../../../../../docs/tutorials/outreach-platforms/embed-handout-in-apollo.mp4"
import instantlyTutorialUrl from "../../../../../../docs/tutorials/outreach-platforms/embed-handout-in-instantly.mp4"
import findVariablesTutorialUrl from "../../../../../../docs/tutorials/outreach-platforms/find-platform-variables.mp4"
import {
  OUTREACH_PLATFORMS,
  areSequenceVariableMappingsComplete,
  createSequenceEmbedHtml,
  createSequenceVariableMappings,
  getOutreachPlatform,
  getSequenceVariableLabel,
  type OutreachPlatformId,
  type SequenceVariableMappings,
} from "../lib/sequence-embed"
import { ProviderIcon, SequenceProviderStack } from "./sequence-provider-icons"

type SequenceEmbedStep = "intro" | 1 | 2 | 3

type SequenceEmbedDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
  publicId: string
  variables: SiteVariableDefinition[]
}

export function SequenceEmbedDialog({
  onOpenChange,
  open,
  publicId,
  variables,
}: SequenceEmbedDialogProps) {
  const [step, setStep] = useState<SequenceEmbedStep>("intro")
  const [platformId, setPlatformId] = useState<OutreachPlatformId>("apollo")
  const [mappings, setMappings] = useState<SequenceVariableMappings>(() => (
    createSequenceVariableMappings("apollo", variables)
  ))

  const closeAndReset = () => {
    setStep("intro")
    setPlatformId("apollo")
    setMappings(createSequenceVariableMappings("apollo", variables))
    onOpenChange(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      closeAndReset()
      return
    }

    onOpenChange(true)
  }

  const selectPlatform = (value: string) => {
    const nextPlatformId = value as OutreachPlatformId
    setPlatformId(nextPlatformId)
    setMappings(createSequenceVariableMappings(nextPlatformId, variables))
  }

  const copyEmbed = async () => {
    try {
      const html = createSequenceEmbedHtml({
        mappings,
        publicId,
        publicOrigin: getPublicSiteOrigin(),
        variables,
      })
      await navigator.clipboard.writeText(html)
      toast.success("Embed code copied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Embed code could not be copied")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        aria-describedby="sequence-embed-description"
        className={cn(
          "block w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-xl p-0 shadow-md",
          step === "intro" || step === 1
            ? "max-w-[365px] sm:max-w-[365px]"
            : "max-w-[400px] sm:max-w-[400px]"
        )}
      >
        <DialogTitle className="sr-only">
          Magic sequence embed {step === "intro" ? "" : `— Step ${step}`}
        </DialogTitle>
        <DialogDescription id="sequence-embed-description" className="sr-only">
          Create a personalized Handout embed for an outreach sequence.
        </DialogDescription>

        {step === "intro" ? (
          <SequenceEmbedIntro onBegin={() => setStep(1)} />
        ) : null}
        {step === 1 ? (
          <SequenceEmbedPlatformStep
            platformId={platformId}
            onNext={() => setStep(2)}
            onPlatformChange={selectPlatform}
          />
        ) : null}
        {step === 2 ? (
          <SequenceEmbedMappingStep
            mappings={mappings}
            onMappingsChange={setMappings}
            onNext={() => setStep(3)}
            onPrevious={() => setStep(1)}
            platformId={platformId}
            variables={variables}
          />
        ) : null}
        {step === 3 ? (
          <SequenceEmbedCopyStep
            onCopy={() => void copyEmbed()}
            onDone={closeAndReset}
            onPrevious={() => setStep(2)}
            platformId={platformId}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function SequenceEmbedIntro({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex flex-col gap-2.5 px-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex h-6 items-center">
            <SequenceProviderStack />
          </div>
          <h2 className="text-base leading-6 font-medium">Magic sequence embed</h2>
        </div>
        <div className="flex flex-col gap-5 text-sm leading-5 text-secondary-foreground">
          <p>Handout can automatically create personalized versions of your site for recipients when you send them outreach.</p>
          <p>This happens on-demand when you send through your sequencing tool. No manual recipient creation needed.</p>
          <p>Click begin to start the guided setup.</p>
        </div>
      </div>
      <Button className="w-full" size="compact" onClick={onBegin}>Begin</Button>
    </div>
  )
}

function SequenceEmbedPlatformStep({
  onNext,
  onPlatformChange,
  platformId,
}: {
  onNext: () => void
  onPlatformChange: (value: string) => void
  platformId: OutreachPlatformId
}) {
  const platform = getOutreachPlatform(platformId)

  return (
    <SequenceStepShell step={1}>
      <div className="flex flex-col gap-2">
        <p className="pl-1 text-sm leading-5 font-medium">Select your outreach platform</p>
        <Select value={platformId} onValueChange={onPlatformChange}>
          <SelectTrigger className="w-full" aria-label="Outreach platform">
            <SelectValue>
              <ProviderIcon platformId={platform.id} />
              <span>{platform.label}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)]" position="popper" align="start">
            <SelectGroup>
              {OUTREACH_PLATFORMS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <ProviderIcon platformId={option.id} />
                  <span>{option.label}</span>
                  {option.id === "other" ? (
                    <span className="text-xs text-muted-foreground">(works with any tool)</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <Button className="w-full" size="compact" onClick={onNext}>
        Next step
        <IconArrowRight data-icon="inline-end" />
      </Button>
    </SequenceStepShell>
  )
}

function SequenceEmbedMappingStep({
  mappings,
  onMappingsChange,
  onNext,
  onPrevious,
  platformId,
  variables,
}: {
  mappings: SequenceVariableMappings
  onMappingsChange: (mappings: SequenceVariableMappings) => void
  onNext: () => void
  onPrevious: () => void
  platformId: OutreachPlatformId
  variables: SiteVariableDefinition[]
}) {
  const platform = getOutreachPlatform(platformId)
  const complete = areSequenceVariableMappingsComplete(variables, mappings)
  const instructions = platformId === "other"
    ? "Map your Handout variables to the variables in your sequencing tool."
    : `Map your Handout variables to your ${platform.label} variables.`

  return (
    <SequenceStepShell step={2}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 px-1">
          <p className="text-sm leading-5 font-medium">{instructions}</p>
          <VariableHelpCard />
        </div>
        <ScrollArea className="max-h-[min(294px,calc(100svh-240px))] rounded-xl border border-border">
          <FieldGroup className="gap-3 p-3">
            {variables.map((variable) => (
              <Field
                className="grid grid-cols-[minmax(0,1fr)_12px_172px] items-center gap-4"
                key={variable.id}
                orientation="horizontal"
              >
                <FieldLabel
                  className="min-w-0 gap-1 text-cyan-foreground"
                  htmlFor={`sequence-variable-${variable.id}`}
                >
                  <IconBraces className="size-3.5 shrink-0" />
                  <span className="truncate">{getSequenceVariableLabel(variable)}</span>
                </FieldLabel>
                <span aria-hidden="true" className="text-center text-sm text-muted-foreground">=</span>
                <Input
                  aria-label={`${getSequenceVariableLabel(variable)} outreach variable`}
                  id={`sequence-variable-${variable.id}`}
                  onChange={(event) => onMappingsChange({
                    ...mappings,
                    [variable.id]: event.target.value,
                  })}
                  placeholder="{{example}}"
                  value={mappings[variable.id] ?? ""}
                />
              </Field>
            ))}
          </FieldGroup>
        </ScrollArea>
      </div>
      <SequenceStepFooter
        nextDisabled={!complete}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    </SequenceStepShell>
  )
}

function SequenceEmbedCopyStep({
  onCopy,
  onDone,
  onPrevious,
  platformId,
}: {
  onCopy: () => void
  onDone: () => void
  onPrevious: () => void
  platformId: OutreachPlatformId
}) {
  const tutorialUrl = platformId === "instantly" ? instantlyTutorialUrl : apolloTutorialUrl

  return (
    <SequenceStepShell step={3}>
      <div className="flex flex-col gap-4">
        <p className="px-1 text-sm leading-5 font-medium">
          Copy and paste the embed code into the HTML of the email template, then preview the result.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button className="w-full" size="compact" variant="outline" onClick={onCopy}>
            <IconCopy data-icon="inline-start" />
            Copy embed code
          </Button>
          <video
            aria-label={`How to embed a Handout in ${getOutreachPlatform(platformId).label}`}
            className="h-[284px] w-full rounded-lg border border-border object-cover"
            controls
            playsInline
            preload="metadata"
            src={tutorialUrl}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" size="compact" variant="outline" onClick={onPrevious}>
          <IconArrowLeft data-icon="inline-start" />
          Previous
        </Button>
        <Button className="flex-1" size="compact" onClick={onDone}>
          <IconCheck data-icon="inline-start" />
          Done
        </Button>
      </div>
    </SequenceStepShell>
  )
}

function SequenceStepShell({
  children,
  step,
}: {
  children: ReactNode
  step: 1 | 2 | 3
}) {
  return (
    <div className="flex flex-col gap-4 p-3">
      <Badge variant="secondary">Step {step}</Badge>
      {children}
    </div>
  )
}

function SequenceStepFooter({
  nextDisabled,
  onNext,
  onPrevious,
}: {
  nextDisabled?: boolean
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <div className="flex gap-2">
      <Button className="flex-1" size="compact" variant="outline" onClick={onPrevious}>
        <IconArrowLeft data-icon="inline-start" />
        Previous
      </Button>
      <Button className="flex-1" disabled={nextDisabled} size="compact" onClick={onNext}>
        Next step
        <IconArrowRight data-icon="inline-end" />
      </Button>
    </div>
  )
}

function VariableHelpCard() {
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button className="w-fit cursor-help text-xs leading-4 text-muted-foreground underline underline-offset-2" type="button">
          How do I find these?
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-[350px] max-w-[calc(100vw-2rem)] rounded-xl p-3" side="left">
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm leading-5 font-medium">
            How to find variables in your sequencing tool
          </p>
          <div className="flex flex-col gap-2.5">
            <video
              aria-label="How to find variables in an outreach platform"
              className="h-[183px] w-full rounded-lg border border-border object-cover"
              controls
              playsInline
              preload="metadata"
              src={findVariablesTutorialUrl}
            />
            <ol className="flex list-none flex-col gap-3 rounded-lg border border-border p-3 text-sm leading-5">
              <li className="grid grid-cols-[16px_1fr] gap-2"><span className="text-muted-foreground">1.</span><span>Insert the variables into an email</span></li>
              <li className="grid grid-cols-[16px_1fr] gap-2"><span className="text-muted-foreground">2.</span><span>View the email’s HTML or code</span></li>
              <li className="grid grid-cols-[16px_1fr] gap-2"><span className="text-muted-foreground">3.</span><span>Locate the {"{{variables}}"} in the HTML</span></li>
            </ol>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
