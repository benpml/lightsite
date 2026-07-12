import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useEditor, useEditorState } from "@tiptap/react"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import type { Transaction } from "@tiptap/pm/state"
import type { ListSitesResponse } from "@lightsite/contracts"
import { getSitePageCollaborationField } from "@lightsite/site-document"
import {
  LIGHTSITE_COLLECTION_LIMITS,
  clampTextToLimit,
} from "@lightsite/domain"
import { toast } from "sonner"

import {
  useActiveWorkspace,
  useAppBootstrap,
} from "@/features/app-bootstrap/app-bootstrap-hooks"
import {
  deleteSite,
  duplicateSite,
  listSites,
  publishSite,
  updateSite,
} from "@/features/sites/api"
import { queryKeys } from "@/lib/api/query-keys"
import { getApiErrorMessage, isApiClientError } from "@/lib/api/errors"
import { cn } from "@/lib/utils"
import { EditorCanvas } from "./components/editor-canvas"
import { EditorHeader, type EditorPublishStatus } from "./components/editor-header"
import { EditorSitePreview } from "./components/site-preview"
import { EditorSiteSidebar } from "./components/site-sidebar"
import { RecipientShareDialog } from "./recipients/recipient-share-dialog"
import { useSiteRecipients } from "./recipients/use-site-recipients"
import {
  createEditorPage,
  createEditorSiteDraft,
  createSidebarButton,
  createSidebarLink,
  getEditorSidebarModel,
  normalizeSectionLabel,
  type EditorSidebarButtonStyle,
  type EditorSidebarSectionKey,
  type EditorSiteDraft,
} from "./site-sidebar-model"
import { createEditorExtensions } from "./tiptap/extensions"
import { initialEditorContent, type LightsiteVariableOption } from "./tiptap/schema"
import { getLightsiteVariableStorage } from "./tiptap/variable-state"
import { editorVariables, editorVariableValues } from "./tiptap/variables"
import type { EditorMode, SiteTheme, SiteThemeMode } from "./types"
import { useSiteCollaboration } from "./use-site-collaboration"

const editorProps = {
  attributes: {
    class: "lightsite-editor-prosemirror ls-prosemirror",
  },
} as const

function getSystemTheme(): SiteTheme {
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
    queryClient.invalidateQueries({ queryKey: queryKeys.siteContent(workspaceId, siteId) }),
  ])
}

function editorBodiesAreEqual(firstBody: unknown, secondBody: unknown) {
  return JSON.stringify(withoutTrailingEditorParagraph(firstBody)) ===
    JSON.stringify(withoutTrailingEditorParagraph(secondBody))
}

function withoutTrailingEditorParagraph(body: unknown) {
  if (!body || typeof body !== "object") {
    return body
  }

  const document = normalizeEditorNodeForComparison(body)
  if (document.type !== "doc" || !Array.isArray(document.content)) {
    return document
  }

  const content = [...document.content]
  const trailingNode = content.at(-1)

  if (
    trailingNode &&
    typeof trailingNode === "object" &&
    (trailingNode as { type?: unknown }).type === "paragraph" &&
    !Array.isArray((trailingNode as { content?: unknown }).content)
  ) {
    content.pop()
  }

  return { ...document, content }
}

function normalizeEditorNodeForComparison(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  const node = value as Record<string, unknown>
  const normalized: Record<string, unknown> = {}

  for (const [key, entry] of Object.entries(node)) {
    if (key === "attrs" && entry && typeof entry === "object" && !Array.isArray(entry)) {
      const attrs = Object.fromEntries(
        Object.entries(entry as Record<string, unknown>)
          .filter(([attribute]) => attribute !== "id")
          .sort(([left], [right]) => left.localeCompare(right))
      )

      if (Object.keys(attrs).length > 0) {
        normalized.attrs = attrs
      }
      continue
    }

    if (key === "content" && Array.isArray(entry)) {
      if (entry.length > 0) {
        normalized.content = entry.map(normalizeEditorNodeForComparison)
      }
      continue
    }

    normalized[key] = entry
  }

  return normalized
}

