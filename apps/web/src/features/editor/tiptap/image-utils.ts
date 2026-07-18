import { HANDOUT_TEXT_LIMITS } from "@handout/domain"

export type HandoutImageAttrs = {
  alt: string
  height: number
  src: string
  title: string
  width: number
}

const embeddedImageTargetLength = 600_000
const maximumImageFileBytes = 25 * 1024 * 1024
const maximumRasterHeight = 4_096
const maximumRasterWidth = 1_224
const minimumRasterDimension = 64
const webpQualitySteps = [0.86, 0.74, 0.62, 0.5]

export function readImageFileAsAttrs(file: File) {
  return new Promise<HandoutImageAttrs>((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("The selected file is not an image."))
      return
    }

    if (file.size > maximumImageFileBytes) {
      reject(new Error("The selected image is too large."))
      return
    }

    const reader = new FileReader()

    reader.onerror = () => {
      reject(new Error("Failed to read image file."))
    }
    reader.onload = async () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Failed to read image file."))
        return
      }

      try {
        const dimensions = await loadImageDimensions(reader.result)
        const src = await prepareEmbeddedImageDataUrl({
          dimensions,
          mimeType: file.type,
          src: reader.result,
        })
        const preparedDimensions = src === reader.result
          ? dimensions
          : await loadImageDimensions(src)
        const fitted = fitImageDimensions(preparedDimensions.width, preparedDimensions.height)
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "Image"

        resolve({
          alt: name,
          height: fitted.height,
          src,
          title: name,
          width: fitted.width,
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.readAsDataURL(file)
  })
}

async function prepareEmbeddedImageDataUrl({
  dimensions,
  mimeType,
  src,
}: {
  dimensions: { width: number; height: number }
  mimeType: string
  src: string
}) {
  if (mimeType === "image/gif") {
    if (src.length > HANDOUT_TEXT_LIMITS.embeddedImageDataUrl) {
      throw new Error("The selected GIF is too large.")
    }

    return src
  }

  if (
    src.length <= embeddedImageTargetLength &&
    dimensions.width <= maximumRasterWidth &&
    dimensions.height <= maximumRasterHeight
  ) {
    return src
  }

  const image = await loadImage(src)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("This browser could not prepare the image.")
  }

  let scale = Math.min(
    1,
    maximumRasterWidth / dimensions.width,
    maximumRasterHeight / dimensions.height
  )
  let smallestCandidate = src

  while (
    Math.round(dimensions.width * scale) >= minimumRasterDimension ||
    Math.round(dimensions.height * scale) >= minimumRasterDimension
  ) {
    canvas.width = Math.max(1, Math.round(dimensions.width * scale))
    canvas.height = Math.max(1, Math.round(dimensions.height * scale))
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of webpQualitySteps) {
      const candidate = encodeCanvas(canvas, quality)

      if (candidate.length < smallestCandidate.length) {
        smallestCandidate = candidate
      }

      if (candidate.length <= embeddedImageTargetLength) {
        return candidate
      }
    }

    scale *= 0.75
  }

  if (smallestCandidate.length <= HANDOUT_TEXT_LIMITS.embeddedImageDataUrl) {
    return smallestCandidate
  }

  throw new Error("The selected image is too large.")
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number) {
  const webp = canvas.toDataURL("image/webp", quality)

  return webp.startsWith("data:image/webp;")
    ? webp
    : canvas.toDataURL("image/jpeg", quality)
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("Image failed to load."))
    image.src = src
  })
}

export function loadImageDimensions(src: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        reject(new Error("Image has no dimensions."))
        return
      }

      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      reject(new Error("Image failed to load."))
    }
    image.src = src
  })
}

export function fitImageDimensions(width: number, height: number) {
  const maxWidth = 612
  const scale = Math.min(1, maxWidth / width)

  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  }
}
