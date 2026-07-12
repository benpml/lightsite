import { ReactNodeViewRenderer } from "@tiptap/react"
import { SiteVariableToken } from "@lightsite/site-document"

import { VariableTokenView } from "./variable-token-view"

export const VariableToken = SiteVariableToken.extend({
  addNodeView: () => ReactNodeViewRenderer(VariableTokenView),
})
