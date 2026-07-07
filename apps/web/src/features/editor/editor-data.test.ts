import { describe, expect, it } from "vitest"

import {
  coerceSelectedVariantId,
  createEditorVariant,
  duplicateEditorVariant,
  initialEditorVariables,
  normalizeVariableKey,
  removeEditorVariant,
} from "./editor-data"

describe("editor data helpers", () => {
  it("normalizes variable keys into token-safe identifiers", () => {
    expect(normalizeVariableKey(" {{ Company Name }} ")).toBe("company_name")
    expect(normalizeVariableKey("Buyer-role!!")).toBe("buyer_role")
  })

  it("creates variants with stable variable value keys", () => {
    const variant = createEditorVariant({
      existingSlugs: new Set(["mira-singh"]),
      name: "Mira Singh",
      slug: "mira-singh",
      variables: initialEditorVariables,
    })

    expect(variant).toMatchObject({
      name: "Mira Singh",
      slug: "mira-singh-2",
    })
    expect(Object.keys(variant.values ?? {})).toEqual(
      initialEditorVariables.map((variable) => variable.id)
    )
  })

  it("duplicates variants without reusing the public slug", () => {
    const variant = createEditorVariant({
      existingSlugs: new Set(),
      name: "Mira Singh",
      slug: "mira-singh",
      variables: initialEditorVariables,
    })
    const duplicatedVariant = duplicateEditorVariant({
      existingSlugs: new Set([variant.slug, `${variant.slug}-copy`]),
      variant,
    })

    expect(duplicatedVariant).toMatchObject({
      name: "Copy of Mira Singh",
      slug: "mira-singh-copy-2",
      values: variant.values,
    })
    expect(duplicatedVariant.id).not.toBe(variant.id)
  })

  it("keeps selected variant ids valid after variant removal", () => {
    const variants = [
      { id: "default", name: "Default", slug: "default" },
      { id: "acme", name: "Acme", slug: "acme" },
    ]
    const nextVariants = removeEditorVariant(variants, "acme")

    expect(nextVariants).toEqual([{ id: "default", name: "Default", slug: "default" }])
    expect(coerceSelectedVariantId(nextVariants, "acme")).toBe("default")
  })

  it("does not remove the default variant", () => {
    const variants = [
      { id: "default", name: "Default", slug: "default" },
      { id: "acme", name: "Acme", slug: "acme" },
    ]

    expect(removeEditorVariant(variants, "default")).toEqual(variants)
  })
})
