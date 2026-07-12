import { useState, type ComponentType } from "react"
import { Link } from "@tanstack/react-router"
import {
  IconAlertTriangle,
  IconBrandTabler,
  IconCalendar,
  IconClick,
  IconComponents,
  IconEye,
  IconFileText,
  IconGripVertical,
  IconHash,
  IconLayoutSidebar,
  IconLink,
  IconMoon,
  IconPalette,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconSeparator,
  IconSun,
  IconTrash,
  IconVariable,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type ThemeMode = "light" | "dark"

type TokenRow = {
  base?: string
  dark: string
  description: string
  hex?: string
  light: string
  name: string
  token: string
}

type ComponentRow = {
  element: string
  owner: string
  preview: ComponentType
  tokens: string
  variants: string
}

const neutralSolids: TokenRow[] = [
  token("neutral-950", "#0A0A0A", "Base neutral solid", "App foreground / deepest neutral."),
  token("neutral-900", "#191919", "Base neutral solid", "Dark background and strong surfaces."),
  token("neutral-800", "#252525", "Base neutral solid", "Dark card, popover, secondary, and muted fills."),
  token("neutral-700", "#333333", "Base neutral solid", "Dark accent and active muted fills."),
  token("neutral-600", "#525252", "Base neutral solid", "Tertiary foreground in light mode."),
  token("neutral-500", "#737373", "Base neutral solid", "Muted foreground and ring in light mode."),
  token("neutral-400", "#999999", "Base neutral solid", "Muted foreground in dark mode."),
  token("neutral-300", "#C4C4C4", "Base neutral solid", "Available neutral step; not a primary semantic today."),
  token("neutral-200", "#E5E5E5", "Base neutral solid", "Available neutral step; alpha tokens now own borders and inputs."),
  token("neutral-100", "#F5F5F5", "Base neutral solid", "Light muted/secondary; dark foreground/primary."),
  token("neutral-50", "#FAFAFA", "Base neutral solid", "Light background/card/popover."),
]

const neutralAlphas: TokenRow[] = [
  alphaToken("neutral-alpha-A900", "40%", "#80808066"),
  alphaToken("neutral-alpha-A800", "30%", "#8080804D"),
  alphaToken("neutral-alpha-A700", "24%", "#8080803D"),
  alphaToken("neutral-alpha-A600", "20%", "#80808033"),
  alphaToken("neutral-alpha-A500", "16%", "#80808029"),
  alphaToken("neutral-alpha-A400", "12%", "#8080801F"),
  alphaToken("neutral-alpha-A300", "9%", "#80808017"),
  alphaToken("neutral-alpha-A200", "7%", "#80808012"),
  alphaToken("neutral-alpha-A100", "5%", "#8080800D"),
]

const shadSemanticTokens: TokenRow[] = [
  semantic("background", "white", "neutral-900", "Page and app canvas. Same role as old page-background."),
  semantic("foreground", "neutral-950", "neutral-100", "Default text and icon color."),
  semantic("card", "neutral-50", "neutral-800", "Card and framed content surface."),
  semantic("card-foreground", "neutral-950", "neutral-100", "Text inside cards."),
  semantic("popover", "white", "neutral-800", "Menus, dialogs, dropdowns, floating editor panels."),
  semantic("popover-foreground", "neutral-950", "neutral-100", "Text inside floating surfaces."),
  semantic("primary", "neutral-950", "neutral-100", "Primary action fill and checked controls."),
  semantic("primary-foreground", "neutral-50", "neutral-900", "Text/icons on primary fill."),
  semantic("secondary", "neutral-100", "neutral-800", "Secondary buttons and soft panels."),
  semantic("secondary-foreground", "neutral-800", "neutral-200", "Text/icons on secondary fill."),
  semantic("muted", "neutral-100", "neutral-800", "Muted fill, skeletons, low-emphasis backgrounds."),
  semantic("muted-foreground", "neutral-500", "neutral-400", "Secondary copy, placeholders, helper text, inactive tabs."),
  semantic("accent", "neutral-100", "neutral-700", "Hover and active menu/tab fills."),
  semantic("accent-foreground", "neutral-950", "neutral-50", "Text/icons on accent fill."),
  semantic("border", "neutral-alpha-A600", "neutral-alpha-A700", "Default border."),
  semantic("border-strong", "neutral-alpha-A700", "neutral-alpha-A900", "Higher-emphasis border for compact controls and stronger outlines."),
  semantic("border-subtle", "neutral-alpha-A500", "neutral-alpha-A400", "Quiet separators and low-emphasis dividers."),
  semantic("input", "neutral-alpha-A700", "neutral-alpha-A700", "Input border/fill and unchecked switch fill."),
  semantic("ring", "neutral-500", "neutral-400", "Focus rings and high-attention outlines."),
  semantic("destructive", "red-600", "red-300", "Delete, invalid, destructive state."),
  semantic("warning", "#FFC182", "#FFC182", "Warning status dot for unpublished changes."),
  semantic("success", "#ADDDC0", "#ADDDC0", "Success status dot for published state."),
]

const lightsiteTokens: TokenRow[] = [
  semantic("page-background", "background", "background", "Compatibility alias only. Background and page background are now the same."),
  semantic("tertiary-foreground", "neutral-600", "neutral-300", "Third-level labels, icons, sidebar secondary rows."),
  semantic("muted-faint", "neutral-400", "neutral-600", "Fainter block placeholder text."),
  semantic("selection-background", "#F7F9FF", "neutral-50 at 8%", "Selected editor blocks and selection fill."),
  semantic("selection-foreground", "selection-border", "selection-border", "Foreground for selected editor affordances and empty-state action snippets."),
  semantic("selection-border", "indigo-600", "indigo-300", "Selection border, drop lines, marquee edge."),
  semantic("variable-background", "#0588F01F", "#0588F04D", "Inline variable token fill."),
  semantic("variable-background-hover", "#0588F01F", "#0588F04D", "Variable hover/active fill."),
  semantic("variable-foreground", "#0797B9", "#A4E9F4", "Inline variable token text and variable menu icon color."),
  semantic("variable-border", "#0588F014", "#0588F029", "Variable chip/menu border."),
]

const sidebarTokens: TokenRow[] = [
  semantic("sidebar", "background", "background", "shadcn sidebar surface."),
  semantic("sidebar-foreground", "foreground", "foreground", "shadcn sidebar text."),
  semantic("sidebar-primary", "primary", "primary", "shadcn sidebar primary state."),
  semantic("sidebar-primary-foreground", "primary-foreground", "primary-foreground", "Text/icons on sidebar primary."),
  semantic("sidebar-accent", "accent", "accent", "shadcn sidebar hover/active row fill."),
  semantic("sidebar-accent-foreground", "accent-foreground", "accent-foreground", "Text/icons on sidebar accent."),
  semantic("sidebar-border", "border", "border", "shadcn sidebar border."),
  semantic("sidebar-ring", "ring", "ring", "shadcn sidebar focus ring."),
]

const legacyAliases: TokenRow[] = [
  semantic("editing-background", "selection-background", "selection-background", "Compatibility alias. Prefer selection-background."),
  semantic("editing-foreground", "neutral-300", "neutral-700", "Legacy passive editor affordance color. Avoid new use."),
  semantic("editing-foreground-hover", "neutral-500", "neutral-500", "Legacy editor hover affordance color. Prefer foreground/tertiary semantics."),
  semantic("lightsite-editor-*", "canonical aliases", "canonical aliases", "Compatibility aliases only. New CSS should use shadcn + selection + variable tokens directly."),
]

const primitiveInventory = [
  "Accordion",
  "Alert",
  "Alert Dialog",
  "Aspect Ratio",
  "Avatar",
  "Badge",
  "Breadcrumb",
  "Button",
  "Button Group",
  "Calendar",
  "Card",
  "Carousel",
  "Chart",
  "Checkbox",
  "Collapsible",
  "Combobox",
  "Command",
  "Context Menu",
  "Dialog",
  "Drawer",
  "Dropdown Menu",
  "Empty",
  "Field",
  "Hover Card",
  "Input",
  "Input Group",
  "Input OTP",
  "Item",
  "Kbd",
  "Label",
  "Menubar",
  "Native Select",
  "Navigation Menu",
  "Pagination",
  "Popover",
  "Progress",
  "Radio Group",
  "Resizable",
  "Scroll Area",
  "Select",
  "Separator",
  "Sheet",
  "Sidebar",
  "Skeleton",
  "Slider",
  "Sonner",
  "Spinner",
  "Switch",
  "Table",
  "Tabs",
  "Textarea",
  "Toggle",
  "Toggle Group",
  "Tooltip",
]

const sharedInventory = [
  "AppShell",
  "InternalRouteFrame",
  "LightsitePageFooter",
  "PageHeader",
  "StatusBadge",
]

const mainFeatureInventory = [
  "AuthPage",
  "OnboardingPage",
  "SitesPage",
  "CreateSiteDialog",
  "SettingsPage",
  "TeamPage",
  "TrackingPage",
  "PublicSitePage",
  "PublicSiteRenderer",
  "ComponentIndexPage",
  "DesignSystemPage",
  "PrimitiveGallery",
]

const editorInventory = [
  "EditorPage",
  "EditorCanvas",
  "EditorHeader",
  "BlockControls",
  "SiteSidebar",
  "SiteSettingsMenu",
  "RecipientShareDialog",
  "TextBubbleMenu",
  "ButtonSettingsPopover",
  "ImageCardButtonSettingsPopover",
  "VariableCreatePopover",
  "GifPickerDialog",
  "VideoEmbedSettingsMenu",
  "CalendarEmbedSettingsMenu",
  "PageEmptyState",
]

const editorNodeInventory = [
  "Paragraph",
  "Heading 1",
  "Heading 2",
  "Heading 3",
  "Bullet List",
  "Numbered List",
  "Task List",
  "Quote",
  "Divider",
  "Button Block",
  "Icon Bullet List",
  "Icon Card",
  "Image",
  "Image Card",
  "GIF",
  "Video Embed",
  "Calendar Embed",
  "Page Title",
  "Variable Token",
]

const primitiveRows: ComponentRow[] = [
  row("Button", "components/ui/button.tsx", "default, outline, dashed, secondary, editor, ghost, destructive, link; sizes default, xs, sm, lg, compact, icon variants", "primary, secondary, border, muted, accent, destructive, ring", ButtonPreview),
  row("Badge", "components/ui/badge.tsx", "default, secondary, destructive, outline, ghost, link", "primary, secondary, border, muted, destructive", BadgePreview),
  row("Tabs", "components/ui/tabs.tsx", "default, line; horizontal and vertical", "muted, background, foreground, muted-foreground, accent, border, ring", TabsPreview),
  row("Card", "components/ui/card.tsx", "default, sm; header/content/footer slots", "card, card-foreground, muted, border", CardPreview),
  row("Form controls", "components/ui/input, field, checkbox, radio, switch, textarea", "input, textarea, checkbox, radio, switch, field descriptions/errors", "input, background, foreground, muted-foreground, primary, ring, destructive", FormPreview),
  row("Navigation/Menu", "components/ui/dropdown-menu, popover, dialog, sheet, command, sidebar", "trigger, content, item, label, separator, destructive item", "popover, popover-foreground, accent, accent-foreground, border, ring", MenuPreview),
  row("Feedback", "components/ui/alert, empty, skeleton, spinner, progress", "default, destructive, loading, empty, progress", "card, muted, muted-foreground, primary, destructive", FeedbackPreview),
  row("Data display", "components/ui/table, avatar, item, chart", "table row/header, avatar sizes/group, item rows, chart wrappers", "background, foreground, muted, border, chart tokens", DataPreview),
]

const appRows: ComponentRow[] = [
  row("App shell", "components/layout/app-shell.tsx", "desktop sidebar, inset content, account/workspace rows", "background, sidebar, sidebar-accent, border", AppShellPreview),
  row("Route header", "components/common/page-header.tsx", "title, description, right actions", "background, foreground, muted-foreground, primary", RouteHeaderPreview),
  row("Sites table", "features/sites/sites-page.tsx", "row hover, status badge, action cells", "background, secondary, tertiary-foreground, border, badge tokens", SitesTablePreview),
  row("Tracking cards", "features/tracking/tracking-page.tsx", "metric cards, event rows, filters", "card, muted, border, foreground, chart tokens", TrackingPreview),
  row("Team/settings forms", "features/team + settings", "member rows, invite fields, setup fields", "card, input, muted-foreground, primary, destructive", SettingsPreview),
  row("Auth/onboarding", "features/auth + onboarding", "centered form card, logo row, setup states", "background, card, border, input, muted-foreground", AuthPreview),
]

const editorRows: ComponentRow[] = [
  row("Editor header", "features/editor/components/editor-header.tsx", "left title, publish status badge, edit/preview tabs, preview/share/publish actions", "background, foreground, muted-foreground, muted-faint, warning, success, border-strong, accent, primary", EditorHeaderPreview),
  row("Block side controls", "features/editor/components/block-controls.tsx", "plus, drag handle, block options menu trigger", "foreground, muted-foreground, accent, popover", BlockControlsPreview),
  row("Text blocks", "features/editor/tiptap/nodes", "paragraph, h1, h2, h3, bullets, numbers, task, quote, divider", "foreground, muted-foreground, border, selection-background", TextBlocksPreview),
  row("Card blocks", "features/editor/tiptap/nodes/block-views.tsx", "icon card, image card, testimonial, logo grid", "card, card-foreground, border, tertiary-foreground, variable tokens", EditorCardsPreview),
  row("Media blocks", "features/editor/tiptap/nodes", "image, gif, video embed, calendar embed, empty/upload states", "muted, border, ring, background, foreground", MediaPreview),
  row("Button block", "features/editor/tiptap/nodes/buttonBlock", "create/edit menu, link required, fill-width state", "primary, primary-foreground, border, popover, input", ButtonBlockPreview),
  row("Variables", "features/editor/tiptap/variables.ts", "name/company defaults, custom variables, create/edit menu", "variable-background, variable-foreground, variable-border", VariablePreview),
  row("Selection states", "features/editor/tiptap/extensions", "node selection, marquee, drop cursor, delete selected blocks", "selection-background, selection-foreground, selection-border, ring", SelectionPreview),
  row("Site sidebar", "features/editor/components/site-sidebar.tsx", "tabs/pages, links, next steps, mobile drawer", "background, border, tertiary-foreground, accent, primary", SiteSidebarPreview),
  row("Public preview", "features/public-site/public-site-renderer.tsx", "published-page equivalent of editor content", "background, foreground, border, primary, muted", PublicPreview),
]

export function DesignSystemAuditPage() {
  const [theme, setTheme] = useState<ThemeMode>("light")

  return (
    <div className={cn(theme, "min-h-dvh bg-background text-foreground")}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 p-6">
        <header className="flex flex-col gap-4 border-b pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-3xl flex-col gap-2">
              <Badge variant="secondary" className="w-fit">
                <IconPalette data-icon="inline-start" />
                System sheet
              </Badge>
              <h1 className="text-2xl font-semibold tracking-normal">Lightsite design system audit</h1>
              <p className="text-sm leading-6 text-muted-foreground">
                A visual inventory of the base neutral system, shadcn semantic tokens, Lightsite additions,
                main app patterns, and editor elements. This page intentionally renders everything through
                the same tokens so drift is easy to spot.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="compact"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <IconMoon data-icon="inline-start" /> : <IconSun data-icon="inline-start" />}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </Button>
              <Button variant="outline" size="compact" asChild>
                <Link to="/design-system">Baseline</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Stat label="Solid neutrals" value="11" detail="One canonical neutral scale" />
            <Stat label="Alpha neutrals" value="9" detail="All based on #808080" />
            <Stat label="Lightsite additions" value="11" detail="Selection + variables + status + extra text" />
            <Stat label="Editor color families" value="2" detail="Selection and variables only" />
          </div>
        </header>

        <Tabs defaultValue="tokens" className="gap-5">
          <TabsList className="flex-wrap rounded-full">
            <TabsTrigger value="tokens" className="rounded-full">Tokens</TabsTrigger>
            <TabsTrigger value="components" className="rounded-full">Components</TabsTrigger>
            <TabsTrigger value="app" className="rounded-full">Main app</TabsTrigger>
            <TabsTrigger value="editor" className="rounded-full">Editor</TabsTrigger>
            <TabsTrigger value="legacy" className="rounded-full">Legacy</TabsTrigger>
          </TabsList>

          <TabsContent value="tokens" className="flex flex-col gap-6">
            <SectionTitle icon={IconPalette} title="Base Tokens" description="Base tokens never describe product intent. They only provide the solid and alpha neutral palette." />
            <TokenGrid title="Neutral solids" rows={neutralSolids} kind="solid" />
            <TokenGrid title="Neutral alpha" rows={neutralAlphas} kind="alpha" />
            <SectionTitle icon={IconBrandTabler} title="Semantic Tokens" description="shadcn primitives continue to use the standard semantic contract. Those semantics now inherit from the base neutral scale." />
            <TokenTable rows={shadSemanticTokens} title="shadcn semantic tokens" />
            <TokenTable rows={sidebarTokens} title="shadcn sidebar tokens" />
            <TokenTable rows={lightsiteTokens} title="Lightsite semantic additions" />
          </TabsContent>

          <TabsContent value="components" className="flex flex-col gap-6">
            <SectionTitle icon={IconComponents} title="Primitive Components" description="The shadcn primitive layer and the variants currently used across the product." />
            <ComponentMatrix rows={primitiveRows} />
            <InventoryCard
              title="Installed primitives"
              description="Everything currently present in components/ui. These stay token-driven and product-agnostic."
              items={primitiveInventory}
            />
            <InventoryCard
              title="Shared composed components"
              description="Shared layout/common components that compose primitives into app-level patterns."
              items={sharedInventory}
            />
          </TabsContent>

          <TabsContent value="app" className="flex flex-col gap-6">
            <SectionTitle icon={IconLayoutSidebar} title="Main App Patterns" description="Composed product surfaces outside the editor." />
            <ComponentMatrix rows={appRows} />
            <InventoryCard
              title="Main app inventory"
              description="Route and feature components represented by the main app patterns above."
              items={mainFeatureInventory}
            />
          </TabsContent>

          <TabsContent value="editor" className="flex flex-col gap-6">
            <SectionTitle icon={IconFileText} title="Editor Elements" description="Tiptap content blocks and editor chrome. These should use normal shadcn semantics plus only selection and variable tokens." />
            <ComponentMatrix rows={editorRows} />
            <InventoryCard
              title="Editor component inventory"
              description="Editor shell, popovers, dialogs, menus, and composed controls."
              items={editorInventory}
            />
            <InventoryCard
              title="Tiptap node inventory"
              description="Document-owned nodes and inline tokens that should remain Tiptap-native."
              items={editorNodeInventory}
            />
          </TabsContent>

          <TabsContent value="legacy" className="flex flex-col gap-6">
            <SectionTitle icon={IconAlertTriangle} title="Legacy Aliases And Cleanup" description="Names kept for compatibility while we move toward one base system. They should not become new design decisions." />
            <TokenTable rows={legacyAliases} title="Compatibility aliases" />
            <Card>
              <CardHeader>
                <CardTitle>Cleanup rule</CardTitle>
                <CardDescription>New UI should not add raw neutral hexes, new editor-local color variables, or new one-off foreground/background mixes.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <RuleCard title="Use shadcn semantics" detail="Button, Card, Dialog, Popover, Tabs, inputs, tables, and menus stay on background/foreground/card/popover/primary/muted/accent/border/input/ring." />
                <RuleCard title="Use selection tokens" detail="Editor selected blocks, marquee, selected node borders, and drop cursor use selection-background and selection-border." />
                <RuleCard title="Use variable tokens" detail="Inline variable chips, variable menu icons, and variable hover states use variable-background, variable-foreground, variable-border." />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function token(name: string, hex: string, base: string, description: string): TokenRow {
  return { name, token: `--${name}`, hex, light: hex, dark: hex, base, description }
}

function alphaToken(name: string, opacity: string, hex: string): TokenRow {
  const cssName = name.toLowerCase()
  return {
    name,
    token: `--${cssName}`,
    hex,
    light: `#808080 / ${opacity}`,
    dark: `#808080 / ${opacity}`,
    base: "#808080",
    description: "Base alpha neutral.",
  }
}

function semantic(name: string, light: string, dark: string, description: string): TokenRow {
  return { name, token: `--${name}`, light, dark, description }
}

function row(
  element: string,
  owner: string,
  variants: string,
  tokens: string,
  preview: ComponentType,
): ComponentRow {
  return { element, owner, variants, tokens, preview }
}

function Stat({ detail, label, value }: { detail: string; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl leading-7 font-semibold">{value}</div>
        <div className="mt-1 text-sm font-medium">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  )
}

function SectionTitle({
  description,
  icon: Icon,
  title,
}: {
  description: string
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Icon className="size-4" />
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function TokenGrid({ kind, rows, title }: { kind: "solid" | "alpha"; rows: TokenRow[]; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{kind === "solid" ? "Fixed neutral colors." : "Alpha colors all based on #808080."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((tokenRow) => (
          <div key={tokenRow.name} className="overflow-hidden rounded-lg border bg-card">
            <div className="h-16 border-b" style={{ background: tokenRow.hex }} />
            <div className="grid gap-1 p-3">
              <div className="font-mono text-xs">{tokenRow.token}</div>
              <div className="text-sm font-medium">{tokenRow.name}</div>
              <div className="text-xs text-muted-foreground">{tokenRow.light}</div>
              <div className="text-xs text-muted-foreground">{tokenRow.description}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function TokenTable({ rows, title }: { rows: TokenRow[]; title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="border-b pb-2 font-medium">Token</th>
              <th className="border-b pb-2 font-medium">Light</th>
              <th className="border-b pb-2 font-medium">Dark</th>
              <th className="border-b pb-2 font-medium">Visual</th>
              <th className="border-b pb-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((rowData) => (
              <tr key={rowData.name}>
                <td className="border-b py-3 pr-4">
                  <div className="font-medium">{rowData.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{rowData.token}</div>
                </td>
                <td className="border-b py-3 pr-4 text-muted-foreground">{rowData.light}</td>
                <td className="border-b py-3 pr-4 text-muted-foreground">{rowData.dark}</td>
                <td className="border-b py-3 pr-4">
                  <SemanticTokenPreview token={rowData.name} />
                </td>
                <td className="border-b py-3 text-muted-foreground">{rowData.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function SemanticTokenPreview({ token }: { token: string }) {
  const cssToken = `var(--${token})`

  return (
    <div className="grid w-[180px] grid-cols-2 overflow-hidden rounded-lg border">
      <div className="light bg-background p-2">
        <div className="h-10 rounded-md border" style={{ background: cssToken, borderColor: cssToken }} />
        <div className="mt-1 text-[10px] text-muted-foreground">Light</div>
      </div>
      <div className="dark bg-background p-2">
        <div className="h-10 rounded-md border" style={{ background: cssToken, borderColor: cssToken }} />
        <div className="mt-1 text-[10px] text-muted-foreground">Dark</div>
      </div>
    </div>
  )
}

function ComponentMatrix({ rows }: { rows: ComponentRow[] }) {
  return (
    <div className="grid gap-4">
      {rows.map((item) => {
        const Preview = item.preview

        return (
          <Card key={item.element}>
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-xl border bg-background p-4">
                <Preview />
              </div>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold">{item.element}</div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">{item.owner}</div>
                  </div>
                  <Badge variant="outline">Component</Badge>
                </div>
                <InfoRow label="Variants / states" value={item.variants} />
                <InfoRow label="Color tokens" value={item.tokens} />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/25 p-3 md:grid-cols-[132px_minmax(0,1fr)]">
      <div className="text-xs font-medium text-tertiary-foreground">{label}</div>
      <div className="text-sm text-muted-foreground">{value}</div>
    </div>
  )
}

function RuleCard({ detail, title }: { detail: string; title: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  )
}

function InventoryCard({
  description,
  items,
  title,
}: {
  description: string
  items: string[]
  title: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary">
            {item}
          </Badge>
        ))}
      </CardContent>
    </Card>
  )
}

function ButtonPreview() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="compact"><IconPlus data-icon="inline-start" />Create</Button>
      <Button size="compact" variant="outline">Outline</Button>
      <Button size="compact" variant="dashed">Dashed</Button>
      <Button size="compact" variant="secondary">Secondary</Button>
      <Button size="compact" variant="ghost">Ghost</Button>
      <Button size="compact" variant="destructive"><IconTrash data-icon="inline-start" />Delete</Button>
      <Button size="icon-compact" variant="editor" aria-label="Search"><IconSearch data-icon="icon" /></Button>
    </div>
  )
}

function BadgePreview() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Published</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="outline">Local</Badge>
      <Badge variant="ghost">Ghost</Badge>
      <Badge variant="destructive">Delete</Badge>
    </div>
  )
}

function TabsPreview() {
  return (
    <Tabs defaultValue="edit" className="max-w-[280px]">
      <TabsList className="rounded-full">
        <TabsTrigger value="edit" className="rounded-full">Edit</TabsTrigger>
        <TabsTrigger value="preview" className="rounded-full">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="edit" className="rounded-lg border p-3 text-muted-foreground">Editable mode</TabsContent>
      <TabsContent value="preview" className="rounded-lg border p-3 text-muted-foreground">Preview mode</TabsContent>
    </Tabs>
  )
}

function CardPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Card title</CardTitle>
        <CardDescription>Card description uses muted foreground.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-12 rounded-lg border bg-muted" />
      </CardContent>
    </Card>
  )
}

function FormPreview() {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input placeholder="name@company.com" />
        <FieldDescription>Input, helper text, focus ring, and disabled states.</FieldDescription>
      </Field>
      <Field orientation="horizontal">
        <Switch defaultChecked />
        <FieldLabel>Include button</FieldLabel>
      </Field>
      <div className="flex items-center gap-3">
        <Checkbox defaultChecked />
        <RadioGroup defaultValue="one" className="w-fit">
          <RadioGroupItem value="one" />
        </RadioGroup>
      </div>
      <Textarea placeholder="Description" />
    </FieldGroup>
  )
}

function MenuPreview() {
  return (
    <div className="max-w-[280px] rounded-xl bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <div className="px-2 py-1 text-xs text-muted-foreground">Block menu</div>
      <MenuRow icon={IconFileText} label="Text" />
      <MenuRow icon={IconPhoto} label="Image card" />
      <MenuRow icon={IconVariable} label="Variable" />
      <Separator className="my-1" />
      <MenuRow icon={IconTrash} label="Delete" destructive />
    </div>
  )
}

function FeedbackPreview() {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border bg-card p-3">
        <div className="text-sm font-medium">Setup could not be loaded</div>
        <div className="mt-1 text-xs text-muted-foreground">Sign in to continue.</div>
      </div>
      <Skeleton className="h-8 w-full" />
      <Progress value={68} />
    </div>
  )
}

function DataPreview() {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 rounded-lg border text-sm">
        <div className="border-b bg-muted p-2 font-medium">Site</div>
        <div className="border-b bg-muted p-2 font-medium">Status</div>
        <div className="border-b bg-muted p-2 font-medium">Views</div>
        <div className="p-2">Acme</div>
        <div className="p-2 text-muted-foreground">Live</div>
        <div className="p-2 text-muted-foreground">128</div>
      </div>
      <AvatarGroup>
        <Avatar><AvatarFallback>BS</AvatarFallback></Avatar>
        <Avatar><AvatarFallback>MP</AvatarFallback></Avatar>
        <AvatarGroupCount>+2</AvatarGroupCount>
      </AvatarGroup>
    </div>
  )
}

function AppShellPreview() {
  return (
    <div className="grid h-48 grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-background">
      <aside className="border-r bg-sidebar p-2 text-sidebar-foreground">
        <img src="/lightsite-logo.svg" alt="" className="h-[17px] w-[83px]" />
        <div className="mt-4 grid gap-1">
          <div className="h-7 rounded-lg bg-sidebar-accent" />
          <div className="h-7 rounded-lg bg-transparent ring-1 ring-sidebar-border" />
        </div>
      </aside>
      <main className="bg-background p-3">
        <div className="h-8 rounded-lg border bg-card" />
        <div className="mt-3 grid gap-2">
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      </main>
    </div>
  )
}

function RouteHeaderPreview() {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">Sites</div>
          <div className="text-sm text-muted-foreground">Create and manage sales pages.</div>
        </div>
        <Button size="compact"><IconPlus data-icon="inline-start" />New</Button>
      </div>
      <Separator className="my-4" />
      <div className="grid gap-2">
        <div className="h-8 rounded-lg border bg-card" />
        <div className="h-8 rounded-lg border bg-card" />
      </div>
    </div>
  )
}

function SitesTablePreview() {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-[1fr_auto] bg-muted px-3 py-2 text-xs font-medium">
        <span>Site</span>
        <span>Status</span>
      </div>
      <div className="grid grid-cols-[1fr_auto] px-3 py-2">
        <span className="font-medium">Acme rollout</span>
        <Badge variant="secondary">Draft</Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto] border-t px-3 py-2 text-tertiary-foreground">
        <span>Northstar</span>
        <Badge>Live</Badge>
      </div>
    </div>
  )
}

function TrackingPreview() {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
        <div className="text-xs text-muted-foreground">Views</div>
        <div className="mt-1 text-2xl font-semibold">1,482</div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border p-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground"><IconEye className="size-4" /></div>
        <div className="min-w-0 text-sm">Recipient viewed page</div>
      </div>
    </div>
  )
}

function SettingsPreview() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Logo, slug, website, and team settings.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input defaultValue="lightsite" />
        <Button size="compact" className="w-fit">Save changes</Button>
      </CardContent>
    </Card>
  )
}

