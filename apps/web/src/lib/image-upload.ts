const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"])
const maxImageBytes = 1_048_576

export function validateImageFile(file: File) {
  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Choose a PNG, JPG, or WEBP image.")
  }
  if (!file.size || file.size > maxImageBytes) {
    throw new Error("Choose an image no larger than 1 MB.")
  }
}

export async function validateSquareImageFile(file: File) {
  validateImageFile(file)

  const objectUrl = URL.createObjectURL(file)
  try {
    const dimensions = await readBrowserImageDimensions(objectUrl)
    if (dimensions.width !== dimensions.height) {
      throw new Error("Images must have a 1:1 square aspect ratio.")
    }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function readSquareImageAsBase64(file: File) {
  await validateSquareImageFile(file)
  return readFileAsBase64(file)
}

export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("File could not be read."))
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "")
    reader.readAsDataURL(file)
  })
}

function readBrowserImageDimensions(src: string) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const image = new Image()
    image.onerror = () => reject(new Error("Image dimensions could not be read."))
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth })
    image.src = src
  })
}
