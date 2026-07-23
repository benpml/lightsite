import {
  IconCodeAsterisk,
  IconDotsVertical,
  IconPalette,
  IconScanPosition,
  IconX,
} from "@tabler/icons-react"
import type { ReactNode, SetStateAction } from "react"
import type { WorkspacePlan } from "@handout/contracts"
import type { SiteContent, SiteVariableDefinition } from "@handout/site-document"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { AppearanceSettings } from "./appearance-settings"
import { TrackingSettings } from "./tracking-settings"
import { VariablesSettings } from "./variables-settings"

type VariableInput = Pick<SiteVariableDefinition, "defaultValue" | "description" | "label">

export type SiteSettingsDrawerProps = {
  canManageTracking: boolean
  content: SiteContent
  onChange: (content: SetStateAction<SiteContent>) => void
  onCreateVariable: (input: VariableInput) => void
  onDeleteVariable: (variableId: string) => void
  onEditVariable: (variableId: string, input: VariableInput) => void
  plan: WorkspacePlan
  siteId: string
  siteName: string
  usageCounts: Readonly<Record<string, number>>
  variables: SiteVariableDefinition[]
  workspaceId: string
  loading?: boolean
  onOpenChange?: (open: boolean) => void
  open?: boolean
  trigger?: ReactNode
}

export function SiteSettingsDrawer({
  canManageTracking,
  content,
  onChange,
  onCreateVariable,
  onDeleteVariable,
  onEditVariable,
  plan,
  siteId,
  siteName,
  usageCounts,
  variables,
  workspaceId,
  loading = false,
  onOpenChange,
  open,
  trigger,
}: SiteSettingsDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {trigger === null ? null : (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="icon-compact" aria-label="Site settings" title="Site settings">
              <IconDotsVertical />
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent
        aria-describedby={undefined}
        className="inset-y-1.5! right-1.5! h-[calc(100%-12px)]! w-[384px] max-w-[calc(100vw-12px)] gap-1 overflow-hidden rounded-2xl bg-background px-0 pt-2 pb-4 sm:max-w-[384px]"
        overlayClassName="bg-black/20 backdrop-blur-none"
        showCloseButton={false}
      >
        <SheetHeader className="flex h-8 shrink-0 flex-row items-center justify-between rounded-sm px-[22px]">
          <SheetTitle className="text-sm leading-5">Site settings</SheetTitle>
          <SheetClose asChild>
            <Button className="-mr-1.5" variant="ghost" size="icon-field" aria-label="Close site settings">
              <IconX />
            </Button>
          </SheetClose>
        </SheetHeader>
        {loading ? (
          <SiteSettingsLoadingState />
        ) : (
          <Tabs defaultValue="appearance" className="min-h-0 flex-1 gap-0">
            <TabsList variant="line" className="mx-4 h-[42px]! w-auto shrink-0 justify-start gap-2 border-b border-border-subtle p-0">
              <TabsTrigger value="appearance" className="h-full! flex-none -translate-y-0.5 px-1 after:bottom-[-3px]! after:h-px! [&_svg:not([class*='size-'])]:size-3.5">
                <IconPalette data-icon="inline-start" />
                Appearance
              </TabsTrigger>
              <TabsTrigger value="tracking" className="h-full! flex-none -translate-y-0.5 px-1 after:bottom-[-3px]! after:h-px! [&_svg:not([class*='size-'])]:size-3.5">
                <IconScanPosition data-icon="inline-start" />
                Tracking
              </TabsTrigger>
              <TabsTrigger value="variables" className="h-full! flex-none -translate-y-0.5 px-1 after:bottom-[-3px]! after:h-px! [&_svg:not([class*='size-'])]:size-3.5">
                <IconCodeAsterisk data-icon="inline-start" />
                Variables
              </TabsTrigger>
            </TabsList>
            <SettingsTab value="appearance">
              <AppearanceSettings
                content={content}
                onChange={onChange}
                siteName={siteName}
                variables={variables}
              />
            </SettingsTab>
            <SettingsTab value="tracking">
              <TrackingSettings
                canManage={canManageTracking}
                content={content}
                onChange={onChange}
                plan={plan}
                siteId={siteId}
                workspaceId={workspaceId}
              />
            </SettingsTab>
            <SettingsTab value="variables">
              <VariablesSettings
                onCreate={onCreateVariable}
                onDelete={onDeleteVariable}
                onEdit={onEditVariable}
                usageCounts={usageCounts}
                variables={variables}
              />
            </SettingsTab>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SiteSettingsLoadingState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4" aria-busy="true" aria-label="Loading site settings">
      <div className="flex h-[42px] items-center gap-2 border-b border-border-subtle">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="flex flex-col gap-5 px-px">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

function SettingsTab({ children, value }: { children: ReactNode; value: string }) {
  return (
    <TabsContent value={value} className="min-h-0">
      <ScrollArea className="h-full">
        <div className="px-4 pt-5">{children}</div>
      </ScrollArea>
    </TabsContent>
  )
}
