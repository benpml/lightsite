import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "@tanstack/react-router"

import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { queryKeys } from "@/lib/api/query-keys"
import { listSites } from "@/features/sites/api"
import {
  coerceSelectedVariantId,
  editorVariants,
  initialEditorVariables,
  removeEditorVariant,
  type EditorVariable,
  type VariantRecord,
} from "./editor-data"
import {
  EditorCanvas,
  type EditorCanvasActions,
  type EditorCanvasState,
} from "./components/editor-canvas"
import { initialEditorContent, serializeEditorContent } from "./editor-document"
import { EditorHeader } from "./components/editor-header"
import { VariantsDialog } from "./components/variants-dialog"

type EditorChangeStatus = "idle" | "updating"
type EditorColorMode = "light" | "dark"

export function EditorPage() {
  const params = useParams({ strict: false })
  const siteId = "siteId" in params && typeof params.siteId === "string" ? params.siteId : ""
  const activeWorkspace = useActiveWorkspace()
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites(activeWorkspace.id),
    queryFn: ({ signal }) => listSites(signal),
  })
  const editorActionsRef = useRef<EditorCanvasActions>({
    redo: () => undefined,
    undo: () => undefined,
  })
  const [editorState, setEditorState] = useState<EditorCanvasState>(() => ({
    canRedo: false,
    canUndo: false,
    snapshot: serializeEditorContent(initialEditorContent),
  }))
  const currentSnapshot = editorState.snapshot
  const [savedSnapshot, setSavedSnapshot] = useState(currentSnapshot)
  const [preview, setPreview] = useState(false)
  const [variantsOpen, setVariantsOpen] = useState(false)
  const [variables] = useState<EditorVariable[]>(() =>
    initialEditorVariables.map((variable) => ({ ...variable }))
  )
  const [variants, setVariants] = useState<VariantRecord[]>(() =>
    editorVariants.map((variant) => ({
      ...variant,
      values: variant.values ? { ...variant.values } : undefined,
    }))
  )
  const [previewVariantId, setPreviewVariantId] = useState("default")
  const currentSite = sitesQuery.data?.sites.find((site) => site.id === siteId)
  const siteName = currentSite?.name ?? "Page draft"
  const siteSlug = currentSite?.slug ?? "page-draft"
  const changeStatus: EditorChangeStatus =
    currentSnapshot === savedSnapshot ? "idle" : "updating"

  const selectedPreviewVariantId = coerceSelectedVariantId(variants, previewVariantId)
  const previewVariant = variants.find((variant) => variant.id === selectedPreviewVariantId) ?? variants[0]
  const canUndo = editorState.canUndo
  const canRedo = editorState.canRedo
  const undo = useCallback(() => editorActionsRef.current.undo(), [])
  const redo = useCallback(() => editorActionsRef.current.redo(), [])

  useEffect(() => {
    if (currentSnapshot === savedSnapshot) {
      return
    }

    const saveTimeout = window.setTimeout(() => {
      setSavedSnapshot(currentSnapshot)
    }, 650)

    return () => window.clearTimeout(saveTimeout)
  }, [currentSnapshot, savedSnapshot])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target

      if (target instanceof HTMLElement && isEditableTarget(target)) {
        return
      }

      const isCommandKey = event.metaKey || event.ctrlKey

      if (!isCommandKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === "z" && !event.shiftKey && canUndo) {
        event.preventDefault()
        undo()
        return
      }

      if ((key === "y" || (key === "z" && event.shiftKey)) && canRedo) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canRedo, canUndo, redo, undo])

  const [colorMode] = useState<EditorColorMode>("light")

  function handleCreateVariant(variant: VariantRecord) {
    setVariants((currentVariants) => [...currentVariants, variant])
  }

  function handleUpdateVariant(variant: VariantRecord) {
    setVariants((currentVariants) =>
      currentVariants.map((currentVariant) =>
        currentVariant.id === variant.id ? variant : currentVariant
      )
    )
  }

  function handleDeleteVariant(variantId: string) {
    setVariants((currentVariants) => removeEditorVariant(currentVariants, variantId))
    setPreviewVariantId((currentPreviewVariantId) =>
      currentPreviewVariantId === variantId ? "default" : currentPreviewVariantId
    )
  }

  return (
    <div
      data-editor-page=""
      data-site-id={siteId}
      className="flex h-svh min-h-0 flex-col overflow-hidden bg-page-background"
    >
      <EditorHeader
        preview={preview}
        onPreviewChange={setPreview}
        onOpenVariants={() => setVariantsOpen(true)}
        selectedVariantName={previewVariant?.name ?? "Default Variant"}
        selectedVariantId={selectedPreviewVariantId}
        siteName={siteName}
        variants={variants}
        changeStatus={changeStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onSelectVariant={setPreviewVariantId}
      />
      <div className="min-h-0 flex-1 px-1.5 pb-1.5">
        <section className="h-full min-h-0 min-w-0 overflow-hidden rounded-xl border bg-background">
          <EditorCanvas
            content={initialEditorContent}
            colorMode={colorMode}
            onActionsChange={(actions) => {
              editorActionsRef.current = actions
            }}
            onStateChange={setEditorState}
            preview={preview}
            selectedVariant={preview ? previewVariant : undefined}
            variables={variables}
            workspaceLogoUrl={activeWorkspace.logoUrl}
            workspaceName={activeWorkspace.name}
            workspaceWebsiteDomain={activeWorkspace.websiteDomain}
          />
        </section>
      </div>
      <VariantsDialog
        open={variantsOpen}
        onOpenChange={setVariantsOpen}
        variants={variants}
        variables={variables}
        onCreateVariant={handleCreateVariant}
        onDeleteVariant={handleDeleteVariant}
        onUpdateVariant={handleUpdateVariant}
        siteSlug={siteSlug}
        workspaceSlug={activeWorkspace.slug}
      />
    </div>
  )
}

function isEditableTarget(target: HTMLElement) {
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
}
