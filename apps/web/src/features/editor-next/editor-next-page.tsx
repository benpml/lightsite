import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useEditor, useEditorState } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { toast } from "sonner"

import { useActiveWorkspace } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { archiveSite, duplicateSite, listSites, updateSite } from "@/features/sites/api"
import { queryKeys } from "@/lib/api/query-keys"
import { cn } from "@/lib/utils"
import { EditorNextCanvas } from "./components/editor-next-canvas"
import { EditorNextHeader } from "./components/editor-next-header"
import { EditorNextSiteSidebar } from "./components/site-sidebar"
import { RecipientShareDialog } from "./recipients/recipient-share-dialog"
import { useSiteRecipients } from "./recipients/use-site-recipients"
import {
  createEditorNextPage,
  createEditorNextSiteDraft,
  createSidebarButton,
  createSidebarLink,
  getEditorSidebarModel,
  normalizeSectionLabel,
  type EditorNextSidebarButtonStyle,
  type EditorNextSidebarSectionKey,
  type EditorNextSiteDraft,
} from "./site-sidebar-model"
import { createEditorNextExtensions } from "./tiptap/extensions"
import { initialEditorNextContent, type LightsiteVariableOption } from "./tiptap/schema"
import { getLightsiteVariableStorage } from "./tiptap/variable-state"
import { editorNextVariables, editorNextVariableValues } from "./tiptap/variables"
import type { EditorNextMode, EditorNextTheme, EditorNextThemeMode } from "./types"

const editorNextThemeStorageKey = "lightsite:editor-next-theme"

function readStoredThemeMode(): EditorNextThemeMode {
  if (typeof window === "undefined") {
    return "dark"
  }

  const storedThemeMode = window.localStorage.getItem(editorNextThemeStorageKey)

  return storedThemeMode === "light" ||
    storedThemeMode === "dark" ||
    storedThemeMode === "system"
    ? storedThemeMode
    : "dark"
}

function getSystemTheme(): EditorNextTheme {
  if (typeof window === "undefined") {
    return "dark"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

async function invalidateSiteQueries(
  queryClient: QueryClient,
  workspaceId: string,
  siteId: string
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.sites(workspaceId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.site(workspaceId, siteId) }),
  ])
}

