export type LightsiteImageAttrs = {
  alt: string
  height: number
  src: string
  title: string
  width: number
}

export function readImageFileAsAttrs(file: File) {
  return new Promise<LightsiteImageAttrs>((resolve, reject) => {
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
        const fitted = fitImageDimensions(dimensions.width, dimensions.height)
        const name = file.name.replace(/\.[^.]+$/, "").trim() || "Image"

        resolve({
          alt: name,
          height: fitted.height,
          src: reader.result,
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
