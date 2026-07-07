import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { createBlockContent } from "./tiptap/extensions/block-commands"
import { createAddedPageEmptyContent, createFirstPageEmptyContent } from "./tiptap/schema"

const forbiddenImports = [
  ["@", "features", "editor"].join("/"),
  ["@", "features", "editor", "tiptap"].join("/"),
  ["@", "features", "editor", "components", "editor-canvas"].join("/"),
  ["@", "features", "editor", "components", "editor-block-controls"].join("/"),
  ["..", "editor"].join("/"),
  ["..", "editor", "tiptap"].join("/"),
  ["..", "editor", "components", "editor-canvas"].join("/"),
  ["..", "editor", "components", "editor-block-controls"].join("/"),
]
const editorNextModules = import.meta.glob("./**/*.{ts,tsx}", {
  eager: true,
  query: "?raw",
  import: "default",
})
const stylesheetSource = readFileSync(new URL("../../index.css", import.meta.url), "utf8")

describe("editor-next architecture", () => {
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
    const canvasSource = editorNextModules["./components/editor-next-canvas.tsx"]
    const emptyStateSource = editorNextModules["./components/page-empty-state.tsx"]
    const emptyStateModelSource =
      editorNextModules["./components/page-empty-state-model.ts"]
    const schemaSource = editorNextModules["./tiptap/schema.ts"]

    expect(firstPageBody).toContain("pageTitleSection")
    expect(firstPageBody).not.toContain("Sites work like a doc.")
    expect(firstPageBody).not.toContain("Start from a template:")
    expect(addedPageBody).toContain('"heading"')
    expect(addedPageBody).not.toContain("Sites work like a doc.")
    expect(schemaSource).not.toContain("Sites work like a doc.")
    expect(canvasSource).toContain("EditorNextPageEmptyState")
    expect(emptyStateSource).toContain("Sites work like a doc.")
    expect(emptyStateSource).toContain("Start from a template:")
    expect(emptyStateModelSource).toContain("getEditorNextEmptyStateScaffold")
    expect(emptyStateModelSource).toContain("hasEditorNextBodyBlocksAfterScaffold")
    expect(emptyStateModelSource).not.toContain("doc.childCount !== 1")
  })

  it("keeps card placeholder text out of the Tiptap document content", () => {
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"] as string
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]

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
    expect(extensionSource).toContain("lightsite-next-card-placeholder-empty")
    expect(extensionSource).toContain("includeChildren: true")
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
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]

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
    expect(stylesheetSource).toContain(".lightsite-next-table")
    expect(stylesheetSource).toContain(".selectedCell")
    expect(stylesheetSource).toContain(".column-resize-handle")
    expect(extensionSource).toContain("isTableCellParagraph")
    expect(extensionSource).toContain("Type here")
  })

  it("keeps grid behavior in Tiptap schema, commands, and menus", () => {
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const blockNodesSource = editorNextModules["./tiptap/nodes/blocks.tsx"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const gridCommandsSource =
      editorNextModules["./tiptap/extensions/grid-commands.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]
    expect(schemaSource).toContain('"grid"')
    expect(schemaSource).toContain('"gridBlock"')
    expect(blockNodesSource).toContain('name: "gridBlock"')
    expect(blockNodesSource).toContain('content: "gridRow+"')
    expect(blockNodesSource).toContain('name: "gridRow"')
    expect(blockNodesSource).toContain('content: "gridCell+"')
    expect(blockNodesSource).toContain('name: "gridCell"')
    expect(blockNodesSource).toContain('content: "block+"')
    expect(extensionSource).toContain("GridCell")
    expect(extensionSource).toContain("GridRow")
    expect(extensionSource).toContain("GridBlock")
    expect(extensionSource).toContain("LightsiteNextGridCommands")
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
    expect(gridCommandsSource).toContain("addLightsiteNextGridColumn")
    expect(gridCommandsSource).toContain("addLightsiteNextGridRow")
    expect(gridCommandsSource).toContain("deleteLightsiteNextGridColumn")
    expect(gridCommandsSource).toContain("deleteLightsiteNextGridRow")
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
    expect(blockControlsSource).toContain("addLightsiteNextGridRow")
    expect(blockControlsSource).toContain("deleteLightsiteNextGridColumn")
    expect(blockControlsSource).toContain('storedTarget?.node.type.name === "gridBlock"')
    expect(blockControlsSource).toContain("isTargetInsideGrid")
    expect(blockControlsSource).toContain("resolveDeleteBlockTarget")
    expect(blockControlsSource).toContain("findSingleMeaningfulGridContentTarget")
    expect(blockControlsSource).toContain("for (let depth = $position.depth; depth > 0; depth -= 1)")
    expect(blockControlsSource).toContain("node.type.isInGroup(\"block\")")
    expect(stylesheetSource).toContain("[data-lightsite-grid-cell] > .react-renderer")
    expect(stylesheetSource).toContain("[data-lightsite-grid-cell] > :not(:last-child)")
    expect(stylesheetSource).toContain("p.lightsite-next-placeholder-hidden")
    expect(stylesheetSource).toContain("margin-bottom: 0")
    expect(stylesheetSource).toContain("p.lightsite-next-placeholder-hidden")
    expect(stylesheetSource).toContain(".react-renderer.node-imageCard")
    expect(stylesheetSource).toContain(".react-renderer.node-iconCard")
    expect(stylesheetSource).toContain(".react-renderer.node-testimonialCard")
  })

  it("does not import old editor behavior", async () => {
    const violations: string[] = []

    for (const [file, source] of Object.entries(editorNextModules)) {
      if (file.endsWith("editor-next-architecture.test.ts")) {
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

    for (const [file, source] of Object.entries(editorNextModules)) {
      if (file.endsWith("editor-next-architecture.test.ts")) {
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

    for (const [file, source] of Object.entries(editorNextModules)) {
      if (file.endsWith("editor-next-architecture.test.ts")) {
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

  it("keeps block selection behavior in Tiptap extensions", () => {
    const blockSelectionSource =
      editorNextModules["./tiptap/extensions/block-selection.ts"]
    const blockMarqueeSelectionSource =
      editorNextModules["./tiptap/extensions/block-marquee-selection.ts"]
    const selectionCleanupSource =
      editorNextModules["./tiptap/extensions/selection-cleanup.ts"]
    expect(blockSelectionSource).toContain("isNodeRangeSelection")
    expect(blockSelectionSource).toContain("handleKeyDown")
    expect(blockSelectionSource).toContain("Delete:")
    expect(blockSelectionSource).toContain("selection.ranges")
    expect(blockSelectionSource).toContain("getGridCellBlockRanges")
    expect(blockSelectionSource).toContain('type.name === "gridCell"')
    expect(blockSelectionSource).toContain("getGridCellReplacementRangeKeys")
    expect(blockSelectionSource).toContain("TextSelection.near")
    expect(blockMarqueeSelectionSource).toContain("NodeRangeSelection")
    expect(blockMarqueeSelectionSource).toContain("new Plugin")
    expect(blockMarqueeSelectionSource).toContain("if (!marquee.active && distance < MARQUEE_DRAG_THRESHOLD)")
    expect(blockMarqueeSelectionSource).toContain("event.preventDefault()")
    expect(blockMarqueeSelectionSource).toContain("return false")
    expect(blockMarqueeSelectionSource).toContain("nativeSelectionAllowed")
    expect(blockMarqueeSelectionSource).toContain("startsInsideTopLevelBlock")
    expect(blockMarqueeSelectionSource).toContain("if (!nativeSelectionAllowed)")
    expect(blockMarqueeSelectionSource).toContain(".lightsite-next-button-settings")
    expect(selectionCleanupSource).toContain(".lightsite-next-button-settings")
    expect(blockMarqueeSelectionSource).not.toContain("event.buttons === 0")
    expect(selectionCleanupSource).not.toContain(
      'querySelectorAll(".ProseMirror-selectednoderange")'
    )
  })

  it("keeps button create settings as a Tiptap draft preview instead of a detached form", () => {
    const buttonSettingsSource =
      editorNextModules["./tiptap/extensions/button-settings.ts"]
    const buttonSettingsPopoverSource =
      editorNextModules["./components/button-settings-popover.tsx"]

    expect(buttonSettingsSource).toContain("previewLightsiteNextButtonDraft")
    expect(buttonSettingsSource).toContain('setMeta("addToHistory", false)')
    expect(buttonSettingsPopoverSource).toContain("previewLightsiteNextButtonDraft")
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
      editorNextModules["./components/block-controls.tsx"]
    const blockViewsSource =
      editorNextModules["./tiptap/nodes/block-views.tsx"]
    const extensionSource =
      editorNextModules["./tiptap/extensions/index.ts"]
    const imageCardButtonSettingsSource =
      editorNextModules["./tiptap/extensions/image-card-button-settings.ts"]
    const imageCardButtonPopoverSource =
      editorNextModules["./components/image-card-button-settings-popover.tsx"]

    expect(extensionSource).toContain("LightsiteNextImageCardButtonSettings")
    expect(blockControlsSource).toContain("openLightsiteNextImageCardButtonSettings")
    expect(blockControlsSource).toContain("updateImageCardBlock")
    expect(blockControlsSource).toContain('label={menuTarget.node.attrs.src ? "Replace image" : "Upload image"}')
    expect(blockControlsSource).toContain('label="Button"')
    expect(blockControlsSource).toContain('label="Remove button"')
    expect(blockViewsSource).toContain("readImageFileAsAttrs")
    expect(blockViewsSource).toContain("loadImageDimensions")
    expect(blockViewsSource).toContain('setMeta("addToHistory", false)')
    expect(blockViewsSource).toContain("imageAspectRatio")
    expect(blockViewsSource).toContain("imageHeight: attrs.height")
    expect(blockViewsSource).toContain("imageWidth: attrs.width")
    expect(blockViewsSource).toContain('aria-hidden="true"')
    expect(blockViewsSource).toContain("hidden")
    expect(blockViewsSource).toContain('aria-label="Replace image"')
    expect(blockViewsSource).toContain("lightsite-next-image-card-replace-button")
    expect(blockViewsSource).toContain("lightsite-next-image-card-empty-button")
    expect(blockViewsSource).toContain("openLightsiteNextImageCardButtonSettings")
    expect(blockViewsSource).not.toContain("lightsite-next-image-card-shell py-2")
    expect(blockViewsSource).not.toContain('className="py-2"')
    expect(stylesheetSource).toContain("> .react-renderer.node-imageCard")
    expect(stylesheetSource).toContain("> .react-renderer.node-iconCard")
    expect(stylesheetSource).toContain("> .react-renderer.node-buttonBlock")
    expect(stylesheetSource).toContain("> .lightsite-next-image-card-shell")
    expect(imageCardButtonSettingsSource).toContain('node.type.name !== "imageCard"')
    expect(imageCardButtonSettingsSource).toContain("previewLightsiteNextImageCardButtonDraft")
    expect(imageCardButtonSettingsSource).toContain('"addToHistory"')
    expect(imageCardButtonSettingsSource).toContain("false")
    expect(imageCardButtonPopoverSource).toContain("normalizeButtonHref")
    expect(imageCardButtonPopoverSource).toContain("Enter button text.")
    expect(imageCardButtonPopoverSource).toContain("Enter a valid link.")
  })

  it("keeps logo grids as nested Tiptap nodes with logo media attrs only", () => {
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const blockNodesSource = editorNextModules["./tiptap/nodes/blocks.tsx"]
    const blockViewsSource = editorNextModules["./tiptap/nodes/block-views.tsx"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const cardNavigationSource =
      editorNextModules["./tiptap/extensions/card-navigation.ts"]
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]

    expect(schemaSource).toContain('"logoGrid"')
    expect(schemaSource).toContain('"logoGridItem"')
    expect(blockNodesSource).toContain('name: "logoGrid"')
    expect(blockNodesSource).toContain('content: "logoGridItem+"')
    expect(blockNodesSource).toContain('name: "logoGridItem"')
    expect(blockNodesSource).toContain('content: "logoGridItemTitle"')
    expect(blockNodesSource).toContain('name: "logoGridItemTitle"')
    expect(blockNodesSource).toContain("LogoGridView")
    expect(blockNodesSource).toContain("LogoGridItemView")
    expect(blockViewsSource).toContain("readImageFileAsAttrs")
    expect(blockViewsSource).toContain("getDevAuthBypassHeaders")
    expect(blockViewsSource).toContain("fetchLogoPreviewDataUrl")
    expect(blockViewsSource).toContain("/api/workspaces/logo-preview")
    expect(blockViewsSource).toContain("blobToDataUrl")
    expect(blockViewsSource).not.toContain("https://img.logo.dev")
    expect(blockViewsSource).toContain("data-lightsite-next-block-type=\"logo-grid\"")
    expect(blockViewsSource).toContain("data-has-logo={src ? \"true\" : undefined}")
    expect(blockViewsSource).toContain("lightsite-next-logo-grid-menu")
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
    expect(stylesheetSource).toContain(".react-renderer.node-logoGrid")
    expect(stylesheetSource).toContain(".lightsite-next-logo-grid")
    expect(stylesheetSource).toContain(".lightsite-next-logo-grid-item")
    expect(stylesheetSource).toContain(".lightsite-next-logo-grid-menu")
    expect(stylesheetSource).toContain(".lightsite-next-logo-grid-domain-control")
    expect(stylesheetSource).toContain("repeat(3, minmax(0, 1fr))")
  })

  it("registers official Tiptap extensions for editor-native document behavior", () => {
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const blockNodesSource = editorNextModules["./tiptap/nodes/blocks.tsx"]
    const blockViewsSource = editorNextModules["./tiptap/nodes/block-views.tsx"]
    const cardNavigationSource = editorNextModules["./tiptap/extensions/card-navigation.ts"]

    expect(extensionSource).toContain("@tiptap/extension-link")
    expect(extensionSource).toContain("@tiptap/extension-underline")
    expect(extensionSource).toContain("@tiptap/extension-typography")
    expect(extensionSource).toContain("@tiptap/extension-color")
    expect(extensionSource).toContain("@tiptap/extension-highlight")
    expect(extensionSource).toContain("@tiptap/extension-text-style")
    expect(extensionSource).toContain("@tiptap/extensions/trailing-node")
    expect(extensionSource).toContain("@tiptap/extension-emoji")
    expect(extensionSource).toContain("LightsiteImage")
    expect(extensionSource).toContain("LightsiteGif")
    expect(extensionSource).toContain("Emoji.configure")
    expect(extensionSource).toContain("TextStyle")
    expect(extensionSource).toContain("Color")
    expect(extensionSource).toContain("Highlight.configure")
    expect(extensionSource).toContain("multicolor: true")
    expect(extensionSource).toContain("LightsiteImage.configure")
    expect(extensionSource).toContain("LightsiteGif.configure")
    expect(extensionSource).toContain("LightsiteNextGifPicker")
    expect(extensionSource).toContain("resize: {")
    expect(extensionSource).toContain('directions: ["left", "right"]')
    expect(extensionSource).not.toContain('"top-left"')
    expect(extensionSource).not.toContain('"bottom-right"')
    expect(extensionSource).toContain("alwaysPreserveAspectRatio: true")
    expect(extensionSource).toContain("ListKeymap.configure")
    expect(extensionSource).toContain('itemName: "iconListItem"')
    expect(extensionSource).not.toContain("LightsiteNextIconListNavigation")
    expect(extensionSource).toContain("TaskList")
    expect(extensionSource).toContain("TaskItem.configure")
    expect(extensionSource).toContain("levels: [1, 2, 3]")
    expect(blockNodesSource).toContain("BulletList.extend")
    expect(blockNodesSource).toContain("ListItem.extend")
    expect(blockNodesSource).toContain("addInputRules()")
    expect(blockNodesSource).toContain('content: "imageCardTitle imageCardBody"')
    expect(blockNodesSource).toContain('name: "imageCardTitle"')
    expect(blockNodesSource).toContain('name: "imageCardBody"')
    expect(blockNodesSource).toContain('content: "iconCardTitle iconCardBody"')
    expect(blockNodesSource).toContain('name: "iconCardTitle"')
    expect(blockNodesSource).toContain('name: "iconCardBody"')
    expect(blockNodesSource).toContain('content: "pageTitleTitle pageTitleSubtitle"')
    expect(blockNodesSource).toContain('name: "pageTitleTitle"')
    expect(blockNodesSource).toContain('name: "pageTitleSubtitle"')
    expect(blockNodesSource).toContain(
      'content: "testimonialAuthorName testimonialAuthorRole testimonialQuote"'
    )
    expect(blockNodesSource).toContain('name: "testimonialAuthorName"')
    expect(blockNodesSource).toContain('name: "testimonialAuthorRole"')
    expect(blockNodesSource).toContain('name: "testimonialQuote"')
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

  it("exposes emoji through Tiptap block commands and slash suggestions", () => {
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]

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
    expect(extensionSource).toContain("createLightsiteNextEmojiSuggestion")
    expect(suggestionMenuSource).toContain('id: "heading3"')
    expect(suggestionMenuSource).toContain('id: "emoji"')
    expect(suggestionMenuSource).toContain("filterEmojiItems")
  })

  it("exposes native resizable images through Tiptap block commands and slash suggestions", () => {
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"] as string
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]
    const imageNodeSource =
      editorNextModules["./tiptap/nodes/lightsite-image.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
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
    expect(imageNodeSource).toContain("dataset.lightsiteImageEmpty")
    expect(imageNodeSource).toContain('input.ariaHidden = "true"')
    expect(imageNodeSource).toContain("input.hidden = true")
    expect(imageNodeSource).toContain("Click or drag an image file here")
    expect(imageNodeSource).toContain("ResizableNodeView")
    expect(imageNodeSource).toContain("applyImageElementAttributes")
    expect(imageNodeSource).toContain('element.style.height = "auto"')
    expect(imageNodeSource).toContain("getBoundingClientRect")
    expect(imageNodeSource).not.toContain("element.style.height = `${height}px`")
    expect(blockControlsSource).toContain('updateAttributes("image"')
    expect(blockControlsSource).toContain("readImageFileAsAttrs")
    expect(blockControlsSource).toContain('aria-hidden="true"')
    expect(blockControlsSource).toContain("hidden")
    expect(blockControlsSource).toContain("Replace from URL")
    expect(suggestionMenuSource).toContain('id: "image"')
  })

  it("exposes GIFs as native Tiptap selectable and resizable nodes with a GIPHY picker", () => {
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"] as string
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorNextModules["./components/editor-next-canvas.tsx"]
    const gifNodeSource =
      editorNextModules["./tiptap/nodes/lightsite-gif.ts"]
    const gifPickerSource =
      editorNextModules["./tiptap/extensions/gif-picker.ts"]
    const giphySource =
      editorNextModules["./tiptap/giphy.ts"]

    expect(blockCommandsSource).toContain('type: "gifBlock"')
    expect(blockCommandsSource).not.toContain("media.giphy.com")
    expect(blockCommandsSource).toContain("openLightsiteNextGifPicker")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "gifBlock"')
    expect(gifNodeSource).toContain("ResizableNodeView")
    expect(gifNodeSource).toContain("selectable: true")
    expect(gifNodeSource).toContain("draggable: true")
    expect(gifNodeSource).toContain("dataset.lightsiteGifEmpty")
    expect(gifNodeSource).toContain("Search GIPHY")
    expect(gifNodeSource).toContain('element.style.height = "auto"')
    expect(gifPickerSource).toContain("setLightsiteNextGif")
    expect(gifPickerSource).toContain("subscribe")
    expect(editorCanvasSource).toContain("EditorNextGifPickerDialog")
    expect(blockControlsSource).toContain('node.type.name === "gifBlock"')
    expect(blockControlsSource).toContain("Change GIF")
    expect(giphySource).toContain("@giphy/js-fetch-api")
    expect(giphySource).toContain("VITE_GIPHY_API_KEY")
  })

  it("keeps calendar embeds on a custom Tiptap iframe extension path", () => {
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorNextModules["./components/editor-next-canvas.tsx"]
    const calendarNodeSource =
      editorNextModules["./tiptap/nodes/calendar-embed.tsx"]
    const calendarNodeViewSource =
      editorNextModules["./tiptap/nodes/calendar-embed-view.tsx"]
    const calendarSettingsSource =
      editorNextModules["./tiptap/extensions/calendar-embed-settings.ts"]
    const calendarMenuSource =
      editorNextModules["./components/calendar-embed-settings-menu.tsx"]
    const embedUrlSource = editorNextModules["./lib/embed-url.ts"]
    const calendarFrameStyles = stylesheetSource.slice(
      stylesheetSource.indexOf(".lightsite-next-calendar-embed-frame"),
      stylesheetSource.indexOf(".lightsite-next-calendar-settings-menu")
    )

    expect(schemaSource).toContain('"calendar"')
    expect(schemaSource).toContain('"calendarEmbed"')
    expect(extensionSource).toContain("CalendarEmbed")
    expect(extensionSource).toContain("LightsiteNextCalendarEmbedSettings")
    expect(blockCommandsSource).toContain('type: "calendarEmbed"')
    expect(blockCommandsSource).toContain("openLightsiteNextCalendarEmbedSettings")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "calendarEmbed"')
    expect(suggestionMenuSource).toContain('id: "calendar"')
    expect(suggestionMenuSource).toContain("IconCalendarEvent")
    expect(suggestionMenuSource).toContain("openLightsiteNextCalendarEmbedSettings")
    expect(blockControlsSource).toContain('node.type.name === "calendarEmbed"')
    expect(blockControlsSource).toContain("Edit calendar")
    expect(editorCanvasSource).toContain("EditorNextCalendarEmbedSettingsMenu")
    expect(calendarNodeSource).toContain('name: "calendarEmbed"')
    expect(calendarNodeSource).toContain("atom: true")
    expect(calendarNodeSource).toContain("draggable: true")
    expect(calendarNodeViewSource).toContain("<iframe")
    expect(calendarSettingsSource).toContain("setLightsiteNextCalendarEmbedAttrs")
    expect(calendarSettingsSource).toContain("removeLightsiteNextCalendarEmbedDraft")
    expect(calendarMenuSource).toContain("lightsite-next-calendar-settings-menu")
    expect(calendarMenuSource).toContain("normalizeIframeEmbedUrl")
    expect(calendarMenuSource).not.toContain("Dialog")
    expect(calendarMenuSource).not.toContain("titleDraft")
    expect(embedUrlSource).toContain("extractIframeSrc")
    expect(embedUrlSource).toContain('["http:", "https:"]')
    expect(stylesheetSource).toContain(".react-renderer.node-calendarEmbed")
    expect(stylesheetSource).toContain(".lightsite-next-calendar-embed-frame")
    expect(stylesheetSource).toContain(".lightsite-next-calendar-settings-menu")
    expect(calendarFrameStyles).not.toContain("pointer-events: none")
  })

  it("keeps video embeds on a custom Tiptap iframe extension path", () => {
    const schemaSource = editorNextModules["./tiptap/schema.ts"]
    const extensionSource = editorNextModules["./tiptap/extensions/index.ts"]
    const blockCommandsSource =
      editorNextModules["./tiptap/extensions/block-commands.ts"]
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"]
    const editorCanvasSource =
      editorNextModules["./components/editor-next-canvas.tsx"]
    const videoNodeSource =
      editorNextModules["./tiptap/nodes/video-embed.tsx"]
    const videoNodeViewSource =
      editorNextModules["./tiptap/nodes/video-embed-view.tsx"]
    const videoSettingsSource =
      editorNextModules["./tiptap/extensions/video-embed-settings.ts"]
    const videoMenuSource =
      editorNextModules["./components/video-embed-settings-menu.tsx"]
    const videoUrlSource = editorNextModules["./lib/video-embed-url.ts"]
    const videoFrameStyles = stylesheetSource.slice(
      stylesheetSource.indexOf(".lightsite-next-video-embed-frame"),
      stylesheetSource.indexOf(".lightsite-next-calendar-settings-menu")
    )

    expect(schemaSource).toContain('"video"')
    expect(schemaSource).toContain('"videoEmbed"')
    expect(extensionSource).toContain("VideoEmbed")
    expect(extensionSource).toContain("LightsiteNextVideoEmbedSettings")
    expect(blockCommandsSource).toContain('type: "videoEmbed"')
    expect(blockCommandsSource).toContain("openLightsiteNextVideoEmbedSettings")
    expect(blockCommandsSource).toContain('insertedNode?.type.name === "videoEmbed"')
    expect(suggestionMenuSource).toContain('id: "video"')
    expect(suggestionMenuSource).toContain("IconVideo")
    expect(suggestionMenuSource).toContain("openLightsiteNextVideoEmbedSettings")
    expect(blockControlsSource).toContain('node.type.name === "videoEmbed"')
    expect(blockControlsSource).toContain("Edit video")
    expect(editorCanvasSource).toContain("EditorNextVideoEmbedSettingsMenu")
    expect(videoNodeSource).toContain('name: "videoEmbed"')
    expect(videoNodeSource).toContain("atom: true")
    expect(videoNodeSource).toContain("draggable: true")
    expect(videoNodeViewSource).toContain("<iframe")
    expect(videoSettingsSource).toContain("setLightsiteNextVideoEmbedAttrs")
    expect(videoSettingsSource).toContain("removeLightsiteNextVideoEmbedDraft")
    expect(videoMenuSource).toContain("lightsite-next-video-settings-menu")
    expect(videoMenuSource).toContain("normalizeVideoEmbedUrl")
    expect(videoMenuSource).not.toContain("Dialog")
    expect(videoUrlSource).toContain("normalizeYouTubeUrl")
    expect(videoUrlSource).toContain("normalizeVimeoUrl")
    expect(videoUrlSource).toContain("normalizeLoomUrl")
    expect(stylesheetSource).toContain(".react-renderer.node-videoEmbed")
    expect(stylesheetSource).toContain(".lightsite-next-video-embed-frame")
    expect(stylesheetSource).toContain(".lightsite-next-video-settings-menu")
    expect(videoFrameStyles).not.toContain("pointer-events: none")
  })

  it("keeps block settings before duplicate/delete and turn-into options", () => {
    const blockControlsSource =
      editorNextModules["./components/block-controls.tsx"] as string

    expect(blockControlsSource.indexOf('node.type.name === "image"')).toBeLessThan(
      blockControlsSource.indexOf('label="Duplicate"')
    )
    expect(blockControlsSource.indexOf('label="Duplicate"')).toBeLessThan(
      blockControlsSource.indexOf('lightsite-next-block-menu-label">Turn into')
    )
  })

  it("uses centered canonical edit/preview tabs with outline share and primary publish actions", () => {
    const headerSource =
      editorNextModules["./components/editor-next-header.tsx"] as string

    expect(headerSource).toContain('import { Tabs, TabsList, TabsTrigger }')
    expect(headerSource).toContain('<EditorModeTabs mode={mode} onModeChange={onModeChange} />')
    expect(headerSource).toContain('value="edit"')
    expect(headerSource).toContain('value="preview"')
    expect(headerSource).toContain('rounded-full')
    expect(headerSource).not.toContain("IconEye")
    expect(headerSource).toContain("Share")
    expect(headerSource).toContain('<Button size="compact">Publish</Button>')
    expect(headerSource).not.toContain('<Button variant="secondary" size="compact">Publish</Button>')
  })

  it("keeps site settings actions in the editor-next header menu", () => {
    const headerSource =
      editorNextModules["./components/editor-next-header.tsx"] as string
    const settingsMenuSource =
      editorNextModules["./components/site-settings-menu.tsx"] as string
    const pageSource = editorNextModules["./editor-next-page.tsx"] as string
    const sitesApiSource = readFileSync(new URL("../sites/api.ts", import.meta.url), "utf8")

    expect(headerSource).toContain("EditorNextSiteSettingsMenu")
    expect(settingsMenuSource).toContain("Site settings")
    expect(settingsMenuSource).toContain("Rename site")
    expect(settingsMenuSource).toContain("Duplicate site")
    expect(settingsMenuSource).toContain("Color themes")
    expect(settingsMenuSource).toContain("Delete site")
    expect(settingsMenuSource).toContain('"dark"')
    expect(settingsMenuSource).toContain('"light"')
    expect(settingsMenuSource).toContain('"system"')
    expect(settingsMenuSource).toContain('"delete site"')
    expect(settingsMenuSource).toContain("AlertDialogAction")
    expect(pageSource).toContain("setThemeMode")
    expect(pageSource).toContain("duplicateSiteMutation")
    expect(pageSource).toContain("deleteSiteMutation")
    expect(sitesApiSource).toContain("`/api/sites/${siteId}/duplicate`")
    expect(sitesApiSource).toContain("`/api/sites/${siteId}/archive`")
  })

  it("keeps suggestion pointer hover separate from keyboard selection state", () => {
    const suggestionMenuSource =
      editorNextModules["./tiptap/extensions/suggestion-menu.ts"]
    const suggestionMenuViewSource =
      editorNextModules["./tiptap/extensions/suggestion-menu-view.tsx"]

    expect(suggestionMenuSource).toContain("new ReactRenderer")
    expect(suggestionMenuSource).toContain("renderer?.updateProps")
    expect(suggestionMenuSource).toContain("requestExit")
    expect(suggestionMenuSource).toContain("getSuggestionMenuHost")
    expect(suggestionMenuSource).toContain('closest("[data-editor-next-page]")')
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
      editorNextModules["./tiptap/extensions/markdown-shortcuts.ts"]

    expect(markdownShortcutsSource).toContain("repairedText.length === 0")
    expect(markdownShortcutsSource).toContain("/^[\\s\\u00a0]+\\S/")
    expect(markdownShortcutsSource).not.toContain("/^[\\s\\u00a0]*$/")
  })

  it("only shows the text bubble menu for text selections", () => {
    const textBubbleMenuSource =
      editorNextModules["./components/text-bubble-menu.tsx"]

    expect(textBubbleMenuSource).toContain('from "@tiptap/pm/state"')
    expect(textBubbleMenuSource).toContain("selection instanceof TextSelection")
    expect(textBubbleMenuSource).toContain("hasSelectedText(state.selection)")
    expect(textBubbleMenuSource).toContain("useEditorState")
    expect(textBubbleMenuSource).toContain("setColor")
    expect(textBubbleMenuSource).toContain("setHighlight")
    expect(textBubbleMenuSource).toContain("unsetColor")
    expect(textBubbleMenuSource).toContain("unsetHighlight")
    expect(textBubbleMenuSource).toContain("setLink")
    expect(textBubbleMenuSource).not.toContain("!state.selection.empty")
  })
})
