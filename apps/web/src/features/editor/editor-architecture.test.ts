import { readFileSync } from "node:fs"

import {
  SITE_DOCUMENT_CSS,
  SITE_DOCUMENT_IFRAME_SANDBOX,
} from "@handout/site-document"
import { describe, expect, it } from "vitest"

import { createBlockContent } from "./tiptap/extensions/block-commands"
import { createAddedPageEmptyContent, createFirstPageEmptyContent } from "./tiptap/schema"

const forbiddenImports = [
  ["@", "features", "editor-next"].join("/"),
  ["..", "editor-next"].join("/"),
  ["features", "editor-next"].join("/"),
  ["components", "editor-block-controls"].join("/"),
  ["tiptap", "editor-blocks"].join("/"),
  ["tiptap", "editor-nodes"].join("/"),
  ["tiptap", "command-menu"].join("/"),
]
const editorModules = import.meta.glob("./**/*.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
})
const stylesheetSource = readFileSync(new URL("../../index.css", import.meta.url), "utf8")
const editorCanvasModuleSource = readFileSync(
  new URL("./components/editor-canvas.tsx", import.meta.url),
  "utf8",
)
const sharedInputSource = readFileSync(
  new URL("../../components/ui/input.tsx", import.meta.url),
  "utf8",
)
const sharedInputGroupSource = readFileSync(
  new URL("../../components/ui/input-group.tsx", import.meta.url),
  "utf8",
)
const sharedTextareaSource = readFileSync(
  new URL("../../components/ui/textarea.tsx", import.meta.url),
  "utf8",
)
const appearanceSettingsSource = readFileSync(
  new URL("../site-settings/components/appearance-settings.tsx", import.meta.url),
  "utf8",
)
const internalRouteFrameSource = readFileSync(
  new URL("../../components/layout/internal-route-frame.tsx", import.meta.url),
  "utf8",
)
const siteSettingsModelSource = readFileSync(
  new URL("../site-settings/model.ts", import.meta.url),
  "utf8",
)
const variablesSettingsSource = readFileSync(
  new URL("../site-settings/components/variables-settings.tsx", import.meta.url),
  "utf8",
)
const sharedSiteExtensionSource = readFileSync(
  new URL("../../../../../packages/site-document/src/tiptap/site-extensions.ts", import.meta.url),
  "utf8",
)
const primaryColorSource = readFileSync(
  new URL("../../../../../packages/site-document/src/primary-color.ts", import.meta.url),
  "utf8",
)
const colorPickerMenuSource = readFileSync(
  new URL("../../components/common/color-picker-menu.tsx", import.meta.url),
  "utf8",
)

