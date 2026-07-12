import { ReactNodeViewRenderer } from "@tiptap/react"
import {
  SiteButtonBlock,
  SiteGridBlock,
  SiteGridCell,
  SiteGridRow,
  SiteIconCard,
  SiteIconCardBody,
  SiteIconCardTitle,
  SiteIconList,
  SiteIconListItem,
  SiteImageCard,
  SiteImageCardBody,
  SiteImageCardTitle,
  SiteLogoGrid,
  SiteLogoGridItem,
  SiteLogoGridItemTitle,
  SitePageTitleSection,
  SitePageTitleSubtitle,
  SitePageTitleTitle,
  SiteTestimonialAuthorName,
  SiteTestimonialAuthorRole,
  SiteTestimonialCard,
  SiteTestimonialQuote,
  normalizeSiteIconColor,
} from "@lightsite/site-document"

import {
  ButtonBlockView,
  IconCardView,
  IconListItemView,
  ImageCardView,
  LogoGridItemView,
  LogoGridView,
  PageTitleSectionView,
  TestimonialCardView,
} from "./block-views"

// Pure schema and HTML live in @lightsite/site-document. These adapters add
// editor interaction only; Preview and published rendering consume the bases.
export const IconList = SiteIconList
export const IconListItem = SiteIconListItem.extend({
  addNodeView() {
    return ReactNodeViewRenderer(IconListItemView, {
      as: "li",
      className: "lightsite-editor-icon-list-item",
      attrs: ({ node }) => ({
        "data-icon": String(node.attrs.icon ?? "box"),
        "data-icon-color": normalizeSiteIconColor(node.attrs.iconColor),
        "data-lightsite-icon-list-item": "",
        "data-lightsite-editor-block-type": "icon-list-item",
        "data-lightsite-editor-nested-block": "",
      }),
    })
  },
})

export const PageTitleSection = SitePageTitleSection.extend({
  addNodeView: () => ReactNodeViewRenderer(PageTitleSectionView),
})
export const PageTitleTitle = SitePageTitleTitle
export const PageTitleSubtitle = SitePageTitleSubtitle

export const ImageCard = SiteImageCard.extend({
  addNodeView: () => ReactNodeViewRenderer(ImageCardView),
})
export const ImageCardTitle = SiteImageCardTitle
export const ImageCardBody = SiteImageCardBody

export const IconCard = SiteIconCard.extend({
  addNodeView: () => ReactNodeViewRenderer(IconCardView),
})
export const IconCardTitle = SiteIconCardTitle
export const IconCardBody = SiteIconCardBody

export const TestimonialCard = SiteTestimonialCard.extend({
  addNodeView: () => ReactNodeViewRenderer(TestimonialCardView),
})
export const TestimonialAuthorName = SiteTestimonialAuthorName
export const TestimonialAuthorRole = SiteTestimonialAuthorRole
export const TestimonialQuote = SiteTestimonialQuote

export const ButtonBlock = SiteButtonBlock.extend({
  addNodeView: () => ReactNodeViewRenderer(ButtonBlockView),
})

export const LogoGrid = SiteLogoGrid.extend({
  addNodeView: () => ReactNodeViewRenderer(LogoGridView),
})
export const LogoGridItem = SiteLogoGridItem.extend({
  addNodeView: () => ReactNodeViewRenderer(LogoGridItemView),
})
export const LogoGridItemTitle = SiteLogoGridItemTitle

export const GridBlock = SiteGridBlock
export const GridRow = SiteGridRow
export const GridCell = SiteGridCell
