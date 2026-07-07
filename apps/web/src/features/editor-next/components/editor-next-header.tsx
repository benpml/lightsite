import { Link } from "@tanstack/react-router"
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronLeft,
  IconLink,
  IconMoon,
  IconSun,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { EditorNextSiteSettingsMenu } from "./site-settings-menu"
import type { EditorNextMode, EditorNextTheme, EditorNextThemeMode } from "../types"

type EditorNextHeaderProps = {
  canRedo: boolean
  canUndo: boolean
  isDirty: boolean
  isDeletingSite: boolean
  isDuplicatingSite: boolean
  isRenamingSite: boolean
  mode: EditorNextMode
  onDeleteSite: () => Promise<void>
  onDuplicateSite: () => Promise<void>
  onModeChange: (mode: EditorNextMode) => void
  onRedo: () => void
  onRenameSite: (name: string) => Promise<void>
  onShare: () => void
  onThemeModeChange: (mode: EditorNextThemeMode) => void
  onToggleTheme: () => void
  onUndo: () => void
  siteName: string
  theme: EditorNextTheme
  themeMode: EditorNextThemeMode
}

export function EditorNextHeader({
  canRedo,
  canUndo,
  isDirty,
  isDeletingSite,
  isDuplicatingSite,
  isRenamingSite,
  mode,
  onDeleteSite,
  onDuplicateSite,
  onModeChange,
  onRedo,
  onRenameSite,
  onShare,
  onThemeModeChange,
  onToggleTheme,
  onUndo,
  siteName,
  theme,
  themeMode,
}: EditorNextHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-[46px] shrink-0 items-center border-b border-border bg-background text-foreground">
      <div className="relative flex h-[30px] w-full items-center px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-compact"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            asChild
            aria-label="Back to sites"
          >
            <Link to="/sites">
              <IconChevronLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="truncate text-sm leading-5 font-medium tracking-normal text-foreground/80">
                {siteName}
              </h1>
            </div>
            <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
              {isDirty ? "Local draft" : "Ready"}
            </span>
          </div>
        </div>

        <div className="pointer-events-none absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
          <EditorModeTabs mode={mode} onModeChange={onModeChange} />
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <EditorHistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
          />
          <Button
            variant="ghost"
            size="icon-compact"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </Button>
          <Button variant="outline" size="compact" onClick={onShare}>
            <IconLink data-icon="inline-start" />
            Share
          </Button>
          <Button size="compact">Publish</Button>
          <EditorNextSiteSettingsMenu
            isDeletingSite={isDeletingSite}
            isDuplicatingSite={isDuplicatingSite}
            isRenamingSite={isRenamingSite}
            onDeleteSite={onDeleteSite}
            onDuplicateSite={onDuplicateSite}
            onRenameSite={onRenameSite}
            onThemeModeChange={onThemeModeChange}
            siteName={siteName}
            themeMode={themeMode}
          />
        </div>
      </div>
    </header>
  )
}

function EditorModeTabs({
  mode,
  onModeChange,
}: {
  mode: EditorNextMode
  onModeChange: (mode: EditorNextMode) => void
}) {
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => onModeChange(value as EditorNextMode)}
      className="pointer-events-auto flex-none gap-0"
      aria-label="Editor mode"
    >
      <TabsList className="h-[30px] rounded-full p-0.5">
        <TabsTrigger
          value="edit"
          className="h-[26px] w-[68px] flex-none rounded-full px-2 py-1 text-sm leading-5 font-medium data-[state=active]:shadow-sm"
        >
          Edit
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          className="h-[26px] w-[68px] flex-none rounded-full px-2 py-1 text-sm leading-5 font-medium data-[state=active]:shadow-sm"
        >
          Preview
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

function EditorHistoryControls({
  canRedo,
  canUndo,
  onRedo,
  onUndo,
}: {
  canRedo: boolean
  canUndo: boolean
  onRedo: () => void
  onUndo: () => void
}) {
  return (
    <TooltipProvider>
      <div className="hidden items-center gap-0.5 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Undo"
              disabled={!canUndo}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={onUndo}
            >
              <IconArrowBackUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-compact"
              aria-label="Redo"
              disabled={!canRedo}
              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={onRedo}
            >
              <IconArrowForwardUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