function AuthPreview() {
  return (
    <div className="rounded-xl border bg-card p-4">
      <img src="/lightsite-logo.svg" alt="" className="h-[17px] w-[83px]" />
      <div className="mt-5 text-base font-semibold">Set up your workspace</div>
      <div className="mt-1 text-sm text-muted-foreground">Use your work email to continue.</div>
      <Input className="mt-4" placeholder="you@company.com" />
    </div>
  )
}

function EditorHeaderPreview() {
  return (
    <div className="rounded-xl border bg-background">
      <div className="flex h-[46px] items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-medium">Acme rollout</div>
          <StatusDotBadge label="Unpublished changes" dotClassName="bg-warning" />
        </div>
        <Tabs defaultValue="edit" className="gap-0">
          <TabsList className="h-[30px] rounded-full">
            <TabsTrigger value="edit" className="rounded-full">Edit</TabsTrigger>
            <TabsTrigger value="preview" className="rounded-full">Preview</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="compact">Publish</Button>
      </div>
      <div className="flex flex-wrap gap-2 p-4 text-sm text-muted-foreground">
        <StatusDotBadge label="Published" dotClassName="bg-success" />
        <StatusDotBadge label="Unpublished" dotClassName="bg-muted-faint" />
      </div>
    </div>
  )
}

