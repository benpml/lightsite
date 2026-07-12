export function getExtensionPanelRect(input: {
  actionTop: number
  composeRight: number
  panelHeight: number
  panelWidth: number
  viewportHeight: number
  viewportPadding: number
  viewportWidth: number
}) {
  const width = Math.max(
    1,
    Math.min(input.panelWidth, input.viewportWidth - input.viewportPadding * 2),
  )
  const height = Math.max(
    1,
    Math.min(input.panelHeight, input.viewportHeight - input.viewportPadding * 2),
  )

  return {
    height,
    left: Math.max(
      input.viewportPadding,
      Math.min(
        input.composeRight - width - input.viewportPadding,
        input.viewportWidth - width - input.viewportPadding,
      ),
    ),
    top: Math.max(
      input.viewportPadding,
      Math.min(
        input.actionTop - height - 10,
        input.viewportHeight - height - input.viewportPadding,
      ),
    ),
    width,
  }
}