export function EditorNextPage() {
  const params = useParams({ strict: false })
  const siteId = "siteId" in params && typeof params.siteId === "string" ? params.siteId : ""
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeWorkspace = useActiveWorkspace()
  const {
    createRecipient,
    deleteRecipient,
    recipients,
    siteUri,
    updateRecipient,
  } = useSiteRecipients({
    siteId,
    workspaceId: activeWorkspace.id,
  })
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [variableDefinitions, setVariableDefinitions] =
    useState<LightsiteVariableOption[]>(() =>
      getShareVariableDefinitions(null, editorNextVariables)
    )
  const [editorMode, setEditorMode] = useState<EditorNextMode>("edit")
  const [previewLines, setPreviewLines] = useState<string[]>([])
  const [themeMode, setThemeMode] = useState<EditorNextThemeMode>(readStoredThemeMode)
  const [systemTheme, setSystemTheme] = useState<EditorNextTheme>(getSystemTheme)
  const theme = themeMode === "system" ? systemTheme : themeMode
  const sitesQuery = useQuery({
    queryKey: queryKeys.sites(activeWorkspace.id),
    queryFn: ({ signal }) => listSites(signal),
  })
  const renameSiteMutation = useMutation({
    mutationFn: (name: string) => updateSite(siteId, { name }),
    onSuccess: async () => {
      await invalidateSiteQueries(queryClient, activeWorkspace.id, siteId)
      toast.success("Site renamed")
    },
  })
  const duplicateSiteMutation = useMutation({
    mutationFn: () => duplicateSite(siteId),
    onSuccess: async (data) => {
      await invalidateSiteQueries(queryClient, activeWorkspace.id, siteId)
      toast.success("Site duplicated")
      await navigate({
        to: "/editor-next/$siteId",
        params: { siteId: data.site.id },
      })
    },
  })
  const deleteSiteMutation = useMutation({
    mutationFn: () => archiveSite(siteId),
    onSuccess: async () => {
      await invalidateSiteQueries(queryClient, activeWorkspace.id, siteId)
      toast.success("Site deleted")
      await navigate({ to: "/sites" })
    },
  })
  const extensions = useMemo(
    () =>
      createEditorNextExtensions(editorNextVariables, editorNextVariableValues, "default", {
        workspaceLogoUrl: activeWorkspace.logoUrl,
        workspaceName: activeWorkspace.name,
        workspaceWebsiteDomain: activeWorkspace.websiteDomain,
      }),
    [activeWorkspace.logoUrl, activeWorkspace.name, activeWorkspace.websiteDomain]
  )
  const currentSite = sitesQuery.data?.sites.find((site) => site.id === siteId)
  const siteName = currentSite?.name ?? "Page draft"
  const [siteDraft, setSiteDraft] = useState<EditorNextSiteDraft>(() =>
    createEditorNextSiteDraft(siteName)
  )
  const [activePageId, setActivePageId] = useState(() => siteDraft.pages[0]?.id ?? "")
  const siteDraftRef = useRef(siteDraft)

  const editor = useEditor({
    extensions,
    content: initialEditorNextContent,
    immediatelyRender: false,
    autofocus: "start",
    editorProps: {
      attributes: {
        class: "lightsite-editor-next-prosemirror",
      },
    },
  })
  const editorState = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => ({
      canRedo: activeEditor?.can().redo() ?? false,
      canUndo: activeEditor?.can().undo() ?? false,
      isDirty: activeEditor ? !activeEditor.isEmpty : false,
    }),
  })

  const undo = useCallback(() => {
    editor?.chain().focus().undo().run()
  }, [editor])

  const redo = useCallback(() => {
    editor?.chain().focus().redo().run()
  }, [editor])

  const sidebarModel = useMemo(() => getEditorSidebarModel(siteDraft), [siteDraft])
  const activePageName = siteDraft.pages.find((page) => page.id === activePageId)?.name
  const sharePreviewLines = useMemo(
    () => previewLines.length > 0
      ? previewLines
      : [siteName, activePageName].filter((line): line is string => Boolean(line)),
    [activePageName, previewLines, siteName]
  )

  const renameSite = useCallback(
    (name: string) => renameSiteMutation.mutateAsync(name).then(() => undefined),
    [renameSiteMutation]
  )

  const duplicateCurrentSite = useCallback(
    () => duplicateSiteMutation.mutateAsync().then(() => undefined),
    [duplicateSiteMutation]
  )

  const deleteCurrentSite = useCallback(
    () => deleteSiteMutation.mutateAsync().then(() => undefined),
    [deleteSiteMutation]
  )

  const toggleTheme = useCallback(() => {
    setThemeMode((currentThemeMode) => {
      const currentTheme = currentThemeMode === "system" ? getSystemTheme() : currentThemeMode

      return currentTheme === "dark" ? "light" : "dark"
    })
  }, [])

  useEffect(() => {
    window.localStorage.setItem(editorNextThemeStorageKey, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light")

    updateSystemTheme()
    mediaQuery.addEventListener("change", updateSystemTheme)

    return () => {
      mediaQuery.removeEventListener("change", updateSystemTheme)
    }
  }, [])

  useEffect(() => {
    if (!editor) {
      return
    }

    const isEditing = editorMode === "edit"

    editor.setEditable(isEditing)
    editor.view.dispatch(
      editor.state.tr
        .setMeta("addToHistory", false)
        .setMeta("lightsiteEditorMode", editorMode)
    )

    if (!isEditing) {
      editor.commands.blur()
      window.getSelection()?.removeAllRanges()
    }
  }, [editor, editorMode])

  useEffect(() => {
    siteDraftRef.current = siteDraft
  }, [siteDraft])

  useEffect(() => {
    const root = document.documentElement
    const previousDarkState = root.classList.contains("dark")

    root.classList.toggle("dark", theme === "dark")

    return () => {
      root.classList.toggle("dark", previousDarkState)
    }
  }, [theme])

  useEffect(() => {
    if (!editor) {
      return
    }

    const syncVariables = () => {
      const nextDefinitions = getShareVariableDefinitions(
        editor.state.doc,
        getLightsiteVariableStorage(editor).definitions
      )
      const nextPreviewLines = getEditorPreviewLines(editor.state.doc, nextDefinitions)

      setVariableDefinitions((currentDefinitions) =>
        lightsiteVariablesAreEqual(currentDefinitions, nextDefinitions)
          ? currentDefinitions
          : nextDefinitions
      )
      setPreviewLines((currentLines) =>
        stringArraysAreEqual(currentLines, nextPreviewLines) ? currentLines : nextPreviewLines
      )
    }

    syncVariables()
    editor.on("transaction", syncVariables)

    return () => {
      editor.off("transaction", syncVariables)
    }
  }, [editor])

  const switchToPage = useCallback((pageId: string) => {
    if (!editor || pageId === activePageId) {
      return
    }

    const currentDraft = siteDraftRef.current
    const nextPage = currentDraft.pages.find((page) => page.id === pageId)

    if (!nextPage) {
      return
    }

    const now = new Date().toISOString()
    const currentPageBody = editor.getJSON()
    const nextDraft = {
      ...currentDraft,
      pages: currentDraft.pages.map((page) =>
        page.id === activePageId
          ? { ...page, body: currentPageBody, updatedAt: now }
          : page
      ),
    }

    siteDraftRef.current = nextDraft
    setSiteDraft(nextDraft)
    setActivePageId(pageId)
    editor.commands.setContent(nextPage.body, { emitUpdate: false })
    editor.commands.focus("start")
  }, [activePageId, editor])

  const addPage = useCallback(() => {
    if (!editor) {
      return
    }

    const currentDraft = siteDraftRef.current
    const now = new Date().toISOString()
    const pagesWithCurrentBody = currentDraft.pages.map((page) =>
      page.id === activePageId
        ? { ...page, body: editor.getJSON(), updatedAt: now }
        : page
    )
    const nextPage = createEditorNextPage("Untitled", pagesWithCurrentBody)
    const nextDraft = {
      ...currentDraft,
      pages: [...pagesWithCurrentBody, nextPage],
    }

    siteDraftRef.current = nextDraft
    setSiteDraft(nextDraft)
    setActivePageId(nextPage.id)
    editor.commands.setContent(nextPage.body, { emitUpdate: false })
    editor.commands.focus("start")
  }, [activePageId, editor])

  const renameSidebarSection = useCallback((
    section: EditorNextSidebarSectionKey,
    label: string
  ) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        sections: {
          ...currentDraft.sidebar.sections,
          [section]: { label: normalizeSectionLabel(section, label) },
        },
      },
    }))
  }, [])

  const renamePage = useCallback((pageId: string, name: string) => {
    const normalizedName = name.trim().replace(/\s+/g, " ")

    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      pages: currentDraft.pages.map((page) =>
        page.id === pageId
          ? { ...page, name: normalizedName || page.name, updatedAt: new Date().toISOString() }
          : page
      ),
    }))
  }, [])

  const deletePage = useCallback((pageId: string) => {
    if (!editor) {
      return
    }

    const currentDraft = siteDraftRef.current

    if (currentDraft.pages.length <= 1) {
      return
    }

    const deletedPageIndex = currentDraft.pages.findIndex((page) => page.id === pageId)

    if (deletedPageIndex === -1) {
      return
    }

    const now = new Date().toISOString()
    const remainingPages = currentDraft.pages
      .filter((page) => page.id !== pageId)
      .map((page) =>
        page.id === activePageId
          ? { ...page, body: editor.getJSON(), updatedAt: now }
          : page
      )

    const activePageWasDeleted = pageId === activePageId
    const nextActivePage = activePageWasDeleted
      ? remainingPages[Math.min(deletedPageIndex, remainingPages.length - 1)]
        ?? remainingPages[remainingPages.length - 1]
      : remainingPages.find((page) => page.id === activePageId)

    if (!nextActivePage) {
      return
    }

    const nextDraft = {
      ...currentDraft,
      pages: remainingPages.map((page, index) => ({
        ...page,
        sortOrder: index,
      })),
    }

    siteDraftRef.current = nextDraft
    setSiteDraft(nextDraft)

    if (activePageWasDeleted) {
      setActivePageId(nextActivePage.id)
      editor.commands.setContent(nextActivePage.body, { emitUpdate: false })
      editor.commands.focus("start")
    }
  }, [activePageId, editor])

  const addSidebarLink = useCallback((input: { label: string; href: string }) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: [
          ...currentDraft.sidebar.links,
          createSidebarLink(input, currentDraft.sidebar.links),
        ],
      },
    }))
  }, [])

  const updateSidebarLink = useCallback((
    linkId: string,
    input: { label: string; href: string }
  ) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: currentDraft.sidebar.links.map((link) =>
          link.id === linkId
            ? { ...link, label: input.label.trim(), href: input.href.trim() }
            : link
        ),
      },
    }))
  }, [])

  const deleteSidebarLink = useCallback((linkId: string) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: currentDraft.sidebar.links.filter((link) => link.id !== linkId),
      },
    }))
  }, [])

  const addSidebarButton = useCallback((input: {
    label: string
    href: string
    style: EditorNextSidebarButtonStyle
  }) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: [
          ...currentDraft.sidebar.nextSteps,
          createSidebarButton(input, currentDraft.sidebar.nextSteps),
        ],
      },
    }))
  }, [])

  const updateSidebarButton = useCallback((
    buttonId: string,
    input: { label: string; href: string; style: EditorNextSidebarButtonStyle }
  ) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: currentDraft.sidebar.nextSteps.map((button) =>
          button.id === buttonId
            ? {
                ...button,
                label: input.label.trim(),
                href: input.href.trim(),
                style: input.style,
              }
            : button
        ),
      },
    }))
  }, [])

  const deleteSidebarButton = useCallback((buttonId: string) => {
    setSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: currentDraft.sidebar.nextSteps.filter((button) => button.id !== buttonId),
      },
    }))
  }, [])

  return (
    <div
      data-editor-next-page=""
      data-editor-next-mode={editorMode}
      data-theme={theme}
      data-site-id={siteId}
      className={cn(theme, "flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground")}
    >
      <EditorNextHeader
        canRedo={editorState?.canRedo ?? false}
        canUndo={editorState?.canUndo ?? false}
        isDirty={editorState?.isDirty ?? false}
        isDeletingSite={deleteSiteMutation.isPending}
        isDuplicatingSite={duplicateSiteMutation.isPending}
        isRenamingSite={renameSiteMutation.isPending}
        mode={editorMode}
        onDeleteSite={deleteCurrentSite}
        onDuplicateSite={duplicateCurrentSite}
        onModeChange={setEditorMode}
        onRenameSite={renameSite}
        onShare={() => setShareDialogOpen(true)}
        onThemeModeChange={setThemeMode}
        siteName={siteName}
        theme={theme}
        themeMode={themeMode}
        onRedo={redo}
        onToggleTheme={toggleTheme}
        onUndo={undo}
      />
      <div className="flex min-h-0 flex-1 flex-col bg-background md:flex-row">
        <EditorNextSiteSidebar
          activePageId={activePageId}
          mode={editorMode}
          model={sidebarModel}
          onAddButton={addSidebarButton}
          onAddLink={addSidebarLink}
          onAddPage={addPage}
          onDeletePage={deletePage}
          onDeleteButton={deleteSidebarButton}
          onDeleteLink={deleteSidebarLink}
          onRenamePage={renamePage}
          onRenameSection={renameSidebarSection}
          onSelectPage={switchToPage}
          onUpdateButton={updateSidebarButton}
          onUpdateLink={updateSidebarLink}
        />
        <section className="h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
          {editor ? (
            <EditorNextCanvas editor={editor} mode={editorMode} />
          ) : (
            <div className="p-8 text-sm text-muted-foreground">Loading editor</div>
          )}
        </section>
      </div>
      <RecipientShareDialog
        createRecipient={createRecipient}
        deleteRecipient={deleteRecipient}
        onOpenChange={setShareDialogOpen}
        open={shareDialogOpen}
        recipients={recipients}
        siteUri={siteUri}
        siteName={siteName}
        updateRecipient={updateRecipient}
        previewLines={sharePreviewLines}
        variables={variableDefinitions}
      />
    </div>
  )
}