export function EditorPage() {
  const params = useParams({ strict: false })
  const siteId = "siteId" in params && typeof params.siteId === "string" ? params.siteId : ""
  const bootstrap = useAppBootstrap()
  const collaboration = useSiteCollaboration({ bootstrap, siteId })

  if (!collaboration.isReady) {
    return (
      <div className="flex h-svh items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        {collaboration.saveStatus === "offline"
          ? "Reconnect to load this site on this device."
          : collaboration.saveStatus === "unavailable"
            ? "This collaborative editor could not be opened."
            : "Opening collaborative editor…"}
      </div>
    )
  }

  return <ReadyEditorPage collaboration={collaboration} siteId={siteId} />
}

function ReadyEditorPage({
  collaboration,
  siteId,
}: {
  collaboration: ReturnType<typeof useSiteCollaboration>
  siteId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const activeWorkspace = useActiveWorkspace()
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [variableDefinitions, setVariableDefinitions] =
    useState<LightsiteVariableOption[]>(() =>
      getShareVariableDefinitions(null, editorVariables)
    )
  const variableDefinitionsRef = useRef(variableDefinitions)
  const [editorMode, setEditorMode] = useState<EditorMode>("edit")
  const [documentRevision, setDocumentRevision] = useState(0)
  const [systemTheme, setSystemTheme] = useState<SiteTheme>(getSystemTheme)
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
        to: "/edit/$siteId",
        params: { siteId: data.site.id },
      })
    },
  })
  const deleteSiteMutation = useMutation({
    mutationFn: () => deleteSite(siteId),
    onSuccess: async () => {
      await invalidateSiteQueries(queryClient, activeWorkspace.id, siteId)
      toast.success("Site deleted")
      await navigate({ to: "/sites" })
    },
  })
  const publishSiteMutation = useMutation({
    mutationFn: async () => {
      await collaboration.saveNow()
      return publishSite(siteId)
    },
    onSuccess: async (data) => {
      const nextSnapshotKey = `${siteId}:${data.site.publishedAt ?? "published"}`

      publishSnapshotRef.current = {
        isPublished: true,
        key: nextSnapshotKey,
      }
      setUnpublishedChangeKey(null)
      queryClient.setQueryData<ListSitesResponse>(
        queryKeys.sites(activeWorkspace.id),
        (currentData) => {
          if (!currentData) {
            return currentData
          }

          return {
            ...currentData,
            sites: currentData.sites.map((site) =>
              site.id === siteId
                ? {
                    ...site,
                    name: data.site.name,
                    slug: data.site.slug,
                    status: data.site.status,
                    updatedAt: data.site.updatedAt,
                    publishedAt: data.site.publishedAt,
                  }
                : site
            ),
          }
        }
      )
      await invalidateSiteQueries(queryClient, activeWorkspace.id, siteId)
      toast.success("Site published")
    },
    onError: (error) => {
      if (isApiClientError(error) && error.code === "billing.upgrade_required") {
        toast.error("Upgrade to Core to publish.", {
          action: {
            label: "View plans",
            onClick: () => void navigate({ to: "/billing" }),
          },
        })
        return
      }

      const firstIssue = isApiClientError(error) ? error.issues[0]?.message : null

      toast.error(firstIssue ?? getApiErrorMessage(error, "Site could not be published."))
    },
  })
  const currentSite = sitesQuery.data?.sites.find((site) => site.id === siteId)
  const {
    createRecipient,
    deleteRecipient,
    recipients,
    siteUri,
    updateRecipient,
  } = useSiteRecipients({
    siteId,
    siteUri: currentSite
      ? `${activeWorkspace.slug}/${currentSite.slug}`
      : undefined,
    workspaceId: activeWorkspace.id,
  })
  const siteIsPublished = currentSite?.status === "published"
  const siteName = currentSite?.name ?? "Page draft"
  const fallbackSiteDraft = useMemo(() => createEditorSiteDraft(siteName), [siteName])
  const siteDraft = collaboration.siteDraft ?? fallbackSiteDraft
  const publishSnapshotKey = siteIsPublished
    ? `${siteId}:${currentSite?.publishedAt ?? "published"}`
    : ""
  const [unpublishedChangeKey, setUnpublishedChangeKey] = useState<string | null>(null)
  const hasUnpublishedChanges = siteIsPublished && unpublishedChangeKey === publishSnapshotKey
  const siteThemeMode = siteDraft.themeMode
  const siteTheme = siteThemeMode === "system" ? systemTheme : siteThemeMode
  const [activePageId, setActivePageId] = useState(
    () => collaboration.siteDraft?.pages[0]?.id ?? ""
  )
  const publishSnapshotRef = useRef({
    isPublished: siteIsPublished,
    key: publishSnapshotKey,
  })
  const siteDraftRef = useRef(siteDraft)
  const observedMetadataRevisionRef = useRef<number | null>(null)

  const markUnpublishedChanges = useCallback(() => {
    const snapshot = publishSnapshotRef.current

    if (snapshot.isPublished && snapshot.key) {
      setUnpublishedChangeKey(snapshot.key)
    }
  }, [])

  const updateSiteDraft = useCallback((
    updater: SetStateAction<EditorSiteDraft>,
    options: { markUnpublishedChanges?: boolean } = {}
  ) => {
    const shouldMarkUnpublishedChanges = options.markUnpublishedChanges ?? true

    collaboration.updateSiteDraft((currentDraft) => {
      const nextDraft = typeof updater === "function"
        ? updater(currentDraft)
        : updater

      siteDraftRef.current = nextDraft

      return nextDraft
    })

    if (shouldMarkUnpublishedChanges) {
      markUnpublishedChanges()
    }
  }, [collaboration.updateSiteDraft, markUnpublishedChanges])

  const collaborationEditorConfig = useMemo(
    () => collaboration.isReady && activePageId
      ? {
        document: collaboration.document,
        field: getSitePageCollaborationField(activePageId),
        provider: collaboration.provider,
        user: collaboration.localUser,
        undoManager: collaboration.getPageUndoManager(activePageId),
      }
      : undefined,
    [
      activePageId,
      collaboration.document,
      collaboration.getPageUndoManager,
      collaboration.isReady,
      collaboration.localUser,
      collaboration.provider,
    ],
  )
  const extensions = useMemo(
    () => createEditorExtensions(
      editorVariables,
      editorVariableValues,
      "default",
      {
        workspaceLogoUrl: activeWorkspace.logoUrl,
        workspaceName: activeWorkspace.name,
        workspaceWebsiteDomain: activeWorkspace.websiteDomain,
      },
      collaborationEditorConfig,
    ),
    [
      activeWorkspace.logoUrl,
      activeWorkspace.name,
      activeWorkspace.websiteDomain,
      collaborationEditorConfig,
    ],
  )

  const editor = useEditor({
    extensions,
    content: collaborationEditorConfig ? undefined : initialEditorContent,
    immediatelyRender: false,
    autofocus: "start",
    onUpdate: ({ editor: updatedEditor }) => {
      const persistedPage = siteDraftRef.current.pages.find((page) => page.id === activePageId)

      if (!persistedPage || !editorBodiesAreEqual(persistedPage.document, updatedEditor.getJSON())) {
        markUnpublishedChanges()
      }
    },
    editorProps,
  }, [activePageId, collaboration.isReady, collaboration.document, collaboration.provider])
  const activeEditor = editor && !editor.isDestroyed ? editor : null
  const editorState = useEditorState({
    editor: activeEditor,
    selector: ({ editor: currentEditor }) => ({
      canRedo: currentEditor && !currentEditor.isDestroyed
        ? currentEditor.can().redo()
        : false,
      canUndo: currentEditor && !currentEditor.isDestroyed
        ? currentEditor.can().undo()
        : false,
    }),
  })

  const undo = useCallback(() => {
    editor?.chain().focus().undo().run()
  }, [editor])

  const redo = useCallback(() => {
    editor?.chain().focus().redo().run()
  }, [editor])

  const sidebarModel = useMemo(() => getEditorSidebarModel(siteDraft), [siteDraft])
  const activePageIndex = siteDraft.pages.findIndex((page) => page.id === activePageId)
  const emptyStateFallbackKind = activePageIndex > 0 ? "added-page" : "first-page"
  const publishStatus: EditorPublishStatus = siteIsPublished
    ? hasUnpublishedChanges
      ? "unpublished-changes"
      : "published"
    : "unpublished"
  const publicSiteUrl = useMemo(
    () => getPublicSiteUrl(activeWorkspace.slug, currentSite?.slug ?? ""),
    [activeWorkspace.slug, currentSite?.slug]
  )
  const publicSiteDisplayUrl = useMemo(
    () => getPublicSiteDisplayUrl(activeWorkspace.slug, currentSite?.slug ?? ""),
    [activeWorkspace.slug, currentSite?.slug]
  )

  const renameSite = useCallback(
    (name: string) => renameSiteMutation.mutateAsync(name).then(() => undefined),
    [renameSiteMutation.mutateAsync]
  )

  const duplicateCurrentSite = useCallback(
    () => duplicateSiteMutation.mutateAsync().then(() => undefined),
    [duplicateSiteMutation.mutateAsync]
  )

  const deleteCurrentSite = useCallback(
    () => deleteSiteMutation.mutateAsync().then(() => undefined),
    [deleteSiteMutation.mutateAsync]
  )

  const publishCurrentSite = useCallback(
    () => publishSiteMutation.mutateAsync().then(() => undefined),
    [publishSiteMutation.mutateAsync]
  )

  const openShareDialog = useCallback(() => {
    setShareDialogOpen(true)
  }, [])

  const setSiteThemeMode = useCallback((mode: SiteThemeMode) => {
    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      themeMode: mode,
    }))
  }, [updateSiteDraft])

  const toggleSiteTheme = useCallback(() => {
    updateSiteDraft((currentDraft) => {
      const currentThemeMode = currentDraft.themeMode
      const currentTheme = currentThemeMode === "system" ? getSystemTheme() : currentThemeMode

      return {
        ...currentDraft,
        themeMode: currentTheme === "dark" ? "light" : "dark",
      }
    })
  }, [updateSiteDraft])

  useEffect(() => {
    publishSnapshotRef.current = {
      isPublished: siteIsPublished,
      key: publishSnapshotKey,
    }
  }, [publishSnapshotKey, siteIsPublished])

  useEffect(() => {
    if (collaboration.siteChangeRevision === 0) {
      return
    }

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sites(activeWorkspace.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.site(activeWorkspace.id, siteId) }),
    ])
  }, [activeWorkspace.id, collaboration.siteChangeRevision, queryClient, siteId])

  useEffect(() => {
    if (!collaboration.repairNotice) {
      return
    }

    if (collaboration.repairNotice.repairs.includes("page-required")) {
      toast.warning("Another editor removed the last remaining page, so a new blank page was added.")
      return
    }

    toast.warning("A concurrent addition exceeded this site's item limit and was not kept.")
  }, [collaboration.repairNotice])

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

    let cancelled = false

    queueMicrotask(() => {
      if (cancelled || editor.isDestroyed) {
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
    })

    return () => {
      cancelled = true
    }
  }, [editor, editorMode])

  useEffect(() => {
    siteDraftRef.current = siteDraft
  }, [siteDraft])

  useEffect(() => {
    if (!collaboration.isReady) {
      observedMetadataRevisionRef.current = null
      return
    }

    if (observedMetadataRevisionRef.current === null) {
      observedMetadataRevisionRef.current = collaboration.metadataRevision
      return
    }

    if (observedMetadataRevisionRef.current !== collaboration.metadataRevision) {
      observedMetadataRevisionRef.current = collaboration.metadataRevision
      markUnpublishedChanges()
    }
  }, [collaboration.isReady, collaboration.metadataRevision, markUnpublishedChanges])

  useEffect(() => {
    if (!collaboration.isReady || activePageId && siteDraft.pages.some((page) => page.id === activePageId)) {
      return
    }

    const firstPage = siteDraft.pages[0]

    if (firstPage) {
      setActivePageId(firstPage.id)
    }
  }, [activePageId, collaboration.isReady, siteDraft.pages])

  useEffect(() => {
    if (!editor || editor.isDestroyed || !collaboration.isReady) {
      return
    }

    const loadedVariables = mergeVariableOptions(
      editorVariables,
      siteDraft.variables.map((variable) => ({
        id: variable.id,
        name: variable.label,
        slug: variable.key,
        type: variable.type,
        defaultValue: typeof variable.defaultValue === "string" ? variable.defaultValue : "",
      })),
    )
    const storage = getLightsiteVariableStorage(editor)
    if (!storage) {
      return
    }
    storage.definitions = loadedVariables
    const nextShareDefinitions = getShareVariableDefinitions(editor.state.doc, loadedVariables)
    if (!lightsiteVariablesAreEqual(variableDefinitionsRef.current, nextShareDefinitions)) {
      variableDefinitionsRef.current = nextShareDefinitions
      setVariableDefinitions(nextShareDefinitions)
    }
  }, [collaboration.isReady, editor, siteDraft.variables])

  useEffect(() => {
    const root = document.documentElement
    const previousDarkState = root.classList.contains("dark")

    root.classList.toggle("dark", siteTheme === "dark")

    return () => {
      root.classList.toggle("dark", previousDarkState)
    }
  }, [siteTheme])

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return
    }

    const syncVariables = (incrementDocumentRevision: boolean) => {
      const storage = getLightsiteVariableStorage(editor)
      if (!storage) {
        return
      }
      const nextDefinitions = getShareVariableDefinitions(
        editor.state.doc,
        storage.definitions
      )
      const definitionsChanged = !lightsiteVariablesAreEqual(
        variableDefinitionsRef.current,
        nextDefinitions,
      )

      if (definitionsChanged) {
        variableDefinitionsRef.current = nextDefinitions
        setVariableDefinitions(nextDefinitions)
        updateSiteDraft((currentDraft) => ({
          ...currentDraft,
          variables: mergeSiteVariableDefinitions(currentDraft.variables, nextDefinitions),
        }))
      }
      if (incrementDocumentRevision) {
        setDocumentRevision((revision) => revision + 1)
      }
    }
    const handleTransaction = ({ transaction }: { transaction: Transaction }) => {
      syncVariables(transaction.docChanged)
    }

    syncVariables(false)
    editor.on("transaction", handleTransaction)

    return () => {
      editor.off("transaction", handleTransaction)
    }
  }, [editor, updateSiteDraft])

  const switchToPage = useCallback((pageId: string) => {
    if (!editor || pageId === activePageId) {
      return
    }

    const currentDraft = siteDraftRef.current
    const nextPage = currentDraft.pages.find((page) => page.id === pageId)

    if (!nextPage) {
      return
    }

    setActivePageId(pageId)
  }, [activePageId, editor])

  const addPage = useCallback(() => {
    if (!editor) {
      return
    }

    const currentDraft = siteDraftRef.current

    if (currentDraft.pages.length >= LIGHTSITE_COLLECTION_LIMITS.tabs) {
      toast.error(`You can add up to ${LIGHTSITE_COLLECTION_LIMITS.tabs} tabs.`)
      return
    }

    const nextPage = createEditorPage("Untitled", currentDraft.pages)
    const nextDraft = {
      ...currentDraft,
      pages: [...currentDraft.pages, nextPage],
    }

    updateSiteDraft(nextDraft)
    setActivePageId(nextPage.id)
  }, [editor, updateSiteDraft])

  const renameSidebarSection = useCallback((
    section: EditorSidebarSectionKey,
    label: string
  ) => {
    const nextLabel = clampTextToLimit(label, "sectionLabel")

    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        sections: {
          ...currentDraft.sidebar.sections,
          [section]: { label: normalizeSectionLabel(section, nextLabel) },
        },
      },
    }))
  }, [updateSiteDraft])

  const renamePage = useCallback((pageId: string, name: string) => {
    const normalizedName = clampTextToLimit(name, "siteName").trim().replace(/\s+/g, " ")

    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      pages: currentDraft.pages.map((page) =>
        page.id === pageId
          ? { ...page, name: normalizedName || page.name }
          : page
      ),
    }))
  }, [updateSiteDraft])

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

    const remainingPages = currentDraft.pages.filter((page) => page.id !== pageId)

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

    updateSiteDraft(nextDraft)

    if (activePageWasDeleted) {
      setActivePageId(nextActivePage.id)
    }
  }, [activePageId, editor, updateSiteDraft])

  const addSidebarLink = useCallback((input: { label: string; href: string }) => {
    if (siteDraftRef.current.sidebar.links.length >= LIGHTSITE_COLLECTION_LIMITS.links) {
      toast.error(`You can add up to ${LIGHTSITE_COLLECTION_LIMITS.links} links.`)
      return
    }

    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: [
          ...currentDraft.sidebar.links,
          createSidebarLink(input, currentDraft.sidebar.links),
        ],
      },
    }))
  }, [updateSiteDraft])

  const updateSidebarLink = useCallback((
    linkId: string,
    input: { label: string; href: string }
  ) => {
    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: currentDraft.sidebar.links.map((link) =>
          link.id === linkId
            ? {
                ...link,
                label: clampTextToLimit(input.label, "sidebarLabel").trim(),
                href: clampTextToLimit(input.href, "url").trim(),
              }
            : link
        ),
      },
    }))
  }, [updateSiteDraft])

  const deleteSidebarLink = useCallback((linkId: string) => {
    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        links: currentDraft.sidebar.links.filter((link) => link.id !== linkId),
      },
    }))
  }, [updateSiteDraft])

  const addSidebarButton = useCallback((input: {
    label: string
    href: string
    style: EditorSidebarButtonStyle
  }) => {
    if (siteDraftRef.current.sidebar.nextSteps.length >= LIGHTSITE_COLLECTION_LIMITS.links) {
      toast.error(`You can add up to ${LIGHTSITE_COLLECTION_LIMITS.links} buttons.`)
      return
    }

    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: [
          ...currentDraft.sidebar.nextSteps,
          createSidebarButton(input, currentDraft.sidebar.nextSteps),
        ],
      },
    }))
  }, [updateSiteDraft])

  const updateSidebarButton = useCallback((
    buttonId: string,
    input: { label: string; href: string; style: EditorSidebarButtonStyle }
  ) => {
    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: currentDraft.sidebar.nextSteps.map((button) =>
          button.id === buttonId
            ? {
                ...button,
                label: clampTextToLimit(input.label, "sidebarLabel").trim(),
                href: clampTextToLimit(input.href, "url").trim(),
                style: input.style,
              }
            : button
        ),
      },
    }))
  }, [updateSiteDraft])

  const deleteSidebarButton = useCallback((buttonId: string) => {
    updateSiteDraft((currentDraft) => ({
      ...currentDraft,
      sidebar: {
        ...currentDraft.sidebar,
        nextSteps: currentDraft.sidebar.nextSteps.filter((button) => button.id !== buttonId),
      },
    }))
  }, [updateSiteDraft])

  const previewContent = useMemo(() => {
    if (!activeEditor || !collaboration.isReady) {
      return siteDraft
    }

    const currentContent = collaboration.getContent()
    return {
      ...currentContent,
      themeMode: siteTheme,
      variables: mergeSiteVariableDefinitions(currentContent.variables, variableDefinitions),
      pages: currentContent.pages.map((page) =>
        page.id === activePageId
          ? { ...page, document: activeEditor.getJSON() }
          : page
      ),
    }
  }, [
    activePageId,
    collaboration.isReady,
    collaboration.metadataRevision,
    collaboration.remoteDocumentRevision,
    documentRevision,
    activeEditor,
    siteDraft,
    siteTheme,
    variableDefinitions,
  ])

  return (
    <div
      data-editor-page=""
      data-editor-mode={editorMode}
      data-theme={siteTheme}
      data-site-id={siteId}
      className={cn(siteTheme, "flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground")}
    >
      <EditorHeader
        canRedo={editorState?.canRedo ?? false}
        canUndo={editorState?.canUndo ?? false}
        collaborators={collaboration.collaborators}
        isDeletingSite={deleteSiteMutation.isPending}
        isDuplicatingSite={duplicateSiteMutation.isPending}
        isPublishing={publishSiteMutation.isPending}
        isRenamingSite={renameSiteMutation.isPending}
        lastPublishedAt={currentSite?.publishedAt ?? null}
        liveSiteDisplayUrl={publicSiteDisplayUrl}
        liveSiteUrl={publicSiteUrl}
        mode={editorMode}
        siteName={siteName}
        onDeleteSite={deleteCurrentSite}
        onDuplicateSite={duplicateCurrentSite}
        onModeChange={setEditorMode}
        onPublish={publishCurrentSite}
        onRenameSite={renameSite}
        onShare={openShareDialog}
        onSiteThemeModeChange={setSiteThemeMode}
        publishStatus={publishStatus}
        recipientCount={recipients.length}
        saveStatus={collaboration.saveStatus}
        siteTheme={siteTheme}
        siteThemeMode={siteThemeMode}
        onRedo={redo}
        onToggleSiteTheme={toggleSiteTheme}
        onUndo={undo}
      />
      <div className="flex min-h-0 flex-1 flex-col bg-background md:flex-row">
        <div
          aria-hidden={editorMode === "preview" ? true : undefined}
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col md:flex-row",
            editorMode === "edit" ? "flex" : "hidden"
          )}
        >
          <EditorSiteSidebar
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
            {activeEditor && collaboration.isReady ? (
              <EditorCanvas
                editor={activeEditor}
                emptyStateFallbackKind={emptyStateFallbackKind}
                mode={editorMode}
              />
            ) : (
              <div className="p-8 text-sm text-muted-foreground">
                {collaboration.saveStatus === "offline"
                  ? "Reconnect to load this site on this device."
                  : "Loading collaborative editor"}
              </div>
            )}
          </section>
        </div>
        {editorMode === "preview" ? (
          <EditorSitePreview
            activePageSlug={siteDraft.pages.find((page) => page.id === activePageId)?.slug ?? null}
            content={previewContent}
            siteId={siteId}
            siteName={siteName}
            siteSlug={currentSite?.slug ?? "preview"}
            workspace={activeWorkspace}
          />
        ) : null}
      </div>
      <RecipientShareDialog
        createRecipient={createRecipient}
        deleteRecipient={deleteRecipient}
        onOpenChange={setShareDialogOpen}
        open={shareDialogOpen}
        recipients={recipients}
        siteUri={siteUri}
        siteVersion={currentSite?.publishedAt}
        updateRecipient={updateRecipient}
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
      leftVariable.type === rightVariable.type &&
      leftVariable.description === rightVariable.description &&
      leftVariable.defaultValue === rightVariable.defaultValue
    )
  })
}

