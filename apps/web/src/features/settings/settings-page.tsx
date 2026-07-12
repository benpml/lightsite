import { useMemo, useState, type ReactNode } from "react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconBuilding,
  IconPhoto,
  IconUser,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { completeAccountSetup } from "@/features/app-bootstrap/api"
import { useActiveWorkspace, useAppBootstrap } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { getApiErrorMessage, getApiFieldError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

export function SettingsPage() {
  const bootstrap = useAppBootstrap()
  const activeWorkspace = useActiveWorkspace()
  const initialNameParts = useMemo(
    () => splitDisplayName(bootstrap.user.name ?? ""),
    [bootstrap.user.name]
  )
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState(initialNameParts.firstName)
  const [lastName, setLastName] = useState(initialNameParts.lastName)
  const nextDisplayName = joinDisplayName(firstName, lastName)
  const currentDisplayName = joinDisplayName(initialNameParts.firstName, initialNameParts.lastName)
  const isDirty = nextDisplayName !== currentDisplayName
  const nameError = nextDisplayName ? null : "First name is required."
  const profileMutation = useMutation({
    mutationFn: completeAccountSetup,
    onSuccess: async (nextBootstrap) => {
      const nextParts = splitDisplayName(nextBootstrap.user.name ?? nextDisplayName)

      setFirstName(nextParts.firstName)
      setLastName(nextParts.lastName)
      queryClient.setQueryData(queryKeys.me(), nextBootstrap)
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      toast.success("Settings saved.")
    },
  })
  const serverNameError = getApiFieldError(profileMutation.error, "displayName")

  const saveSettings = () => {
    if (profileMutation.isPending) {
      return
    }

    if (nameError) {
      return
    }

    if (!isDirty) {
      toast.success("Settings saved.")
      return
    }

    profileMutation.mutate({ displayName: nextDisplayName })
  }

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 pt-5 pb-6">
      <PageHeader
        title="Settings"
        description="Edit your account and workspace settings."
        actions={
          <Button
            size="compact"
            type="button"
            disabled={profileMutation.isPending}
            onClick={saveSettings}
          >
            {profileMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        }
      />

      <main className="flex w-full flex-col items-center gap-4">
        <SettingsSectionCard icon={IconUser} label="You">
          <FieldSet className="w-full min-w-0">
            <FieldGroup className="gap-2.5">
              <div className="grid w-full gap-2.5 sm:grid-cols-2">
                <Field data-invalid={Boolean(nameError || serverNameError) || undefined}>
                  <FieldLabel htmlFor="settings-first-name">First name</FieldLabel>
                  <Input
                    id="settings-first-name"
                    aria-invalid={Boolean(nameError || serverNameError) || undefined}
                    autoComplete="given-name"
                    maxLength={LIGHTSITE_TEXT_LIMITS.accountDisplayName}
                    placeholder="John"
                    value={firstName}
                    onChange={(event) => {
                      setFirstName(event.target.value)
                      profileMutation.reset()
                    }}
                  />
                  {nameError || serverNameError ? (
                    <FieldError>{serverNameError ?? nameError}</FieldError>
                  ) : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-last-name">Last name</FieldLabel>
                  <Input
                    id="settings-last-name"
                    autoComplete="family-name"
                    maxLength={LIGHTSITE_TEXT_LIMITS.accountDisplayName}
                    placeholder="Acme"
                    value={lastName}
                    onChange={(event) => {
                      setLastName(event.target.value)
                      profileMutation.reset()
                    }}
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          {profileMutation.isError && !serverNameError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(profileMutation.error, "Settings could not be saved.")}
              </AlertDescription>
            </Alert>
          ) : null}
        </SettingsSectionCard>

        <SettingsSectionCard icon={IconBuilding} label="Workspace">
          <FieldSet className="w-full min-w-0">
            <FieldGroup className="gap-2.5">
              <div className="grid w-full gap-2.5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="settings-workspace-name">Name</FieldLabel>
                  <Input
                    id="settings-workspace-name"
                    maxLength={LIGHTSITE_TEXT_LIMITS.workspaceName}
                    value={activeWorkspace.name}
                    readOnly
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="settings-workspace-website">Website</FieldLabel>
                  <Input
                    id="settings-workspace-website"
                    inputMode="url"
                    maxLength={LIGHTSITE_TEXT_LIMITS.url}
                    value={activeWorkspace.websiteDomain || "https://example.com"}
                    readOnly
                  />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>

          <FieldSet className="w-full min-w-0">
            <FieldGroup className="w-full">
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <div className="flex w-full items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-secondary text-muted-foreground">
                    {activeWorkspace.logoUrl ? (
                      <img
                        src={activeWorkspace.logoUrl}
                        alt={`${activeWorkspace.name} logo`}
                        className="size-full object-contain p-2"
                      />
                    ) : (
                      <IconPhoto aria-hidden size={20} stroke={1.8} />
                    )}
                  </div>
                  <FieldDescription className="min-w-0 flex-1">
                    1:1 square aspect ratio, PNG, JPG, or WEBP, 1MB max
                  </FieldDescription>
                  <Button size="compact" variant="outline" type="button">
                    Upload
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </FieldSet>

          <Alert>
            <IconAlertTriangle aria-hidden size={14} stroke={1.8} />
            <AlertDescription>
              Changes here will affect logo on published sites.
            </AlertDescription>
          </Alert>
        </SettingsSectionCard>
      </main>
    </div>
  )
}

function SettingsSectionCard({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode
  icon: typeof IconUser
  label: string
}) {
  return (
    <Card className="w-full max-w-[560px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Icon aria-hidden size={14} stroke={1.8} />
          <span>{label}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  )
}

function splitDisplayName(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)

  if (parts.length <= 1) {
    return {
      firstName: parts[0] ?? "",
      lastName: "",
    }
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  }
}

function joinDisplayName(firstName: string, lastName: string) {
  return [firstName, lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}
