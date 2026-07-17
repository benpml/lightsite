import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type GraphicPlaceholderProps = {
  image: "cloud-deep" | "cloud-light" | "cloud-soft"
  className?: string
  cardClassName?: string
}

function GraphicPlaceholder({
  image,
  className,
  cardClassName,
}: GraphicPlaceholderProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "coded-noise relative flex size-full items-center justify-center overflow-hidden bg-cover bg-center",
        className,
      )}
      style={{ backgroundImage: `url(/images/home/${image}.jpg)` }}
    >
      <Card
        variant="surface"
        className={cn(
          "relative z-10 h-[218px] w-[min(340px,calc(100%-64px))] rounded-2xl py-0",
          cardClassName,
        )}
      />
    </div>
  )
}

export { GraphicPlaceholder }