const systemShareVariableIds = new Set([
  "recipient-name",
  "recipient-company",
  "var-company-logo",
])

function getShareVariableDefinitions(
  doc: ProseMirrorNode | null,
  definitions: LightsiteVariableOption[]
) {
  const usedVariableIds = new Set<string>()

  doc?.descendants((node) => {
    if (node.type.name === "variableToken") {
      const variableId = node.attrs.variableId

      if (typeof variableId === "string" && variableId) {
        usedVariableIds.add(variableId)
      }
    }
  })

  return definitions.filter(
    (definition) =>
      systemShareVariableIds.has(definition.id) || usedVariableIds.has(definition.id)
  )
}

function getEditorPreviewLines(
  doc: ProseMirrorNode,
  definitions: LightsiteVariableOption[]
) {
  const lines: string[] = []

  doc.forEach((node) => {
    const line = getPreviewTextFromNode(node, definitions).trim().replace(/\s+/g, " ")

    if (line) {
      lines.push(line)
    }
  })

  return lines.slice(0, 4)
}

function getPreviewTextFromNode(
  node: ProseMirrorNode,
  definitions: LightsiteVariableOption[]
): string {
  if (node.isText) {
    return node.text ?? ""
  }

  if (node.type.name === "variableToken") {
    const variable = definitions.find((definition) => definition.id === node.attrs.variableId)

    return variable?.defaultValue || `{${variable?.name ?? node.attrs.fallbackName ?? "Variable"}}`
  }

  const parts: string[] = []

  node.forEach((child) => {
    parts.push(getPreviewTextFromNode(child, definitions))
  })

  return parts.join(" ")
}

function lightsiteVariablesAreEqual(
  left: LightsiteVariableOption[],
  right: LightsiteVariableOption[]
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((leftVariable, index) => {
    const rightVariable = right[index]

    return (
      rightVariable &&
      leftVariable.id === rightVariable.id &&
      leftVariable.name === rightVariable.name &&
      leftVariable.slug === rightVariable.slug &&
      leftVariable.description === rightVariable.description &&
      leftVariable.defaultValue === rightVariable.defaultValue
    )
  })
}

function stringArraysAreEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((value, index) => value === right[index])
}