describe("editor architecture", () => {
  it("does not define a second theme or private published-site tokens", () => {
    expect(stylesheetSource).not.toMatch(/(^|\n):root(?:,|\s*\{)/)
    expect(stylesheetSource).not.toContain("--handout-primary")
    expect(stylesheetSource).not.toContain("  .handout-editor-image-card {\n")
    expect(stylesheetSource).not.toContain("  .handout-editor-testimonial-card {\n")
    expect(stylesheetSource).not.toContain("  .handout-editor-page-title-shell {\n")
    expect(stylesheetSource).not.toContain("  .handout-editor-card-content :where(h1, h2) {\n")
    expect(stylesheetSource).not.toContain(".handout-tiptap strong")
    expect(stylesheetSource).not.toContain("span {\n    @apply m-0;\n    font: inherit;")
    expect(stylesheetSource).not.toContain("leading-9 font-semibold tracking-normal")
    expect(stylesheetSource).not.toMatch(/color-mix\([^\n]*var\(--variable-/)
    expect(stylesheetSource).toContain("background: var(--variable-background);")
    expect(stylesheetSource).toContain("border-color: var(--variable-border);")
    expect(stylesheetSource).toContain("color: var(--variable-foreground);")
    expect(stylesheetSource).toContain("rounded-md border px-1 align-baseline")
    expect(stylesheetSource).toContain(
      "--handout-editor-icon-color: var(--color-purple-foreground);"
    )
    expect(stylesheetSource).toMatch(
      /\.handout-editor-page-title-shell\[data-align="center"\][\s\S]{0,300}\[data-handout-page-title-heading\],[\s\S]{0,200}\[data-handout-page-title-subtitle\][\s\S]{0,200}float: none;[\s\S]{0,100}text-align: center;/,
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ":where(html[data-handout-public-site],body[data-handout-public-site],.handout-site,.handout-document-editor,.handout-editor-sidebar-content),:where(.handout-site,.handout-document-editor,.handout-editor-sidebar-content) *{font-feature-settings:normal;font-kerning:normal;font-optical-sizing:auto;font-synthesis-weight:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(".handout-image-card{display:grid")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-icon-card{padding:16px;border:1px solid var(--site-card-border);border-radius:14px;background:var(--site-card-background)"
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-grid-cell,.handout-document-editor .handout-grid-cell{min-width:0;padding:0;border:0;background:transparent;box-shadow:none}"
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      "--handout-icon-color:var(--color-purple-foreground,var(--purple-foreground));--handout-icon-background:var(--color-purple-background-subtle,var(--purple-background-subtle))"
    )
    expect(SITE_DOCUMENT_CSS).toContain(".handout-testimonial{display:grid")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-page-title{display:flex")
    expect(SITE_DOCUMENT_CSS).toContain("gap:24px;padding:0 0 36px")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-page-title-subtitle,[data-handout-page-title-subtitle]")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-document-editor .tableWrapper>table")
    expect(stylesheetSource).toContain(
      ".handout-editor .ProseMirror > .collaboration-carets__caret.ProseMirror-widget",
    )
    expect(stylesheetSource).not.toContain(".react-renderer.node-iconCard + .react-renderer.node-iconCard")
  })

  it("uses the canonical site stylesheet and only invalidates preview content for document changes", () => {
    const canvasSource = editorModules["./components/editor-canvas.tsx"] as string
    const pageSource = editorModules["./editor-page.tsx"] as string

    expect(canvasSource).toContain('SITE_DOCUMENT_CSS')
    expect(canvasSource).toContain('data-handout-site-document-styles')
    expect(pageSource).toContain('class: "handout-editor-prosemirror handout-prosemirror"')
    expect(pageSource).toContain('syncVariables(transaction.docChanged)')
    expect(pageSource).not.toContain('editorProps: {\n      attributes:')
  })

  it("keeps icon picker menus inside the viewport", () => {
    const blockViewsSource = editorModules["./tiptap/nodes/block-views.tsx"] as string
    const iconPickerStyles = stylesheetSource.slice(
      stylesheetSource.indexOf(".handout-editor-icon-picker {"),
      stylesheetSource.indexOf(".handout-editor-icon-color-button {")
    )

    expect(blockViewsSource).toContain("useFloatingEditorPopoverPosition")
    expect(blockViewsSource).toContain("fallbackHeight: iconPickerHeight")
    expect(blockViewsSource).toContain("fallbackWidth: iconPickerWidth")
    expect(blockViewsSource).toContain("maxHeight: position.maxHeight")
    expect(blockViewsSource).toContain('visibility: "hidden"')
    expect(blockViewsSource).toContain("data-icon-color={iconColor}")
    expect(blockViewsSource).toContain("ColorPickerMenu")
    expect(blockViewsSource).toContain("ColorSpectrumSwatch")
    expect(blockViewsSource).toContain("getSiteIconColorVariables")
    expect(blockViewsSource).toContain("customColorSelected")
    expect(blockViewsSource).toContain('aria-label="Custom color"')
    expect(blockViewsSource).toContain('<ColorPickerMenu\n          align="center"')
    expect(colorPickerMenuSource).toContain("<Popover open={open} onOpenChange={setOpen}>")
    expect(colorPickerMenuSource).toContain('<PopoverHeader className="gap-0">')
    expect(colorPickerMenuSource).toContain(
      "onMouseDown={(event) => event.stopPropagation()}",
    )
    expect(colorPickerMenuSource).toContain('onClick={() => setOpen(false)}')
    expect(colorPickerMenuSource).toContain("Done")
    expect(stylesheetSource).toContain(
      "color: var(--handout-editor-icon-color, var(--tertiary-foreground))",
    )
    expect(stylesheetSource).toContain(
      "background: var(--handout-icon-background, var(--accent))",
    )
    expect(iconPickerStyles).toContain("@apply fixed")
    expect(iconPickerStyles).toContain("min-h-0")
    expect(iconPickerStyles).not.toContain("@apply absolute")
    expect(iconPickerStyles).not.toContain("handout-editor-icon-picker-card")
    expect(blockViewsSource).not.toContain("handout-editor-icon-picker-card")
  })

  it("keeps the edit sidebar and published-site sidebar in visual parity", () => {
    const sidebarSource = editorModules["./components/site-sidebar.tsx"] as string
    const previewSource = editorModules["./components/site-preview.tsx"] as string
    const pageSource = editorModules["./editor-page.tsx"] as string
    const variablesSource = editorModules["./tiptap/variables.ts"] as string

    expect(sidebarSource).toContain('data-[side=left]:w-[min(289px,86vw)]')
    expect(sidebarSource).toContain('className="handout-editor-sidebar-content flex min-w-0 w-full flex-col gap-6"')
    expect(sidebarSource).toContain("handout-editor-sidebar-desktop")
    expect(sidebarSource).toContain("BuiltWithHandoutFooter")
    expect(sidebarSource.match(/isEditing \? null : <BuiltWithHandoutFooter \/>/g)).toHaveLength(1)
    expect(sidebarSource).toContain("isEditing ? null : (")
    expect(sidebarSource).toContain('/handout-logo-icon.svg')
    expect(sidebarSource).toContain('href="https://www.handout.link"')
    expect(sidebarSource).not.toContain("border-r border-border-subtle")
    expect(sidebarSource).not.toContain("border-r border-border bg-background")
    expect(sidebarSource).not.toContain("border-r border-transparent")
    expect(sidebarSource).toContain("handout-editor-mobile-bar")
    expect(sidebarSource).not.toContain("md:w-[241px]")
    expect(sidebarSource).toContain("props.model.pages.length > 0")
    expect(sidebarSource).toContain('text-base leading-6 font-medium text-tertiary-foreground')
    expect(sidebarSource).toContain("IconNotes")
    expect(sidebarSource).not.toContain("IconFileText")
    expect(sidebarSource).toContain("style={popoverStyle}")
    expect(sidebarSource).toContain('bg-[var(--handout-primary)] px-4 text-sm font-medium text-[var(--handout-primary-foreground)]')
    expect(variablesSource).toContain('recipient_website: ""')
    expect(variablesSource).not.toContain('recipient_website: "linear.app"')
    expect(previewSource).toContain("renderPublicSitePreviewHtml")
    expect(previewSource).toContain("SITE_DOCUMENT_IFRAME_SANDBOX")
    expect(previewSource).not.toContain('sandbox="allow-popups allow-scripts"')
    expect(SITE_DOCUMENT_IFRAME_SANDBOX).toBe("allow-popups allow-same-origin allow-scripts")
    expect(sidebarSource).toContain("handout-editor-sidebar-section-title")
    expect(sidebarSource).not.toContain("tracking-normal")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-section>h2,.handout-editor-sidebar-section-title{height:26px;min-width:0;margin:0 0 0 4px;overflow:hidden;color:var(--foreground);font-size:14px;font-weight:500;letter-spacing:-.02em")
    expect(sidebarSource).toContain('sectionKey === "nextSteps" ? "gap-2.5" : "gap-2"')
    expect(sidebarSource).toContain("IconWorldLongitude")
    expect(sidebarSource).toContain('text-[var(--handout-sidebar-link-icon)]')
    expect(pageSource).toContain("getSitePrimaryColorVariables")
    expect(primaryColorSource).toContain('"--handout-sidebar-link-icon": "var(--blue-foreground,var(--link))"')
    expect(primaryColorSource).toContain('"--handout-sidebar-link-icon": `var(--${color}-foreground,var(--link))`')
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-inner{display:flex;width:241px;min-height:0;flex:1;flex-direction:column;gap:24px;overflow-y:auto}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar{position:sticky;top:0;display:flex;width:289px;height:100svh;flex:none;flex-direction:column;gap:24px;padding:26px 24px 20px;background:var(--background)")
    expect(SITE_DOCUMENT_CSS).not.toContain("padding:26px 24px;border-right")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-built-with{display:flex;width:100%;flex:none;align-items:center;justify-content:center;gap:6px;color:var(--tertiary-foreground);font-size:14px")
    expect(SITE_DOCUMENT_CSS).toContain('-webkit-mask:url("/handout-logo-icon.svg") center/contain no-repeat')
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-section-buttons{gap:10px}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab,.handout-sidebar-link{color:var(--tertiary-foreground)}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-link:hover,.handout-sidebar-link:focus-visible{color:var(--foreground)}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-link svg{color:var(--handout-sidebar-link-icon,var(--blue-foreground))}")
    expect(sidebarSource).toContain('active ? "text-[var(--handout-primary)]" : "text-muted-foreground"')
    expect(SITE_DOCUMENT_CSS).toContain(".handout-tab svg{color:var(--muted-foreground)}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-row.is-active svg{color:inherit}")
    expect(SITE_DOCUMENT_CSS).toContain(".handout-sidebar-mobile-title{min-width:0;flex:1;overflow:hidden;color:var(--tertiary-foreground);font-size:16px;font-weight:500")
    expect(SITE_DOCUMENT_CSS).toContain("--handout-primary")
  })

  it("migrates legacy inline editor images before publishing", () => {
    const pageSource = editorModules["./editor-page.tsx"] as string
    const imageUtilsSource = editorModules["./tiptap/image-utils.ts"] as string

    expect(pageSource).toContain("await legacyInlineImageMigrationRef.current")
    expect(pageSource).toContain("migrateLegacyInlineImages(activeEditor, activeWorkspace.id)")
    expect(pageSource).toContain('src.startsWith("data:image/")')
    expect(pageSource).toContain('setMeta("handoutLegacyImageMigration", true)')
    expect(pageSource).toContain('setMeta("addToHistory", false)')
    expect(imageUtilsSource).toContain("export async function uploadEmbeddedImageDataUrl")
  })

  it("places the editor loading sidebar on the left", () => {
    expect(internalRouteFrameSource).toContain(
      "grid-cols-[303px_minmax(0,1fr)]",
    )
    expect(internalRouteFrameSource).not.toContain(
      "grid-cols-[minmax(0,1fr)_303px]",
    )
  })

  it("offers sidebar button icons without icon color controls", () => {
    const sidebarSource = editorModules["./components/site-sidebar.tsx"] as string

    expect(sidebarSource).toContain("ButtonIconSelector")
    expect(sidebarSource).toContain("InputTrigger")
    expect(sidebarSource).toContain("<Popover open={open} onOpenChange={setOpen}>")
    expect(sidebarSource).toContain("<PopoverTrigger asChild>")
    expect(sidebarSource).toContain("SITE_ICON_OPTIONS")
    expect(sidebarSource).toContain('aria-label="Button icons"')
    expect(sidebarSource).toContain('className="grid grid-cols-8 gap-1"')
    expect(sidebarSource).toContain("data-button-icon-menu-footer")
    expect(sidebarSource).toContain("<Separator />")
    expect(sidebarSource).toContain('size={15}')
    expect(sidebarSource).toContain("gap-1.5")
    expect(sidebarSource).toContain('selectedOption?.label ?? "No icon"')
    expect(sidebarSource).not.toContain('<IconX className="size-[15px] shrink-0 text-muted-foreground" />')
    expect(sidebarSource).not.toContain("SITE_ICON_COLOR_OPTIONS")
    expect(sharedInputSource).toContain('data-slot="input-trigger"')
    expect(sharedInputSource).toContain("inputVariants({ size })")
  })

  it("owns form-control shadows in the shared input primitives", () => {
    expect(sharedInputSource).toContain("text-base shadow-xs")
    expect(sharedInputGroupSource).toContain("border border-input shadow-xs")
    expect(sharedTextareaSource).toContain("text-base shadow-xs")
  })

  it("provides md, lg, and xl sizes through the shared input primitives", () => {
    expect(sharedInputSource).toContain('md: "h-8"')
    expect(sharedInputSource).toContain('lg: "h-9"')
    expect(sharedInputSource).toContain('xl: "h-[38px]"')
    expect(sharedInputSource).toContain('size: "md"')
    expect(sharedInputGroupSource).toContain('md: "h-8"')
    expect(sharedInputGroupSource).toContain('lg: "h-9"')
    expect(sharedInputGroupSource).toContain('xl: "h-[38px]"')
    expect(sharedInputGroupSource).toContain('size: "md"')
    expect(sharedInputGroupSource).toContain('"h-full flex-1')
    expect(sharedInputGroupSource).toContain(
      'querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")'
    )
    expect(appearanceSettingsSource).toContain('size={multiline ? "md" : "lg"}')
    expect(appearanceSettingsSource).not.toContain('"h-9"')
  })

  it("keeps light theme mode previews white in every editor theme", () => {
    expect(appearanceSettingsSource.match(/bg-white-white/g)).toHaveLength(2)
    expect(appearanceSettingsSource).not.toContain(
      'border-neutral-200 bg-neutral-50 text-neutral-900',
    )
  })

  it("composes editor menu fields from canonical form primitives", () => {
    const buttonSettingsSource =
      editorModules["./components/button-settings-popover.tsx"] as string
    const imageCardButtonSettingsSource =
      editorModules["./components/image-card-button-settings-popover.tsx"] as string
    const videoSettingsSource =
      editorModules["./components/video-embed-settings-menu.tsx"] as string
    const calendarSettingsSource =
      editorModules["./components/calendar-embed-settings-menu.tsx"] as string
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"] as string
    const blockViewsSource =
      editorModules["./tiptap/nodes/block-views.tsx"] as string
    const variableCreateSource =
      editorModules["./components/variable-create-popover.tsx"] as string
    const variableTokenSource =
      editorModules["./tiptap/nodes/variable-token-view.tsx"] as string
    const linkMenuSource =
      editorModules["./components/text-bubble-menu.tsx"] as string
    const sidebarSource =
      editorModules["./components/site-sidebar.tsx"] as string

    expect(buttonSettingsSource).toContain("<FieldGroup")
    expect(buttonSettingsSource).toContain("<InputGroup size=\"lg\">")
    expect(buttonSettingsSource).not.toContain("<input")
    expect(imageCardButtonSettingsSource).toContain("<FieldGroup")
    expect(imageCardButtonSettingsSource).not.toContain("<input")
    expect(videoSettingsSource).toContain("<InputGroupTextarea")
    expect(videoSettingsSource).not.toContain("<textarea")
    expect(calendarSettingsSource).toContain("<InputGroupTextarea")
    expect(calendarSettingsSource).not.toContain("<textarea")
    expect(blockControlsSource).not.toContain("handout-editor-block-menu-url-input")
    expect(blockViewsSource).toContain("<InputGroup size=\"lg\">")
    expect(blockViewsSource).not.toContain("handout-editor-logo-grid-domain-control")
    expect(variableCreateSource).not.toContain("handout-editor-variable-control")
    expect(variableTokenSource).not.toContain("handout-editor-variable-control")
    expect(linkMenuSource).not.toContain("handout-editor-link-panel-field")
    expect(sidebarSource).not.toContain('className="pl-8"')
    expect(stylesheetSource).not.toMatch(
      /handout-editor-(button-settings-field|logo-grid-domain-control|block-menu-url-input|variable-control|link-panel-field)/,
    )
  })

  it("locks recipient identity variable names while keeping their details editable", () => {
    const variableTokenSource =
      editorModules["./tiptap/nodes/variable-token-view.tsx"] as string
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"] as string

    expect(variableTokenSource).toContain(
      "RESERVED_SITE_VARIABLE_IDS.has(variableId)",
    )
    expect(variableTokenSource).toContain("systemVariable ? null")
    expect(variableTokenSource.match(/disabled=\{systemVariable\}/g)).toHaveLength(2)
    expect(variableTokenSource).toContain(
      "disabled={!draft.name.trim()}",
    )
    expect(suggestionMenuSource).toContain(
      "const systemVariable = RESERVED_SITE_VARIABLE_IDS.has(variableId)",
    )
    expect(suggestionMenuSource).toContain(
      "systemVariable || attrs.name === undefined",
    )
    expect(siteSettingsModelSource).toContain(
      "SYSTEM_SITE_VARIABLE_IDS = RESERVED_SITE_VARIABLE_IDS",
    )
    expect(variablesSettingsSource).toContain('onEdit={scope === "site"')
    expect(variablesSettingsSource).toContain("disabled={nameLocked}")
  })

  it("keeps tabs, links, and buttons independently sortable in the sidebar", () => {
    const sidebarSource = editorModules["./components/site-sidebar.tsx"] as string
    const pageSource = editorModules["./editor-page.tsx"] as string
    const sidebarModelSource = editorModules["./site-sidebar-model.ts"] as string
    const blockControlsSource = editorModules["./components/block-controls.tsx"] as string

    expect(sidebarSource).toContain("function SortableSidebarList")
    expect(sidebarSource).toContain("function SortableSidebarPageList")
    expect(sidebarSource).toContain("function SortableSidebarLinkList")
    expect(sidebarSource).toContain("function SortableSidebarButtonList")
    expect(sidebarSource).toContain('itemKind="tab"')
    expect(sidebarSource).toContain('itemKind="link"')
    expect(sidebarSource).toContain('itemKind="button"')
    expect(sidebarSource).toContain("pages.length > 1")
    expect(sidebarSource).toContain("links.length > 1")
    expect(sidebarSource).toContain("buttons.length > 1")
    expect(sidebarSource).toContain("sortableKeyboardCoordinates")
    expect(sidebarSource).toContain("activationConstraint: { distance: 6 }")
    expect(sidebarSource).toContain("data-sidebar-sortable-kind")
    expect(sidebarSource).toContain("group-hover/sidebar-sortable:opacity-70")
    expect(sidebarSource).toContain("IconGripVertical")
    expect(blockControlsSource).toContain("IconGripVertical")
    expect(sidebarSource).toContain("function SidebarItemHoverActions")
    expect(sidebarSource).toContain("function SidebarItemDeleteConfirmation")
    expect(sidebarSource).toContain("group-hover/sidebar-item:opacity-100")
    expect(sidebarSource).toContain("group-focus-within/sidebar-item:opacity-100")
    expect(sidebarSource).toContain("group-hover/sidebar-item:pr-[62px]")
    expect(sidebarSource).toContain("group-focus-within/sidebar-item:pr-[62px]")
    expect(sidebarSource).toContain("group-hover/sidebar-item:px-[62px]")
    expect(sidebarSource).toContain("group-focus-within/sidebar-item:px-[62px]")
    expect(sidebarSource).not.toContain("rounded-lg px-2.5 pr-[62px]")
    expect(sidebarSource).not.toContain("rounded-[10px] px-[62px]")
    expect(sidebarSource).toContain("min-w-0 flex-1 truncate")
    expect(sidebarSource).toContain(
      '<TooltipContent side="top">Edit {itemKind}</TooltipContent>'
    )
    expect(sidebarSource).toContain(
      '<TooltipContent side="top">Delete {itemKind}</TooltipContent>'
    )
    expect(sidebarSource).toContain(
      'tooltipLabel={showTriggerTooltip === false || link ? undefined : "Add link"}'
    )
    expect(sidebarSource).toContain(
      'tooltipLabel={showTriggerTooltip === false || button ? undefined : "Add button"}'
    )
    expect(pageSource).toContain("reorderSidebarPages")
    expect(pageSource).toContain("reorderSidebarLinks")
    expect(pageSource).toContain("reorderSidebarButtons")
    expect(sidebarModelSource).toContain("function reorderSidebarItems")
  })

  it("previews sidebar item edits live and closes valid edits with Done or Enter", () => {
    const sidebarSource = editorModules["./components/site-sidebar.tsx"] as string

    expect(sidebarSource).toContain("onRenamePage(page.id, nextName)")
    expect(sidebarSource).toContain("updateLiveItem")
    expect(sidebarSource).toContain("onSave(originalValueRef.current)")
    expect(sidebarSource).toContain('className="flex gap-1.5"')
    expect(sidebarSource).toContain('<Button type="submit" disabled={!draftName.trim()}>Done</Button>')
    expect(sidebarSource).toContain('<Button type="submit" disabled={!isValid}>')
    expect(sidebarSource).toContain('{isEditing ? "Done" : "Save"}')
  })

  it("creates icon cards with explicit Tiptap title and body nodes", () => {
    expect(createBlockContent("iconCard")).toMatchObject({
      type: "iconCard",
      content: [
        { type: "iconCardTitle" },
        { type: "iconCardBody" },
      ],
    })
  })

  it("creates image cards with explicit Tiptap title and body nodes", () => {
    expect(createBlockContent("imageCard")).toMatchObject({
      type: "imageCard",
      attrs: {
        buttonLabel: "Learn more",
        buttonUrl: "",
        imageHeight: null,
        imageWidth: null,
        includeButton: false,
        src: "",
      },
      content: [
        { type: "imageCardTitle" },
        { type: "imageCardBody" },
      ],
    })
  })

  it("creates testimonial cards with explicit Tiptap author and quote nodes", () => {
    expect(createBlockContent("testimonial")).toMatchObject({
      type: "testimonialCard",
      attrs: {
        alt: "",
        avatarHeight: null,
        avatarWidth: null,
        src: "",
      },
      content: [
        { type: "testimonialAuthorName" },
        { type: "testimonialAuthorRole" },
        { type: "testimonialQuote" },
      ],
    })
  })

  it("creates logo grids with editable Tiptap logo title nodes", () => {
    expect(createBlockContent("logoGrid")).toMatchObject({
      type: "logoGrid",
      content: [
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
        {
          type: "logoGridItem",
          attrs: {
            alt: "",
            src: "",
          },
          content: [{ type: "logoGridItemTitle" }],
        },
      ],
    })
  })

  it("creates page title sections with explicit Tiptap title and subtitle nodes", () => {
    expect(createBlockContent("pageTitle")).toMatchObject({
      type: "pageTitleSection",
      attrs: {
        align: "center",
      },
      content: [
        { type: "pageTitleTitle" },
        { type: "pageTitleSubtitle" },
      ],
    })
  })

  it("keeps page empty-state guide copy outside the Tiptap document", () => {
    const firstPageBody = JSON.stringify(createFirstPageEmptyContent())
    const addedPageBody = JSON.stringify(createAddedPageEmptyContent())
    const canvasSource = editorModules["./components/editor-canvas.tsx"]
    const emptyStateSource = editorModules["./components/page-empty-state.tsx"]
    const emptyStateModelSource =
      editorModules["./components/page-empty-state-model.ts"]
    const schemaSource = editorModules["./tiptap/schema.ts"]

    expect(firstPageBody).toContain('"paragraph"')
    expect(firstPageBody).not.toContain("pageTitleSection")
    expect(firstPageBody).not.toContain("Sites work like a doc.")
    expect(firstPageBody).not.toContain("Start from a template:")
    expect(addedPageBody).toContain('"paragraph"')
    expect(addedPageBody).not.toContain('"heading"')
    expect(addedPageBody).not.toContain("Sites work like a doc.")
    expect(schemaSource).not.toContain("Sites work like a doc.")
    expect(canvasSource).toContain("EditorPageEmptyState")
    expect(canvasSource).toContain("currentEditor && !currentEditor.isDestroyed")
    expect(emptyStateSource).toContain("Sites work like a doc.")
    expect(emptyStateSource).toContain("Start from a template:")
    expect(emptyStateModelSource).toContain("getEditorEmptyStateScaffold")
    expect(emptyStateModelSource).toContain("hasEditorBodyBlocksAfterScaffold")
    expect(emptyStateModelSource).toContain("createEditorEmptyStateTitleNodes")
    expect(emptyStateModelSource).toContain('kind, "Call recap"')
    expect(emptyStateModelSource).toContain('kind, "Product overview"')
    expect(emptyStateModelSource).not.toContain("doc.childCount !== 1")
  })

  it("keeps card placeholder text out of the Tiptap document content", () => {
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"] as string
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]

    expect(blockCommandsSource).toContain('{ type: "imageCardTitle" }')
    expect(blockCommandsSource).toContain('{ type: "imageCardBody" }')
    expect(blockCommandsSource).toContain('{ type: "iconCardTitle" }')
    expect(blockCommandsSource).toContain('{ type: "iconCardBody" }')
    expect(blockCommandsSource).toContain('{ type: "testimonialAuthorName" }')
    expect(blockCommandsSource).toContain('{ type: "testimonialAuthorRole" }')
    expect(blockCommandsSource).toContain('{ type: "testimonialQuote" }')
    expect(blockCommandsSource).toContain('{ type: "logoGridItemTitle" }')
    expect(blockCommandsSource).toContain('{ type: "pageTitleTitle" }')
    expect(blockCommandsSource).toContain('{ type: "pageTitleSubtitle" }')
    expect(blockCommandsSource).not.toContain('text: "Title"')
    expect(blockCommandsSource).not.toContain('text: "Description"')
    expect(blockCommandsSource).not.toContain('text: "Name"')
    expect(blockCommandsSource).not.toContain('text: "Role"')
    expect(blockCommandsSource).not.toContain('text: "Quote"')
    expect(extensionSource).toContain("emptyNodeClass")
    expect(extensionSource).toContain("isAlwaysVisiblePlaceholderNode")
    expect(extensionSource).toContain("handout-editor-card-placeholder-empty")
    expect(extensionSource).toContain('node.type.name === "buttonBlock"')
    expect(extensionSource).not.toContain('return "Button"')
    expect(extensionSource).toContain("includeChildren: true")
    expect(extensionSource).toContain("showOnlyWhenEditable: false")
  })

  it("creates grids as native Tiptap row and cell content", () => {
    expect(createBlockContent("grid")).toMatchObject({
      type: "gridBlock",
      attrs: {
        columns: 2,
      },
      content: [
        {
          type: "gridRow",
          content: [
            {
              type: "gridCell",
              content: [{ type: "paragraph" }],
            },
            {
              type: "gridCell",
              content: [{ type: "paragraph" }],
            },
          ],
        },
      ],
    })
  })

  it("creates tables with native Tiptap table rows and cells", () => {
    expect(createBlockContent("table")).toMatchObject({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [{ type: "paragraph" }] },
            { type: "tableHeader", content: [{ type: "paragraph" }] },
            { type: "tableHeader", content: [{ type: "paragraph" }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph" }] },
            { type: "tableCell", content: [{ type: "paragraph" }] },
            { type: "tableCell", content: [{ type: "paragraph" }] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [{ type: "paragraph" }] },
            { type: "tableCell", content: [{ type: "paragraph" }] },
            { type: "tableCell", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    })
  })

  it("creates calendar embeds as configured Tiptap iframe atom nodes", () => {
    expect(createBlockContent("calendar")).toMatchObject({
      type: "calendarEmbed",
      attrs: {
        src: "",
      },
    })
  })

  it("creates video embeds as configured Tiptap iframe atom nodes", () => {
    expect(createBlockContent("video")).toMatchObject({
      type: "videoEmbed",
      attrs: {
        provider: "",
        src: "",
      },
    })
  })

  it("keeps tables on the official Tiptap TableKit path", () => {
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]

    expect(schemaSource).toContain('"table"')
    expect(extensionSource).toContain("@tiptap/extension-table")
    expect(extensionSource).toContain("TableKit.configure")
    expect(extensionSource).toContain("allowTableNodeSelection: true")
    expect(extensionSource).toContain("resizable: true")
    expect(blockCommandsSource).toContain('case "table"')
    expect(blockCommandsSource).toContain("createTableBlockContent")
    expect(blockCommandsSource).toContain('type: "tableRow"')
    expect(blockCommandsSource).toContain('type: "tableHeader"')
    expect(blockCommandsSource).toContain('type: "tableCell"')
    expect(blockCommandsSource).toContain('blockType === "table"')
    expect(suggestionMenuSource).toContain('id: "table"')
    expect(suggestionMenuSource).toContain("IconTable")
    expect(blockControlsSource).toContain('node.type.name === "table"')
    expect(blockControlsSource).toContain("menuTableCellPosition")
    expect(blockControlsSource).toContain("findActiveTableCellTextSelectionPosition")
    expect(blockControlsSource).toContain("resolveTableCommandPosition")
    expect(blockControlsSource).toContain("findFirstTextSelectionPositionInTarget")
    expect(blockControlsSource).toContain("addRowBefore")
    expect(blockControlsSource).toContain("addColumnAfter")
    expect(blockControlsSource).toContain("toggleHeaderRow")
    expect(blockControlsSource).toContain("toggleHeaderColumn")
    expect(blockControlsSource).toContain("getTableHeaderState")
    expect(blockControlsSource).toContain("Include header row")
    expect(blockControlsSource).toContain("Remove header row")
    expect(blockControlsSource).toContain("Include header column")
    expect(blockControlsSource).toContain("Remove header column")
    expect(blockControlsSource).toContain("IconLayoutNavbar")
    expect(blockControlsSource).toContain("IconLayoutSidebar")
    expect(blockControlsSource).not.toContain("Merge or split cells")
    expect(blockControlsSource).not.toContain("mergeOrSplit")
    expect(blockControlsSource).toContain("Delete current row")
    expect(blockControlsSource).toContain("Delete current column")
    expect(blockControlsSource).toContain("deleteTable")
    expect(stylesheetSource).toContain(".tableWrapper")
    expect(stylesheetSource).toContain(".handout-editor-table")
    expect(stylesheetSource).toContain(".selectedCell")
    expect(stylesheetSource).toContain(".column-resize-handle")
    expect(extensionSource).toContain("isTableCellParagraph")
    expect(extensionSource).toContain("Type here")
  })

  it("keeps grid behavior in Tiptap schema, commands, and menus", () => {
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const gridCommandsSource =
      editorModules["./tiptap/extensions/grid-commands.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    expect(schemaSource).toContain('"grid"')
    expect(schemaSource).toContain("siteDocumentUniqueIdNodeTypes")
    expect(sharedSiteExtensionSource).toContain('name: "gridBlock"')
    expect(sharedSiteExtensionSource).toContain('content: "gridRow+"')
    expect(sharedSiteExtensionSource).toContain('name: "gridRow"')
    expect(sharedSiteExtensionSource).toContain('content: "gridCell+"')
    expect(sharedSiteExtensionSource).toContain('name: "gridCell"')
    expect(sharedSiteExtensionSource).toContain('content: "block+"')
    expect(extensionSource).toContain("GridCell")
    expect(extensionSource).toContain("GridRow")
    expect(extensionSource).toContain("GridBlock")
    expect(extensionSource).toContain("HandoutNextGridCommands")
    expect(extensionSource).toContain("isGridCellParagraph")
    expect(extensionSource).toContain("!hasAnchor && isRedundantGridCellParagraph")
    expect(extensionSource).toContain('$pos.parent.childCount === 1')
    expect(extensionSource).toContain('$pos.parent.childCount > 1')
    expect(blockCommandsSource).toContain('case "grid"')
    expect(blockCommandsSource).toContain("createGridBlockContent")
    expect(blockCommandsSource).toContain("isGridCellChild")
    expect(blockCommandsSource).toContain('$pos.parent.type.name === "gridCell"')
    expect(blockCommandsSource).toContain('node.type.name === "gridBlock"')
    expect(blockCommandsSource).toContain("paragraphType.create()")
    expect(gridCommandsSource).toContain("addHandoutNextGridColumn")
    expect(gridCommandsSource).toContain("addHandoutNextGridRow")
    expect(gridCommandsSource).toContain("deleteHandoutNextGridColumn")
    expect(gridCommandsSource).toContain("deleteHandoutNextGridRow")
    expect(gridCommandsSource).toContain("GridDeletePlacement")
    expect(gridCommandsSource).toContain("getRelativeIndex")
    expect(gridCommandsSource).toContain("appendTransaction")
    expect(gridCommandsSource).toContain("removeRedundantGridCellPlaceholders")
    expect(gridCommandsSource).toContain("hasSubstantialGridCellChild")
    expect(gridCommandsSource).toContain("selectionTouchesRange")
    expect(gridCommandsSource).toContain("MAX_GRID_COLUMNS")
    expect(gridCommandsSource).toContain("context.columnCount <= 1")
    expect(gridCommandsSource).toContain("context.rowCount <= 1")
    expect(gridCommandsSource).toContain("TextSelection.near")
    expect(suggestionMenuSource).toContain('id: "grid"')
    expect(suggestionMenuSource).toContain("IconLayoutGrid")
    expect(blockControlsSource).toContain('label="Add row above"')
    expect(blockControlsSource).toContain('label="Add row below"')
    expect(blockControlsSource).toContain('label="Add column left"')
    expect(blockControlsSource).toContain('label="Add column right"')
    expect(blockControlsSource).toContain('label="Delete row above"')
    expect(blockControlsSource).toContain('label="Delete row below"')
    expect(blockControlsSource).toContain('label="Delete column left"')
    expect(blockControlsSource).toContain('label="Delete column right"')
    expect(blockControlsSource).toContain("addHandoutNextGridRow")
    expect(blockControlsSource).toContain("deleteHandoutNextGridColumn")
    expect(blockControlsSource).toContain('storedTarget?.node.type.name === "gridBlock"')
    expect(blockControlsSource).toContain("isTargetInsideGrid")
    expect(blockControlsSource).toContain("resolveDeleteBlockTarget")
    expect(blockControlsSource).toContain("findSingleMeaningfulGridContentTarget")
    expect(blockControlsSource).toContain("for (let depth = $position.depth; depth > 0; depth -= 1)")
    expect(blockControlsSource).toContain("node.type.isInGroup(\"block\")")
    expect(stylesheetSource).toContain("[data-handout-grid-cell] > .react-renderer")
    expect(stylesheetSource).toContain("[data-handout-grid-cell] > :not(:last-child)")
    expect(stylesheetSource).toContain("outline: 1px dashed transparent")
    expect(stylesheetSource).toContain("outline-color: var(--border-subtle)")
    expect(editorCanvasModuleSource).toContain("useLayoutEffect(() =>")
    expect(editorCanvasModuleSource).toContain(
      "canvas.scrollTo({ top: 0, left: 0, behavior: \"auto\" })",
    )
    expect(editorCanvasModuleSource).toContain("window.requestAnimationFrame(resetScroll)")
    expect(stylesheetSource).toContain("p.handout-editor-placeholder-hidden")
    expect(stylesheetSource).toContain("margin-bottom: 0")
    expect(stylesheetSource).toContain("p.handout-editor-placeholder-hidden")
    expect(stylesheetSource).toContain(".react-renderer.node-imageCard")
    expect(stylesheetSource).toContain(".react-renderer.node-iconCard")
    expect(stylesheetSource).toContain(".react-renderer.node-testimonialCard")
  })

  it("does not import old editor behavior", async () => {
    const violations: string[] = []

    for (const [file, source] of Object.entries(editorModules)) {
      if (file.endsWith("editor-architecture.test.ts")) {
        continue
      }

      for (const forbiddenImport of forbiddenImports) {
        if (typeof source === "string" && source.includes(forbiddenImport)) {
          violations.push(`${file}: ${forbiddenImport}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it("keeps block insertion in Tiptap suggestion commands instead of a second empty-line menu", () => {
    const violations: string[] = []

    for (const [file, source] of Object.entries(editorModules)) {
      if (file.endsWith("editor-architecture.test.ts")) {
        continue
      }

      if (typeof source === "string" && source.includes("FloatingMenu")) {
        violations.push(`${file}: FloatingMenu`)
      }
    }

    expect(violations).toEqual([])
  })

  it("does not reintroduce old side-button block controls", () => {
    const forbiddenControlTokens = ["insertBlockAfterPosition", "bodyDragNodeTypes"]
    const violations: string[] = []

    for (const [file, source] of Object.entries(editorModules)) {
      if (file.endsWith("editor-architecture.test.ts")) {
        continue
      }

      for (const token of forbiddenControlTokens) {
        if (typeof source === "string" && source.includes(token)) {
          violations.push(`${file}: ${token}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it("keeps drag handle plugin inputs stable across React renders", () => {
    const blockControlsSource = editorModules["./components/block-controls.tsx"]

    expect(blockControlsSource).toContain(
      "computePositionConfig={compactBlockHandlePositionConfig}"
    )
    expect(blockControlsSource).toContain("onNodeChange={handleActiveBlockChange}")
    expect(blockControlsSource).not.toContain(
      "computePositionConfig={{ middleware: [compactBlockHandleAlignment] }}"
    )
  })

  it("keeps block selection behavior in Tiptap extensions", () => {
    const blockClipboardSource =
      editorModules["./tiptap/extensions/block-clipboard.ts"]
    const blockSelectionSource =
      editorModules["./tiptap/extensions/block-selection.ts"]
    const blockMarqueeSelectionSource =
      editorModules["./tiptap/extensions/block-marquee-selection.ts"]
    const selectionCleanupSource =
      editorModules["./tiptap/extensions/selection-cleanup.ts"]
    expect(blockSelectionSource).toContain("isNodeRangeSelection")
    expect(blockSelectionSource).toContain("handleKeyDown")
    expect(blockSelectionSource).toContain("Delete:")
    expect(blockSelectionSource).toContain("selection.ranges")
    expect(blockSelectionSource).toContain("getGridCellBlockRanges")
    expect(blockSelectionSource).toContain('type.name === "gridCell"')
    expect(blockSelectionSource).toContain("getGridCellReplacementRangeKeys")
    expect(blockSelectionSource).toContain("TextSelection.near")
    expect(blockSelectionSource).toContain("createDeleteEmptyButtonBlockTransaction")
    expect(blockSelectionSource).toContain('node.type.name !== "buttonBlock"')
    expect(blockClipboardSource).toContain("createHandoutBlockClipboardPayload")
    expect(blockClipboardSource).toContain("createInsertHandoutBlockClipboardTransaction")
    expect(blockClipboardSource).toContain("NodeRangeSelection.create")
    expect(blockClipboardSource).toContain("view.serializeForClipboard")
    expect(blockClipboardSource).toContain("handlePaste")
    expect(blockClipboardSource).toContain("stripHandoutUniqueIds")
    expect(blockClipboardSource).toContain("sessionStorage")
    expect(blockMarqueeSelectionSource).toContain("NodeRangeSelection")
    expect(blockMarqueeSelectionSource).toContain("new Plugin")
    expect(blockMarqueeSelectionSource).toContain("getOrCreateBlockMarqueeSelectionController")
    expect(blockMarqueeSelectionSource).toContain('eventRoot.addEventListener("pointerdown"')
    expect(blockMarqueeSelectionSource).not.toContain("blockMarqueeSelectionControllers.delete(view)")
    expect(blockMarqueeSelectionSource).toContain("if (!marquee.active && distance < MARQUEE_DRAG_THRESHOLD)")
    expect(blockMarqueeSelectionSource).toContain("event.preventDefault()")
    expect(blockMarqueeSelectionSource).toContain("return false")
    expect(blockMarqueeSelectionSource).toContain("nativeSelectionAllowed")
    expect(blockMarqueeSelectionSource).toContain("startsInsideTopLevelBlock")
    expect(blockMarqueeSelectionSource).toContain("if (!nativeSelectionAllowed)")
    expect(blockMarqueeSelectionSource).toContain(".handout-editor-button-settings")
    expect(selectionCleanupSource).toContain(".handout-editor-button-settings")
    expect(blockMarqueeSelectionSource).not.toContain("event.buttons === 0")
    expect(selectionCleanupSource).not.toContain(
      'querySelectorAll(".ProseMirror-selectednoderange")'
    )
  })

  it("routes editor selection fills and borders through semantic selection tokens", () => {
    expect(stylesheetSource).toContain("background-color: var(--selection-background)")
    expect(stylesheetSource).toContain("background: var(--selection-background)")
    expect(stylesheetSource).toContain("border-color: var(--selection-border)")
    expect(stylesheetSource).toContain("background-color: var(--selection-border)")
    expect(stylesheetSource).not.toContain("var(--color-indigo-500)")
  })

  it("keeps icon-list selection fill on the group instead of its individual items", () => {
    expect(stylesheetSource).toContain(
      `.handout-editor .ProseMirror-selectednode[data-handout-icon-list-item],
  .handout-editor .ProseMirror-selectednoderange[data-handout-icon-list-item] {
    background: transparent;
  }`,
    )
  })

  it("keeps the block menu target stable through the grip click", () => {
    const blockControlsSource = editorModules["./components/block-controls.tsx"]

    expect(blockControlsSource).toContain("lastActiveBlockRef")
    expect(blockControlsSource).toContain("activeBlock ?? lastActiveBlockRef.current")
  })

  it("keeps button create settings as a Tiptap draft preview instead of a detached form", () => {
    const buttonSettingsSource =
      editorModules["./tiptap/extensions/button-settings.ts"]
    const buttonSettingsPopoverSource =
      editorModules["./components/button-settings-popover.tsx"]

    expect(buttonSettingsSource).toContain("previewHandoutNextButtonDraft")
    expect(buttonSettingsSource).toContain('setMeta("addToHistory", false)')
    expect(buttonSettingsPopoverSource).toContain("previewHandoutNextButtonDraft")
    expect(buttonSettingsPopoverSource).toContain('previewButtonDraft({ label: nextLabel.trim() || "Button" })')
    expect(buttonSettingsPopoverSource).toContain("previewButtonDraft({ fullWidth: nextFullWidth })")
    expect(buttonSettingsPopoverSource).toContain("Button text")
    expect(buttonSettingsPopoverSource).toContain("Button link")
    expect(buttonSettingsPopoverSource).toContain("Fill width")
    expect(buttonSettingsSource).toContain('mode: "create" | "edit"')
    expect(buttonSettingsSource).not.toContain("edit-link")
  })

  it("keeps image card button editing on the image-card Tiptap node", () => {
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    const blockViewsSource =
      editorModules["./tiptap/nodes/block-views.tsx"]
    const extensionSource =
      editorModules["./tiptap/extensions/index.ts"]
    const imageCardButtonSettingsSource =
      editorModules["./tiptap/extensions/image-card-button-settings.ts"]
    const imageCardButtonPopoverSource =
      editorModules["./components/image-card-button-settings-popover.tsx"]

    expect(extensionSource).toContain("HandoutNextImageCardButtonSettings")
    expect(blockControlsSource).toContain("openHandoutNextImageCardButtonSettings")
    expect(blockControlsSource).toContain("updateImageCardBlock")
    expect(blockControlsSource).toContain('label={menuTarget.node.attrs.src ? "Replace image" : "Upload image"}')
    expect(blockControlsSource).toContain('label="Button"')
    expect(blockControlsSource).toContain('label="Remove button"')
    expect(blockViewsSource).toContain("uploadImageFileAsAttrs")
    expect(blockViewsSource).toContain("loadImageDimensions")
    expect(blockViewsSource).toContain('setMeta("addToHistory", false)')
    expect(blockViewsSource).toContain("imageAspectRatio")
    expect(blockViewsSource).toContain("imageHeight: attrs.height")
    expect(blockViewsSource).toContain("imageWidth: attrs.width")
    expect(blockViewsSource).toContain('aria-hidden="true"')
    expect(blockViewsSource).toContain("hidden")
    expect(blockViewsSource).toContain('aria-label="Replace image"')
    expect(blockViewsSource).toContain("handout-editor-image-card-replace-button")
    expect(blockViewsSource).toContain("handout-editor-image-card-empty-button")
    expect(blockViewsSource).toContain("openHandoutNextImageCardButtonSettings")
    expect(blockViewsSource).not.toContain("handout-editor-image-card-shell py-2")
    expect(blockViewsSource).not.toContain('className="py-2"')
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror>hr,.handout-document-editor .handout-prosemirror>.react-renderer",
    )
    expect(stylesheetSource).not.toContain(".react-renderer.node-buttonBlock,")
    expect(stylesheetSource).toContain(".handout-editor-image-card-shell")
    expect(stylesheetSource).not.toMatch(/node-imageCard[\s\S]{0,160}padding-top: 8px/)
    expect(imageCardButtonSettingsSource).toContain('node.type.name !== "imageCard"')
    expect(imageCardButtonSettingsSource).toContain("previewHandoutNextImageCardButtonDraft")
    expect(imageCardButtonSettingsSource).toContain('"addToHistory"')
    expect(imageCardButtonSettingsSource).toContain("false")
    expect(imageCardButtonPopoverSource).toContain("normalizeButtonHref")
    expect(imageCardButtonPopoverSource).toContain("Enter button text.")
    expect(imageCardButtonPopoverSource).toContain("Enter a valid public website URL.")
  })

  it("keeps logo grids as nested Tiptap nodes with logo media attrs only", () => {
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const blockNodesSource = editorModules["./tiptap/nodes/blocks.tsx"]
    const blockViewsSource = editorModules["./tiptap/nodes/block-views.tsx"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const cardNavigationSource =
      editorModules["./tiptap/extensions/card-navigation.ts"]
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]

    expect(schemaSource).toContain('"logoGrid"')
    expect(schemaSource).toContain("siteDocumentUniqueIdNodeTypes")
    expect(sharedSiteExtensionSource).toContain('name: "logoGrid"')
    expect(sharedSiteExtensionSource).toContain('content: "logoGridItem+"')
    expect(sharedSiteExtensionSource).toContain('name: "logoGridItem"')
    expect(sharedSiteExtensionSource).toContain('content: "logoGridItemTitle"')
    expect(sharedSiteExtensionSource).toContain('"logoGridItemTitle"')
    expect(blockNodesSource).toContain("LogoGridView")
    expect(blockNodesSource).toContain("LogoGridItemView")
    expect(blockViewsSource).toContain("uploadImageFileAsAttrs")
    expect(blockViewsSource).toContain("getDevAuthBypassHeaders")
    expect(blockViewsSource).toContain("fetchLogoPreviewFile")
    expect(blockViewsSource).toContain("/api/workspaces/logo-preview")
    expect(blockViewsSource).toContain("uploadImageFileAsAttrs(image.file, activeWorkspace.id)")
    expect(blockViewsSource).not.toContain("https://img.logo.dev")
    expect(blockViewsSource).toContain("data-handout-editor-block-type=\"logo-grid\"")
    expect(blockViewsSource).toContain("data-has-logo={src ? \"true\" : undefined}")
    expect(blockViewsSource).toContain("handout-editor-logo-grid-menu")
    expect(blockViewsSource).toContain("Company website")
    expect(blockViewsSource).toContain("Use logo")
    expect(blockViewsSource).toContain("getLogoGridItemCount")
    expect(blockViewsSource).toContain("canRemove")
    expect(extensionSource).toContain("LogoGrid")
    expect(extensionSource).toContain("LogoGridItem")
    expect(extensionSource).toContain("LogoGridItemTitle")
    expect(extensionSource).toContain('node.type.name === "logoGridItemTitle"')
    expect(extensionSource).toContain("isAlwaysVisiblePlaceholderNode")
    expect(cardNavigationSource).toContain("findLogoGridEnterTarget")
    expect(cardNavigationSource).toContain("normalizeLogoGridStructure")
    expect(cardNavigationSource).toContain('node.type.name !== "logoGridItem"')
    expect(blockCommandsSource).toContain('case "logoGrid"')
    expect(blockCommandsSource).toContain("createLogoGridBlockContent")
    expect(blockCommandsSource).toContain('type: "logoGridItem"')
    expect(suggestionMenuSource).toContain('id: "logoGrid"')
    expect(suggestionMenuSource).toContain("IconGridDots")
    expect(blockControlsSource).toContain('node.type.name === "logoGrid"')
    expect(blockControlsSource).toContain('label="Add logo"')
    expect(blockControlsSource).toContain("addLogoGridItem")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror>hr,.handout-document-editor .handout-prosemirror>.react-renderer",
    )
    expect(stylesheetSource).toContain(".handout-editor-logo-grid")
    expect(stylesheetSource).toContain(".handout-editor-logo-grid-item")
    expect(stylesheetSource).toContain(".handout-editor-logo-grid-menu")
    expect(stylesheetSource).not.toContain(".handout-editor-logo-grid-domain-control")
    expect(stylesheetSource).toContain(
      ".handout-editor-logo-grid-menu,\n  .handout-editor-variable-popover {\n    @apply font-sans font-normal tracking-normal;"
    )
    expect(SITE_DOCUMENT_CSS).toContain("repeat(3,minmax(0,1fr))")
  })

  it("uses the shared semantic fill for table header cells", () => {
    expect(stylesheetSource).toContain("background: var(--table-header-background)")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-table th,.handout-document-editor .tableWrapper>table th{background:var(--table-header-background)",
    )
  })

  it("keeps logo-grid wrappers inside the standard responsive content width", () => {
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror>hr,.handout-document-editor .handout-prosemirror>.react-renderer",
    )
    expect(stylesheetSource).toContain(".handout-editor-logo-grid-shell {\n    width: 100%;")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-logo-grid{display:grid;width:100%;min-width:0;max-width:100%",
    )
  })

  it("registers official Tiptap extensions for editor-native document behavior", () => {
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const blockNodesSource = editorModules["./tiptap/nodes/blocks.tsx"]
    const blockViewsSource = editorModules["./tiptap/nodes/block-views.tsx"]
    const cardNavigationSource = editorModules["./tiptap/extensions/card-navigation.ts"]

    expect(extensionSource).toContain("@tiptap/extension-link")
    expect(extensionSource).toContain("@tiptap/extension-underline")
    expect(extensionSource).toContain("@tiptap/extension-typography")
    expect(extensionSource).toContain("@tiptap/extension-color")
    expect(extensionSource).toContain("@tiptap/extension-highlight")
    expect(extensionSource).toContain("@tiptap/extension-text-style")
    expect(extensionSource).toContain("@tiptap/extensions/trailing-node")
    expect(extensionSource).toContain("@tiptap/extension-emoji")
    expect(extensionSource).toContain("HandoutImage")
    expect(extensionSource).toContain("HandoutGif")
    expect(extensionSource).toContain("Emoji.configure")
    expect(extensionSource).toContain("TextStyle")
    expect(extensionSource).toContain("Color")
    expect(extensionSource).toContain("Highlight.configure")
    expect(extensionSource).toContain("multicolor: true")
    expect(extensionSource).toContain("HandoutImage.configure")
    expect(extensionSource).toContain("HandoutGif.configure")
    expect(extensionSource).toContain("HandoutNextGifPicker")
    expect(extensionSource).toContain("resize: {")
    expect(extensionSource).toContain('directions: ["left", "right"]')
    expect(extensionSource).not.toContain('"top-left"')
    expect(extensionSource).not.toContain('"bottom-right"')
    expect(extensionSource).toContain("alwaysPreserveAspectRatio: true")
    expect(extensionSource).toContain("ListKeymap.configure")
    expect(extensionSource).toContain('itemName: "iconListItem"')
    expect(extensionSource).not.toContain("HandoutNextIconListNavigation")
    expect(extensionSource).toContain("TaskList")
    expect(extensionSource).toContain("TaskItem.configure")
    expect(extensionSource).toContain("levels: [1, 2, 3]")
    expect(blockNodesSource).toContain("SiteIconList")
    expect(blockNodesSource).toContain("SiteIconListItem.extend")
    expect(sharedSiteExtensionSource).toContain("BulletList.extend")
    expect(sharedSiteExtensionSource).toContain("ListItem.extend")
    expect(sharedSiteExtensionSource).toContain("addInputRules")
    expect(sharedSiteExtensionSource).toContain('content: "imageCardTitle imageCardBody"')
    expect(sharedSiteExtensionSource).toContain('"imageCardTitle"')
    expect(sharedSiteExtensionSource).toContain('"imageCardBody"')
    expect(sharedSiteExtensionSource).toContain('content: "iconCardTitle iconCardBody"')
    expect(sharedSiteExtensionSource).toContain('"iconCardTitle"')
    expect(sharedSiteExtensionSource).toContain('"iconCardBody"')
    expect(sharedSiteExtensionSource).toContain('content: "pageTitleTitle pageTitleSubtitle"')
    expect(sharedSiteExtensionSource).toContain('"pageTitleTitle"')
    expect(sharedSiteExtensionSource).toContain('"pageTitleSubtitle"')
    expect(sharedSiteExtensionSource).toContain(
      'content: "testimonialAuthorName testimonialAuthorRole testimonialQuote"'
    )
    expect(sharedSiteExtensionSource).toContain('"testimonialAuthorName"')
    expect(sharedSiteExtensionSource).toContain('"testimonialAuthorRole"')
    expect(sharedSiteExtensionSource).toContain('"testimonialQuote"')
    expect(blockNodesSource).toContain("data-icon-color")
    expect(blockViewsSource).toContain("NodeViewContent")
    expect(blockViewsSource).toContain("IconSelectorMenu")
    expect(blockViewsSource).toContain("Change card icon")
    expect(blockViewsSource).toContain("updateAttributes({ icon")
    expect(blockViewsSource).toContain("updateAttributes({ iconColor")
    expect(blockViewsSource).not.toContain("GifBlockView")
    expect(cardNavigationSource).toContain("normalizeCardStructures")
    expect(cardNavigationSource).toContain('cardNodeName: "iconCard"')
    expect(cardNavigationSource).toContain('titleNodeName: "iconCardTitle"')
    expect(cardNavigationSource).toContain('bodyNodeName: "iconCardBody"')
    expect(cardNavigationSource).toContain('cardNodeName: "imageCard"')
    expect(cardNavigationSource).toContain('titleNodeName: "imageCardTitle"')
    expect(cardNavigationSource).toContain('bodyNodeName: "imageCardBody"')
    expect(cardNavigationSource).toContain('cardNodeName: "pageTitleSection"')
    expect(cardNavigationSource).toContain('titleNodeName: "pageTitleTitle"')
    expect(cardNavigationSource).toContain('bodyNodeName: "pageTitleSubtitle"')
    expect(cardNavigationSource).toContain("selection instanceof NodeSelection")
    expect(cardNavigationSource).toContain("findEmptyPageNodeSelectionInsertPosition")
    expect(cardNavigationSource).toContain("selection.node !== firstNode")
    expect(cardNavigationSource).toContain("insertParagraphAt")
    expect(cardNavigationSource).toContain("findEmptyPageEnterInsertPosition")
    expect(cardNavigationSource).toContain("isEmptyPageRootSelection")
    expect(cardNavigationSource).toContain("$from.depth !== 1")
    expect(cardNavigationSource).toContain('parent.type.name === "pageTitleSection"')
    expect(cardNavigationSource).toContain('parent.type.name === "heading"')
    expect(cardNavigationSource).toContain("parent.content.size === 0")
    expect(cardNavigationSource).toContain('firstNode.type.name !== "pageTitleSection"')
    expect(cardNavigationSource).toContain('firstNode.type.name !== "heading"')
    expect(cardNavigationSource).toContain('cardNodeName: "testimonialCard"')
    expect(cardNavigationSource).toContain('"testimonialAuthorName"')
    expect(cardNavigationSource).toContain('"testimonialAuthorRole"')
    expect(cardNavigationSource).toContain('"testimonialQuote"')
    expect(schemaSource).toContain('"taskList"')
    expect(schemaSource).toContain('"heading3"')
    expect(schemaSource).toContain('"emoji"')
    expect(schemaSource).toContain('"pageTitle"')
    expect(schemaSource).toContain('"image"')
  })

  it("suppresses native list markers for icon lists at every valid nesting level", () => {
    const blockViewsSource = editorModules["./tiptap/nodes/block-views.tsx"]

    expect(stylesheetSource).not.toContain(
      ".handout-editor .ProseMirror ul[data-handout-icon-list],"
    )
    expect(stylesheetSource).not.toContain(
      "@apply grid grid-cols-[20px_minmax(0,1fr)] items-start gap-1;",
    )
    expect(blockViewsSource).toContain(
      'className="handout-icon-list-item handout-editor-icon-list-inner"',
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror li[data-handout-icon-list-item],.handout-document-editor .handout-prosemirror li[data-handout-icon-list-item]::marker{list-style:none}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      "grid-template-columns:20px minmax(0,1fr);align-items:start;gap:4px;padding-left:4px"
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list-item,.handout-document-editor .handout-prosemirror>:where(ul,ol)>li{padding-left:2px}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list:is(ol)>.handout-list-item,.handout-document-editor .handout-prosemirror>ol>li{padding-left:4px}",
    )
    expect(SITE_DOCUMENT_CSS).toContain("--handout-list-item-gap:4px")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-list>.handout-list-item+.handout-list-item,.handout-document-editor .handout-prosemirror :where(ul:not([data-type=taskList]):not([data-handout-icon-list]),ol)>li+li{margin-top:var(--handout-list-item-gap)}",
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-icon-list,.handout-document-editor .handout-prosemirror ul[data-handout-icon-list]{display:flex;flex-direction:column;gap:var(--handout-list-item-gap)",
    )
    expect(SITE_DOCUMENT_CSS).not.toContain(
      ".handout-document-editor .handout-prosemirror>*+*{margin-top:20px}",
    )
    expect(stylesheetSource).not.toContain(".handout-tiptap p + p")
    expect(stylesheetSource).not.toContain(".handout-tiptap p {")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror > p {\n    @apply px-0")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror > h1 {\n    @apply px-0")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror a {\n")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror code {\n")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror > blockquote {\n")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror > pre {\n")
    expect(stylesheetSource).not.toContain(".handout-editor .ProseMirror > hr {\n")
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-prosemirror>p+p{--handout-sibling-gap:var(--handout-body-gap)}",
    )
    expect(SITE_DOCUMENT_CSS.lastIndexOf(".handout-prosemirror>:not(:first-child){margin-top:var(--handout-sibling-gap,var(--handout-block-gap))}")).toBeGreaterThan(
      SITE_DOCUMENT_CSS.indexOf(".handout-list,.handout-prosemirror>ul,.handout-prosemirror>ol"),
    )
  })

  it("exposes emoji through Tiptap block commands and slash suggestions", () => {
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]

    expect(blockCommandsSource).toContain('text: ":"')
    expect(blockCommandsSource).toContain('blockType === "emoji"')
    expect(blockCommandsSource).toContain("? setSelectionInsideInsertedContent(tr, pos)")
    expect(blockCommandsSource).toContain("TextSelection.create(tr.doc, found)")
    expect(blockCommandsSource).toContain('case "heading3"')
    expect(blockCommandsSource).toContain('attrs: { level: 3 }, content: textContent')
    expect(blockCommandsSource).toContain('{ type: "iconCardTitle" }')
    expect(blockCommandsSource).toContain('{ type: "iconCardBody" }')
    expect(blockCommandsSource).toContain('{ type: "imageCardTitle" }')
    expect(blockCommandsSource).toContain('{ type: "imageCardBody" }')
    expect(extensionSource).toContain("createHandoutNextEmojiSuggestion")
    expect(suggestionMenuSource).toContain('id: "heading3"')
    expect(suggestionMenuSource).toContain('id: "emoji"')
    expect(suggestionMenuSource).toContain("filterEmojiItems")
  })

  it("exposes native resizable images through Tiptap block commands and slash suggestions", () => {
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"] as string
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    const imageNodeSource =
      editorModules["./tiptap/nodes/handout-image.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const createBlockContentSource = blockCommandsSource.slice(
      blockCommandsSource.indexOf("export function createBlockContent")
    )

    expect(blockCommandsSource).toContain('type: "image"')
    expect(createBlockContentSource.indexOf('case "image":')).toBeLessThan(
      createBlockContentSource.indexOf('case "imageCard":')
    )
    expect(
      createBlockContentSource.slice(
        createBlockContentSource.indexOf('case "image":'),
        createBlockContentSource.indexOf('case "imageCard":')
      )
    ).not.toContain("src:")
    expect(blockCommandsSource).toContain("NodeSelection.create")
    expect(imageNodeSource).toContain("@tiptap/extension-image")
    expect(imageNodeSource).toContain("dataset.handoutImageEmpty")
    expect(imageNodeSource).toContain('input.ariaHidden = "true"')
    expect(imageNodeSource).toContain("input.hidden = true")
    expect(imageNodeSource).toContain("Click or drag an image file here")
    expect(imageNodeSource).toContain("ResizableNodeView")
    expect(imageNodeSource).toContain("applyImageElementAttributes")
    expect(imageNodeSource).toContain("uploadImageFileAsAttrs(file, workspaceId)")
    expect(imageNodeSource).toContain('element.style.height = "auto"')
    expect(imageNodeSource).toContain("getBoundingClientRect")
    expect(imageNodeSource).not.toContain("element.style.height = `${height}px`")
    expect(blockControlsSource).toContain('updateAttributes("image"')
    expect(blockControlsSource).toContain("uploadImageFileAsAttrs")
    expect(blockControlsSource).toContain('aria-hidden="true"')
    expect(blockControlsSource).toContain("hidden")
    expect(blockControlsSource).toContain("Replace from URL")
    expect(suggestionMenuSource).toContain('id: "image"')
  })

  it("exposes GIFs as native Tiptap selectable and resizable nodes with a GIPHY picker", () => {
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"] as string
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorModules["./components/editor-canvas.tsx"]
    const gifPickerDialogSource =
      editorModules["./components/gif-picker-dialog.tsx"]
    const gifNodeSource =
      editorModules["./tiptap/nodes/handout-gif.ts"]
    const gifPickerSource =
      editorModules["./tiptap/extensions/gif-picker.ts"]
    const giphySource =
      editorModules["./tiptap/giphy.ts"]

    expect(blockCommandsSource).toContain('type: "gifBlock"')
    expect(blockCommandsSource).not.toContain("media.giphy.com")
    expect(blockCommandsSource).toContain("openHandoutNextGifPicker")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "gifBlock"')
    expect(gifNodeSource).toContain("ResizableNodeView")
    expect(gifNodeSource).toContain("SiteGifBlock.extend")
    expect(sharedSiteExtensionSource).toContain('name: "gifBlock"')
    expect(sharedSiteExtensionSource).toContain("selectable: true")
    expect(sharedSiteExtensionSource).toContain("draggable: true")
    expect(gifNodeSource).toContain("dataset.handoutGifEmpty")
    expect(gifNodeSource).toContain("Search GIPHY")
    expect(gifNodeSource).toContain('element.style.height = "auto"')
    expect(stylesheetSource).toContain(
      ".handout-editor-gif-picker-results [data-giphy-gif]"
    )
    expect(stylesheetSource).toContain("cursor: pointer;")
    expect(stylesheetSource).toMatch(
      /\.handout-editor-gif-picker-footer\s*\{[^}]*background: var\(--popover\);/
    )
    expect(SITE_DOCUMENT_CSS).toContain(
      ".handout-document-editor .handout-prosemirror>[data-handout-gif-empty]"
    )
    expect(gifPickerSource).toContain("setHandoutNextGif")
    expect(gifPickerSource).toContain("subscribe")
    expect(giphySource).toContain('light: "/editor-assets/giphy-powered-by.png"')
    expect(giphySource).toContain('dark: "/editor-assets/giphy-powered-by-dark.png"')
    expect(gifPickerDialogSource).toContain("dark:hidden")
    expect(gifPickerDialogSource).toContain("dark:block")
    expect(gifPickerDialogSource).toContain("entry.contentRect.width")
    expect(gifPickerDialogSource).toContain('ref={setGridContainer} className="w-full"')
    expect(gifPickerDialogSource).toContain("const [gridWidth, setGridWidth] = useState(0)")
    expect(gifPickerDialogSource).toMatch(
      /const setGridContainer = useCallback\(\(gridContainer: HTMLDivElement \| null\) => \{[\s\S]{0,600}gridContainer\.getBoundingClientRect\(\)\.width/
    )
    expect(gifPickerDialogSource).toMatch(
      /useEffect\(\(\) => \{[\s\S]{0,200}window\.setTimeout/
    )
    expect(gifPickerDialogSource).not.toContain("gridContainer.clientWidth")
    expect(gifPickerDialogSource).not.toContain('`${debouncedQuery || "trending"}:${columns}:${gridWidth}`')
    expect(gifPickerDialogSource).toContain('<InputGroup size="xl">')
    expect(gifPickerDialogSource).toContain("<InputGroupAddon>")
    expect(gifPickerDialogSource).toContain("<InputGroupInput")
    expect(gifPickerDialogSource).not.toContain("handout-editor-gif-picker-search")
    expect(stylesheetSource).not.toContain(".handout-editor-gif-picker-search")
    expect(editorCanvasSource).toContain("EditorGifPickerDialog")
    expect(blockControlsSource).toContain('node.type.name === "gifBlock"')
    expect(blockControlsSource).toContain("Change GIF")
    expect(giphySource).toContain("@giphy/js-fetch-api")
    expect(giphySource).toContain("VITE_GIPHY_API_KEY")
  })

  it("keeps calendar embeds on a custom Tiptap iframe extension path", () => {
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorModules["./components/editor-canvas.tsx"]
    const calendarNodeSource =
      editorModules["./tiptap/nodes/calendar-embed.tsx"]
    const calendarNodeViewSource =
      editorModules["./tiptap/nodes/calendar-embed-view.tsx"]
    const calendarSettingsSource =
      editorModules["./tiptap/extensions/calendar-embed-settings.ts"]
    const calendarMenuSource =
      editorModules["./components/calendar-embed-settings-menu.tsx"]
    const floatingPopoverSource =
      editorModules["./components/use-floating-editor-popover-position.ts"]
    const embedUrlSource = editorModules["./lib/embed-url.ts"]
    const calendarFrameStyles = stylesheetSource.slice(
      stylesheetSource.indexOf(".handout-editor-calendar-embed-frame"),
      stylesheetSource.indexOf(".handout-editor-calendar-settings-menu")
    )

    expect(schemaSource).toContain('"calendar"')
    expect(schemaSource).toContain("siteDocumentUniqueIdNodeTypes")
    expect(extensionSource).toContain("CalendarEmbed")
    expect(extensionSource).toContain("HandoutNextCalendarEmbedSettings")
    expect(blockCommandsSource).toContain('type: "calendarEmbed"')
    expect(blockCommandsSource).toContain("openHandoutNextCalendarEmbedSettings")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "calendarEmbed"')
    expect(suggestionMenuSource).toContain('id: "calendar"')
    expect(suggestionMenuSource).toContain("IconCalendarEvent")
    expect(suggestionMenuSource).toContain("openHandoutNextCalendarEmbedSettings")
    expect(blockControlsSource).toContain('node.type.name === "calendarEmbed"')
    expect(blockControlsSource).toContain("Edit calendar")
    expect(editorCanvasSource).toContain("EditorCalendarEmbedSettingsMenu")
    expect(calendarNodeSource).toContain("SiteCalendarEmbed.extend")
    expect(sharedSiteExtensionSource).toContain('embedNode("calendarEmbed"')
    expect(calendarNodeViewSource).toContain("<iframe")
    expect(calendarSettingsSource).toContain("setHandoutNextCalendarEmbedAttrs")
    expect(calendarSettingsSource).toContain("removeHandoutNextCalendarEmbedDraft")
    expect(calendarMenuSource).toContain("handout-editor-calendar-settings-menu")
    expect(calendarMenuSource).toContain("normalizeIframeEmbedUrl")
    expect(calendarMenuSource).toContain("useFloatingEditorPopoverPosition")
    expect(calendarMenuSource).not.toContain("useLayoutEffect")
    expect(calendarMenuSource).not.toContain("Dialog")
    expect(calendarMenuSource).not.toContain("titleDraft")
    expect(floatingPopoverSource).toContain("anchorRect.bottom")
    expect(floatingPopoverSource).toContain("availableAbove")
    expect(floatingPopoverSource).toContain("maxHeight")
    expect(embedUrlSource).toContain("extractIframeSrc")
    expect(embedUrlSource).toContain("normalizeWebsiteUrl")
    expect(stylesheetSource).toContain(".react-renderer.node-calendarEmbed")
    expect(stylesheetSource).toContain(".handout-editor-calendar-embed-frame")
    expect(stylesheetSource).toContain(".handout-editor-calendar-settings-menu")
    expect(calendarFrameStyles).not.toContain("pointer-events: none")
  })

  it("keeps video embeds on a custom Tiptap iframe extension path", () => {
    const schemaSource = editorModules["./tiptap/schema.ts"]
    const extensionSource = editorModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorModules["./components/editor-canvas.tsx"]
    const videoNodeSource =
      editorModules["./tiptap/nodes/video-embed.tsx"]
    const videoNodeViewSource =
      editorModules["./tiptap/nodes/video-embed-view.tsx"]
    const videoSettingsSource =
      editorModules["./tiptap/extensions/video-embed-settings.ts"]
    const videoMenuSource =
      editorModules["./components/video-embed-settings-menu.tsx"]
    const floatingPopoverSource =
      editorModules["./components/use-floating-editor-popover-position.ts"]
    const videoUrlSource = editorModules["./lib/video-embed-url.ts"]
    const videoFrameStyles = stylesheetSource.slice(
      stylesheetSource.indexOf(".handout-editor-video-embed-frame"),
      stylesheetSource.indexOf(".handout-editor-calendar-settings-menu")
    )

    expect(schemaSource).toContain('"video"')
    expect(schemaSource).toContain("siteDocumentUniqueIdNodeTypes")
    expect(extensionSource).toContain("VideoEmbed")
    expect(extensionSource).toContain("HandoutNextVideoEmbedSettings")
    expect(blockCommandsSource).toContain('type: "videoEmbed"')
    expect(blockCommandsSource).toContain("openHandoutNextVideoEmbedSettings")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "videoEmbed"')
    expect(suggestionMenuSource).toContain('id: "video"')
    expect(suggestionMenuSource).toContain("IconVideo")
    expect(suggestionMenuSource).toContain("openHandoutNextVideoEmbedSettings")
    expect(blockControlsSource).toContain('node.type.name === "videoEmbed"')
    expect(blockControlsSource).toContain("Edit video")
    expect(editorCanvasSource).toContain("EditorVideoEmbedSettingsMenu")
    expect(videoNodeSource).toContain("SiteVideoEmbed.extend")
    expect(sharedSiteExtensionSource).toContain('embedNode("videoEmbed"')
    expect(videoNodeViewSource).toContain("<iframe")
    expect(videoSettingsSource).toContain("setHandoutNextVideoEmbedAttrs")
    expect(videoSettingsSource).toContain("removeHandoutNextVideoEmbedDraft")
    expect(videoMenuSource).toContain("handout-editor-video-settings-menu")
    expect(videoMenuSource).toContain("normalizeVideoEmbedUrl")
    expect(videoMenuSource).toContain("useFloatingEditorPopoverPosition")
    expect(videoMenuSource).not.toContain("useLayoutEffect")
    expect(videoMenuSource).not.toContain("Dialog")
    expect(floatingPopoverSource).toContain("anchorRect.bottom")
    expect(floatingPopoverSource).toContain("availableAbove")
    expect(floatingPopoverSource).toContain("maxHeight")
    expect(videoUrlSource).toContain("normalizeYouTubeUrl")
    expect(videoUrlSource).toContain("normalizeVimeoUrl")
    expect(videoUrlSource).toContain("normalizeLoomUrl")
    expect(stylesheetSource).toContain(".react-renderer.node-videoEmbed")
    expect(stylesheetSource).toContain(".handout-editor-video-embed-frame")
    expect(stylesheetSource).toContain(".handout-editor-video-settings-menu")
    expect(videoFrameStyles).not.toContain("pointer-events: none")
  })

  it("keeps block settings before duplicate/delete and turn-into options", () => {
    const blockControlsSource =
      editorModules["./components/block-controls.tsx"] as string

    expect(blockControlsSource.indexOf('node.type.name === "image"')).toBeLessThan(
      blockControlsSource.indexOf('label="Copy"')
    )
    expect(blockControlsSource.indexOf('label="Copy"')).toBeLessThan(
      blockControlsSource.indexOf('label="Paste"')
    )
    expect(blockControlsSource.indexOf('label="Paste"')).toBeLessThan(
      blockControlsSource.indexOf('label="Duplicate"')
    )
    expect(blockControlsSource.indexOf('label="Duplicate"')).toBeLessThan(
      blockControlsSource.indexOf('handout-editor-block-menu-label">Turn into')
    )
  })

  it("uses the canonical context menu for block and empty-block actions", () => {
    const contextMenuSource =
      editorModules["./components/block-context-menu.tsx"] as string
    const editorCanvasSource =
      editorModules["./components/editor-canvas.tsx"] as string

    expect(contextMenuSource).toContain('from "@/components/ui/context-menu"')
    expect(contextMenuSource).toContain("NodeRangeSelection.create")
    expect(contextMenuSource).toContain("getSelectedBlockRanges")
    expect(contextMenuSource).toContain("Copy")
    expect(contextMenuSource).toContain("Paste")
    expect(contextMenuSource).toContain("Duplicate")
    expect(contextMenuSource).toContain("Delete")
    expect(contextMenuSource).toContain("Add block")
    expect(contextMenuSource).toContain('variant="destructive"')
    expect(contextMenuSource).toContain('insertContent("/")')
    expect(editorCanvasSource).toContain("EditorBlockContextMenu")
    expect(editorCanvasSource).toContain("enabled={isEditing}")
  })

  it("uses centered canonical edit/preview tabs with outline share and primary publish actions", () => {
    const headerSource =
      editorModules["./components/editor-header.tsx"] as string

    expect(headerSource).toContain('import { Tabs, TabsList, TabsTrigger }')
    expect(headerSource).toContain('<EditorModeTabs mode={mode} onModeChange={onModeChange} />')
    expect(headerSource).toContain('value="edit"')
    expect(headerSource).toContain('value="preview"')
    expect(headerSource).toContain('rounded-full')
    expect(headerSource).toContain("IconEye")
    expect(headerSource).toContain("IconPencil")
    expect(headerSource).toContain("Share")
    expect(headerSource).toContain("EditorPublishMenu")
    expect(headerSource).toContain("IconWorldLongitude")
    expect(headerSource).toContain("Last published")
    expect(headerSource).toContain("isPublishing")
    expect(headerSource).toContain('role="status"')
    expect(headerSource).toContain('rounded-full sm:hidden')
    expect(headerSource).toContain('className="hidden gap-1 sm:inline-flex"')
    expect(headerSource).toContain("lg:hidden")
    expect(headerSource).toContain("EditorModeToggle")
    expect(headerSource).toContain('aria-label="Share and edit recipients"')
    expect(headerSource).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")
    expect(headerSource).toContain("lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")
    expect(headerSource).toContain('className="hidden min-w-0 items-center justify-center lg:flex"')
    expect(headerSource).toContain('className="lg:hidden"')
    expect(headerSource).toContain("min-[480px]:inline-flex")
    expect(headerSource).toContain("max-[399px]:size-[30px]")
    expect(headerSource).toContain("md:inline-flex")
    expect(headerSource).toContain("md:hidden")
    expect(headerSource).toContain("IconUpload")
    expect(headerSource).not.toContain('<Button variant="secondary" size="compact">Publish</Button>')
  })

  it("uses semantic publish-state dots and the designed sequence modal widths", () => {
    const headerSource =
      editorModules["./components/editor-header.tsx"] as string
    const sequenceDialogSource =
      editorModules["./components/sequence-embed-dialog.tsx"] as string
    const providerIconsSource =
      editorModules["./components/sequence-provider-icons.tsx"] as string

    expect(headerSource).toContain('dotClassName: "bg-green-foreground"')
    expect(headerSource).toContain('dotClassName: "bg-orange-foreground"')
    expect(headerSource).toContain('dotClassName: "bg-muted-foreground"')
    expect(headerSource).not.toContain('dotClassName: "bg-success"')
    expect(headerSource).not.toContain('dotClassName: "bg-warning"')
    expect(sequenceDialogSource).toContain('"max-w-[365px] sm:max-w-[365px]"')
    expect(sequenceDialogSource).toContain('"max-w-[400px] sm:max-w-[400px]"')
    expect(providerIconsSource).toContain('icon-apollo.jpg')
    expect(providerIconsSource).toContain('icon-instantly.jpg')
    expect(providerIconsSource).toContain('icon-lemlist.jpg')
    expect(providerIconsSource).toContain('icon-outreach.jpg')
    expect(providerIconsSource).toContain('icon-salesloft.jpg')
  })

  it("only shows the editor save indicator when saving is unsuccessful", () => {
    const headerSource =
      editorModules["./components/editor-header.tsx"] as string

    expect(headerSource).toContain('status !== "offline" && status !== "unavailable"')
    expect(headerSource).toContain("return null")
    expect(headerSource).not.toContain('saved: "Saved"')
    expect(headerSource).not.toContain('saving: "Saving"')
    expect(headerSource).not.toContain('connecting: "Connecting"')
  })

  it("opens the reusable site settings drawer from the editor header", () => {
    const headerSource =
      editorModules["./components/editor-header.tsx"] as string
    const settingsMenuSource =
      editorModules["./components/site-settings-menu.tsx"] as string
    const pageSource = editorModules["./editor-page.tsx"] as string
    const drawerSource = readFileSync(
      new URL("../site-settings/components/site-settings-drawer.tsx", import.meta.url),
      "utf8",
    )

    expect(headerSource).toContain("EditorSiteSettingsMenu")
    expect(settingsMenuSource).toContain("SiteSettingsDrawer")
    expect(drawerSource).toContain("Appearance")
    expect(drawerSource).toContain("Tracking")
    expect(drawerSource).toContain("Variables")
    expect(drawerSource).toContain('w-[384px]')
    expect(pageSource).toContain("getSiteVariableUsageCounts")
    expect(pageSource).toContain("createSiteVariable")
    expect(pageSource).toContain("deleteSiteVariable")
    expect(pageSource).not.toContain("duplicateSiteMutation")
    expect(pageSource).not.toContain("deleteSiteMutation")
  })

  it("opens a persistent upgrade dialog when publishing is blocked by the Free plan", () => {
    const headerSource = editorModules["./components/editor-header.tsx"] as string
    const pageSource = editorModules["./editor-page.tsx"] as string
    const upgradeDialogSource =
      editorModules["./components/publish-upgrade-dialog.tsx"] as string

    expect(pageSource).toContain("PublishUpgradeDialog")
    expect(pageSource).toContain("setPublishUpgradeOpen(true)")
    expect(pageSource).not.toContain('toast.error("Upgrade to Core to publish.')
    expect(upgradeDialogSource).toContain("Upgrade to publish")
    expect(upgradeDialogSource).toContain("View Core plan")
    expect(upgradeDialogSource).toContain("canManageBilling")
    expect(headerSource).toContain("catch {")
    expect(headerSource).toContain("setOpen(false)")
  })

  it("keeps suggestion pointer hover separate from keyboard selection state", () => {
    const suggestionMenuSource =
      editorModules["./tiptap/extensions/suggestion-menu.ts"]
    const suggestionMenuViewSource =
      editorModules["./tiptap/extensions/suggestion-menu-view.tsx"]

    expect(suggestionMenuSource).toContain("new ReactRenderer")
    expect(suggestionMenuSource).toContain("renderer?.updateProps")
    expect(suggestionMenuSource).toContain("requestExit")
    expect(suggestionMenuSource).toContain("getSuggestionMenuHost")
    expect(suggestionMenuSource).toContain('closest("[data-editor-page]")')
    expect(suggestionMenuSource).toContain("activeSuggestionMenu")
    expect(suggestionMenuSource).toContain(
      "isLatestHandoutSuggestionTrigger(state, range)"
    )
    expect(suggestionMenuSource).toContain("exitSuggestion(editor.view, pluginKey)")
    expect(suggestionMenuSource).toContain(
      'document.addEventListener("pointerdown", handleOutsidePointerDown, true)'
    )
    expect(suggestionMenuSource).toContain(
      'window.addEventListener("keydown", handleDismissKeyDown)'
    )
    expect(suggestionMenuSource).not.toContain("hasActiveSuggestion")
    expect(suggestionMenuSource).not.toContain("document.body.append")
    expect(suggestionMenuViewSource).toContain("isPointerInside")
    expect(suggestionMenuSource).not.toContain("replaceChildren")
    expect(suggestionMenuViewSource).not.toContain("setPointerInteraction")
    expect(suggestionMenuViewSource).toContain("pointerInsideRef")
    expect(suggestionMenuViewSource).not.toContain("onPointerMove")
    expect(suggestionMenuViewSource).not.toContain("onMouseMove")
  })

  it("does not let markdown shortcut repair fight Tiptap trailing paragraphs", () => {
    const markdownShortcutsSource =
      editorModules["./tiptap/extensions/markdown-shortcuts.ts"]

    expect(markdownShortcutsSource).toContain("repairedText.length === 0")
    expect(markdownShortcutsSource).toContain("/^[\\s\\u00a0]+\\S/")
    expect(markdownShortcutsSource).not.toContain("/^[\\s\\u00a0]*$/")
  })

  it("only shows the text bubble menu for text selections", () => {
    const textBubbleMenuSource =
      editorModules["./components/text-bubble-menu.tsx"]

    expect(textBubbleMenuSource).toContain('from "@tiptap/pm/state"')
    expect(textBubbleMenuSource).toContain("selection instanceof TextSelection")
    expect(textBubbleMenuSource).toContain("hasSelectedText(state.selection)")
    expect(textBubbleMenuSource).toContain("appendTo={() => document.body}")
    expect(textBubbleMenuSource).toContain("useEditorState")
    expect(textBubbleMenuSource).toContain("if (!activeEditor || activeEditor.isDestroyed)")
    expect(textBubbleMenuSource).toContain("return emptyTextBubbleMenuState")
    expect(textBubbleMenuSource).toContain("setColor")
    expect(textBubbleMenuSource).toContain("setHighlight")
    expect(textBubbleMenuSource).toContain("unsetColor")
    expect(textBubbleMenuSource).toContain("unsetHighlight")
    expect(textBubbleMenuSource).toContain("ColorPickerMenu")
    expect(textBubbleMenuSource).toContain("ColorSpectrumSwatch")
    expect(textBubbleMenuSource).toContain('aria-label="Custom text color"')
    expect(textBubbleMenuSource).toContain('aria-label="Custom highlight color"')
    expect(textBubbleMenuSource).toContain('closest("[data-handout-color-picker-menu]")')
    expect(textBubbleMenuSource).toContain("setLink")
    expect(textBubbleMenuSource).not.toContain("!state.selection.empty")
  })
})