function toSiteVariableDefinitions(variables: LightsiteVariableOption[]) {
  return variables.map((variable) => ({
    id: variable.id,
    key: variable.slug,
    label: variable.name,
    type: variable.type ?? getVariableType(variable),
    defaultValue: variable.defaultValue ?? "",
  }))
}

function mergeSiteVariableDefinitions(
  current: EditorSiteDraft["variables"],
  variables: LightsiteVariableOption[],
) {
  const byId = new Map(current.map((variable) => [variable.id, variable]))

  for (const variable of toSiteVariableDefinitions(variables)) {
    byId.set(variable.id, variable)
  }

  return [...byId.values()]
}

function mergeVariableOptions(
  base: LightsiteVariableOption[],
  overrides: LightsiteVariableOption[],
) {
  const byId = new Map(base.map((variable) => [variable.id, variable]))
  overrides.forEach((variable) => byId.set(variable.id, variable))
  return [...byId.values()]
}

function getVariableType(variable: LightsiteVariableOption) {
  const value = `${variable.id} ${variable.slug} ${variable.name}`.toLowerCase()
  if (value.includes("logo") || value.includes("image") || value.includes("avatar")) return "image" as const
  if (value.includes("url") || value.includes("website") || value.includes("link")) return "url" as const
  return "text" as const
}

function getPublicSiteUrl(workspaceSlug: string, siteSlug: string) {
  if (!workspaceSlug || !siteSlug) {
    return ""
  }

  const path = `/${workspaceSlug}/${siteSlug}`

  if (typeof window === "undefined") {
    return `https://lightsite.io${path}`
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `${window.location.origin}${path}`
  }

  return `https://lightsite.io${path}`
}

function getPublicSiteDisplayUrl(workspaceSlug: string, siteSlug: string) {
  if (!workspaceSlug || !siteSlug) {
    return "lightsite.io/site-path"
  }

  return `lightsite.io/${workspaceSlug}/${siteSlug}`
}
