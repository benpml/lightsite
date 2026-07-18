type ExampleEntry = {
  slug: string
  title: string
  description: string
  href: string
  status: "draft" | "published"
  previewImage?: {
    src: string
    position?: string
  }
}

const exampleEntries: readonly ExampleEntry[] = [
  {
    slug: "example-1",
    title: "Title",
    description: "Description",
    href: "#example-1",
    status: "published",
  },
  {
    slug: "example-2",
    title: "Title",
    description: "Description",
    href: "#example-2",
    status: "published",
  },
  {
    slug: "example-3",
    title: "Title",
    description: "Description",
    href: "#example-3",
    status: "published",
  },
  {
    slug: "example-4",
    title: "Title",
    description: "Description",
    href: "#example-4",
    status: "published",
  },
  {
    slug: "example-5",
    title: "Title",
    description: "Description",
    href: "#example-5",
    status: "published",
  },
  {
    slug: "example-6",
    title: "Title",
    description: "Description",
    href: "#example-6",
    status: "published",
  },
]

function getPublishedExamples() {
  return exampleEntries.filter((example) => example.status === "published")
}

export { exampleEntries, getPublishedExamples, type ExampleEntry }
