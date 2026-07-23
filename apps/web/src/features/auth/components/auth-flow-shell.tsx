import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import {
  HANDOUT_PRIVACY_POLICY_URL,
  HANDOUT_TERMS_OF_SERVICE_URL,
} from "@handout/site-document"

import { cn } from "@/lib/utils"
import { disableDevAuthBypass } from "@/lib/api/dev-auth-bypass"

import { authClient } from "../auth-client"

type AuthFlowShellProps = {
  children: ReactNode
  footer?: ReactNode
  railClassName?: string
  showLegalAgreement?: boolean
  wide?: boolean
}

export function AuthFlowShell({
  children,
  footer,
  railClassName,
  showLegalAgreement = false,
  wide = false,
}: AuthFlowShellProps) {
  const railWidth = wide ? "max-w-[900px]" : "max-w-[440px]"

  return (
    <main className="flex min-h-svh flex-col items-center justify-between overflow-x-hidden bg-background text-foreground">
      <header
        className={cn(
          "flex min-h-28 w-full flex-1 items-center justify-center border-x border-border py-12",
          railWidth,
          railClassName,
        )}
      >
        <Link to="/" aria-label="Handout home">
          <span
            aria-hidden="true"
            className="block h-6 w-[106px] bg-tertiary-foreground"
            style={{
              WebkitMask: "url('/handout-logo.svg') center / contain no-repeat",
              mask: "url('/handout-logo.svg') center / contain no-repeat",
            }}
          />
        </Link>
      </header>

      <section className="flex w-full shrink-0 items-center justify-center border-y border-border">
        <div
          className={cn(
            "relative flex w-full items-stretch border-x border-border",
            railWidth,
            railClassName,
          )}
        >
          <CornerMarkers />
          {children}
        </div>
      </section>

      <footer
        className={cn(
          "relative flex min-h-28 w-full flex-1 items-end justify-center border-x border-border px-6 py-12",
          railWidth,
          railClassName,
        )}
      >
        <CornerMarkers />
        {footer ?? (
          <AuthLegalFooter showAgreement={showLegalAgreement} />
        )}
      </footer>
    </main>
  )
}

export function AuthLegalFooter({ showAgreement }: { showAgreement: boolean }) {
  if (!showAgreement) {
    return null
  }

  return (
    <p className="text-center text-xs leading-4 text-muted-foreground">
      By clicking continue, you agree to our{" "}
      <a
        href={HANDOUT_TERMS_OF_SERVICE_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="underline"
      >
        Terms
      </a>{" "}
      and{" "}
      <a
        href={HANDOUT_PRIVACY_POLICY_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="underline"
      >
        Privacy Policy
      </a>
      .
    </p>
  )
}

export function AuthFooterLinks({ showSignOut = false }: { showSignOut?: boolean }) {
  return (
    <nav aria-label="Account and legal links" className="flex flex-wrap justify-center gap-4 text-xs leading-4 text-muted-foreground">
      <a
        href={HANDOUT_TERMS_OF_SERVICE_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="underline"
      >
        Terms
      </a>
      <a
        href={HANDOUT_PRIVACY_POLICY_URL}
        rel="noopener noreferrer"
        target="_blank"
        className="underline"
      >
        Privacy Policy
      </a>
      {showSignOut ? (
        <button
          type="button"
          className="underline"
          onClick={() => {
            void authClient.signOut().then((result) => {
              if (!result.error) {
                disableDevAuthBypass()
                window.location.replace("/auth")
              }
            })
          }}
        >
          Sign out
        </button>
      ) : null}
    </nav>
  )
}

function CornerMarkers() {
  return (
    <>
      <span
        aria-hidden="true"
        className="absolute -top-[6px] -left-[6px] z-10 size-2.5 rounded-[3px] border border-border bg-background"
      />
      <span
        aria-hidden="true"
        className="absolute -top-[6px] -right-[6px] z-10 size-2.5 rounded-[3px] border border-border bg-background"
      />
    </>
  )
}