function StatusDotBadge({
  dotClassName,
  label,
}: {
  dotClassName: string
  label: string
}) {
  return (
    <Badge variant="outline" className="gap-1">
      <span aria-hidden="true" className={cn("size-[5px] rounded-full", dotClassName)} />
      {label}
    </Badge>
  )
}

function BlockControlsPreview() {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-xs" aria-label="Add"><IconPlus data-icon="icon" /></Button>
      <Button variant="ghost" size="icon-xs" aria-label="Move"><IconGripVertical data-icon="icon" /></Button>
      <div className="ml-2 h-10 flex-1 rounded-lg border bg-card" />
    </div>
  )
}

function TextBlocksPreview() {
  return (
    <div className="font-site">
      <h1 className="text-2xl leading-9 font-semibold">Heading 1</h1>
      <p className="mt-2 text-base leading-[26px] text-muted-foreground">Paragraph with inline <span className="rounded-md border px-1 font-mono text-[0.875em]">code</span>.</p>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <IconSeparator className="size-4 text-tertiary-foreground" />
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  )
}

function EditorCardsPreview() {
  return (
    <div className="grid gap-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="flex gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-tertiary-foreground"><IconClick className="size-5" /></div>
          <div>
            <div className="font-site text-base font-semibold">Title</div>
            <div className="text-sm text-tertiary-foreground">Description</div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-3">
        <div className="h-20 rounded-lg bg-muted" />
      </div>
    </div>
  )
}

