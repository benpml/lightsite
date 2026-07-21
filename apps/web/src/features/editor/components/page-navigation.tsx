import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react"

type EditorPageNavigationTarget = {
  id: string
  name: string
}

type EditorPageNavigationProps = {
  nextPage: EditorPageNavigationTarget | null
  previousPage: EditorPageNavigationTarget | null
  onSelectPage: (pageId: string) => void
}

export function EditorPageNavigation({
  nextPage,
  previousPage,
  onSelectPage,
}: EditorPageNavigationProps) {
  if (!previousPage && !nextPage) {
    return null
  }

  const selectPage = (page: EditorPageNavigationTarget) => {
    onSelectPage(page.id)
  }

  return (
    <nav
      aria-label="Page navigation"
      className="handout-page-navigation handout-editor-page-navigation"
    >
      {previousPage ? (
        <button
          aria-label={`Go to previous tab, ${previousPage.name}`}
          className="handout-page-navigation-link handout-page-navigation-previous"
          type="button"
          onClick={() => selectPage(previousPage)}
        >
          <IconArrowLeft data-icon="inline-start" />
          <span className="handout-page-navigation-copy">
            <span className="handout-page-navigation-label">Previous</span>
            <span className="handout-page-navigation-name">{previousPage.name}</span>
          </span>
        </button>
      ) : null}
      {nextPage ? (
        <button
          aria-label={`Go to next tab, ${nextPage.name}`}
          className="handout-page-navigation-link handout-page-navigation-next"
          type="button"
          onClick={() => selectPage(nextPage)}
        >
          <span className="handout-page-navigation-copy">
            <span className="handout-page-navigation-label">Next</span>
            <span className="handout-page-navigation-name">{nextPage.name}</span>
          </span>
          <IconArrowRight data-icon="inline-end" />
        </button>
      ) : null}
    </nav>
  )
}
