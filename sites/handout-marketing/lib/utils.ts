import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "13",
        "15",
        "title-xl",
        "title-lg",
        "title-md",
        "title-sm",
        "title-xs",
        "body-3xl",
        "body-2xl",
        "body-xl",
        "body-lg",
        "body-md",
        "body-sm",
        "body-xs",
        "label-2xl",
        "label-xl",
        "label-lg",
        "label-md",
        "label-xs",
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
