# Lightsite Engineering Notes

## Component Organization

Organize components by ownership and reuse, not by abstract atomic labels.

```txt
apps/web/src/
  components/
    ui/                 # shadcn primitives and system-wide primitive variants
    layout/             # app shell, sidebar composition, page chrome
    common/             # app-wide composed components
    data-display/       # reusable tables, metric cards, empty states, lists
    feedback/           # confirm dialogs, toast helpers, alerts

  features/
    sites/
      components/
      hooks/
      api.ts
      types.ts
    editor/
      components/
      hooks/
      types.ts
    tracking/
    team/
    public-site/
    design-system/
```

## shadcn Rules

- Keep `components/ui` as the shadcn primitive layer.
- Modify `components/ui` only for behavior, variants, sizing, or styling that should apply across the app.
- Prefer built-in shadcn variants before adding new variants.
- Add primitive variants with `cva` in the primitive file when the variant is reusable.
- Compose primitives into higher-level components in `components/common`, `components/layout`, or `features/*/components`.
- Do not put product-specific components in `components/ui`.
- Use semantic tokens (`bg-primary`, `text-muted-foreground`, `bg-page-background`) instead of raw Tailwind colors.
- Use `className` mostly for layout: spacing, sizing, grids, flex, max width, and positioning.
- Use `Field`, `FieldGroup`, `FieldSet`, and related form primitives for forms.
- Use `Badge`, `Alert`, `Empty`, `Separator`, `Skeleton`, and `sonner` instead of one-off equivalents.
- Product UI should use `@tabler/icons-react`. Keep upstream shadcn primitive internals stable unless intentionally migrating a primitive.
- Icons inside buttons use `data-icon`; do not manually size button icons unless the base component does not cover that case.

## Promotion Rule

Start product UI inside the feature that owns it. Promote only when there is real reuse:

- One feature uses it: keep it in `features/<feature>/components`.
- Two or more unrelated features use it: move it to `components/common` or a specific shared folder.
- The app frame uses it: move it to `components/layout`.
- It changes primitive behavior everywhere: update `components/ui`.

## Design Tokens

The theme lives in `apps/web/src/index.css`.

- Base shadcn tokens come from the Figma `mode` variable collection.
- Lightsite semantic additions are `page-background`, `tertiary-foreground`, `variable-*`, and `editing-*`.
- Add new semantic colors in `index.css` under `:root`, `.dark`, and `@theme inline`.
- Do not create a second theme CSS file.

## Figma Implementation

When implementing from Figma:

- Inspect the Figma node before coding.
- Match sizes, spacing, radii, and token choices as closely as possible.
- If a Figma value is not tokenized, use the closest existing token and only add a semantic token when the value has product meaning.
- Update base primitives when the design requires a reusable primitive-level change.
- Avoid one-off style overrides that should be variants or token changes.

## Editor Architecture

The site editor must be Tiptap/ProseMirror-first. Do not rebuild page-builder state beside Tiptap.

- Tiptap schema, commands, transactions, selections, history, and input rules own document editing.
- React node views render nodes and expose configuration controls; they must not become a second editor model.
- Editable content belongs in Tiptap node content via `NodeViewContent`, not in React attrs or controlled inputs.
- Node attrs are only for configuration such as URLs, image sources, icon choices, layout flags, and CTA settings.
- Slash commands and variable insertion should be Tiptap-aware command/suggestion behavior: typed triggers stay in the document, query text filters the menu, and selection replaces the typed trigger range through a transaction.
- Markdown shortcuts such as `- ` and `1. ` should be Tiptap input rules, not React key handlers.
- Undo, redo, multi-select, delete, drag/reorder, and click-away selection cleanup must operate through ProseMirror state.
- Keep editor behavior in `features/editor/tiptap/*`; keep `editor-canvas.tsx` as the shell/composition layer.