function MediaPreview() {
  return (
    <div className="grid gap-3">
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed bg-muted text-sm text-muted-foreground">
        Drop image
      </div>
      <div className="rounded-xl border bg-card p-3">
        <IconCalendar className="size-5 text-tertiary-foreground" />
      </div>
    </div>
  )
}

function ButtonBlockPreview() {
  return (
    <div className="grid gap-3">
      <Button className="w-fit"><IconLink data-icon="inline-start" />Book a demo</Button>
      <div className="rounded-xl bg-popover p-3 text-popover-foreground ring-1 ring-foreground/10">
        <FieldGroup>
          <Field>
            <FieldLabel>Button text</FieldLabel>
            <Input defaultValue="Book a demo" />
          </Field>
        </FieldGroup>
      </div>
    </div>
  )
}

function VariablePreview() {
  return (
    <div className="grid gap-3">
      <p className="font-site text-base">Hi <span className="rounded-md border border-variable-border bg-variable-background px-1 font-medium text-variable-foreground">Name</span>,</p>
      <div className="rounded-xl bg-popover p-2 ring-1 ring-foreground/10">
        <MenuRow icon={IconVariable} label="Company" variable />
        <MenuRow icon={IconHash} label="Create variable" />
      </div>
    </div>
  )
}

function SelectionPreview() {
  return (
    <div className="grid gap-3">
      <div className="rounded-lg border border-selection-border bg-selection-background p-3 text-sm">Selected block</div>
      <div className="h-px bg-selection-border" />
      <div className="h-14 rounded-sm border border-selection-border bg-selection-background" />
    </div>
  )
}

function SiteSidebarPreview() {
  return (
    <div className="grid h-48 grid-cols-[112px_minmax(0,1fr)] overflow-hidden rounded-xl border">
      <aside className="border-r bg-background p-2">
        <div className="text-xs font-medium text-tertiary-foreground">Tabs</div>
        <div className="mt-2 rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground">Overview</div>
        <div className="mt-1 rounded-lg px-2 py-1 text-xs text-tertiary-foreground">Proof</div>
      </aside>
      <main className="p-3">
        <div className="h-5 w-28 rounded bg-foreground/10" />
        <div className="mt-3 h-20 rounded-lg bg-muted" />
      </main>
    </div>
  )
}

function PublicPreview() {
  return (
    <div className="rounded-xl border bg-background p-4 font-site">
      <div className="flex items-center gap-2 border-b pb-3">
        <Avatar size="sm"><AvatarFallback>L</AvatarFallback></Avatar>
        <div className="text-sm font-semibold">AR bottlenecks</div>
      </div>
      <h2 className="mt-5 text-2xl font-semibold">AR bottlenecks</h2>
      <p className="mt-3 text-base text-tertiary-foreground">So you deal with AR?</p>
    </div>
  )
}

function MenuRow({
  destructive,
  icon: Icon,
  label,
  variable,
}: {
  destructive?: boolean
  icon: ComponentType<{ className?: string }>
  label: string
  variable?: boolean
}) {
  return (
    <div
      className={cn(
        "flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm",
        destructive ? "text-destructive" : "text-popover-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      <Icon className={cn("size-4", variable ? "text-variable-foreground" : "text-tertiary-foreground")} />
      <span>{label}</span>
    </div>
  )
}
