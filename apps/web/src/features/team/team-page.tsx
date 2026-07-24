import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  HANDOUT_TEXT_LIMITS,
  validateEmail,
} from "@handout/domain"
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspacePlan,
  WorkspaceRole,
} from "@handout/contracts"
import {
  IconDotsVertical,
  IconCreditCard,
  IconMailPlus,
  IconRefresh,
  IconShield,
  IconTrash,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/common/page-header"
import { RecipientAvatar } from "@/components/common/recipient-avatar"
import { RoleBadge } from "@/components/common/status-badge"
import { LoadingState } from "@/components/common/loading-state"
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useActiveWorkspace, useAppBootstrap } from "@/features/app-bootstrap/app-bootstrap-hooks"
import { formatRelativeTime } from "@/features/sites/site-date-format"
import { getApiErrorMessage, getApiFieldError } from "@/lib/api/errors"
import { queryKeys } from "@/lib/api/query-keys"

import {
  getWorkspaceTeam,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMember,
} from "./api"

const memberDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
})

export function TeamPage() {
  const activeWorkspace = useActiveWorkspace()
  const bootstrap = useAppBootstrap()
  const teamQuery = useQuery({
    queryKey: queryKeys.members(activeWorkspace.id),
    queryFn: ({ signal }) => getWorkspaceTeam(activeWorkspace.id, signal),
  })
  const team = teamQuery.data
  const inviteRequested = new URLSearchParams(window.location.search).get("invite") === "true"

  return (
    <div className="flex min-h-full flex-col gap-6 px-6 pt-5 pb-6">
      <PageHeader
        title="Team"
        description={`Manage who can access ${activeWorkspace.name} and what they can do.`}
        actions={team?.permissions.canManageMembers ? (
          <InviteMemberDialog
            workspaceId={activeWorkspace.id}
            workspacePlan={activeWorkspace.plan}
            defaultOpen={inviteRequested}
          />
        ) : undefined}
      />

      {teamQuery.isLoading ? <TeamLoadingState /> : null}
      {teamQuery.isError ? (
        <TeamErrorState
          message={getApiErrorMessage(teamQuery.error, "Team members could not be loaded.")}
          onRetry={() => void teamQuery.refetch()}
        />
      ) : null}
      {team ? (
        <MembersTable
          canManageMembers={team.permissions.canManageMembers}
          currentUserId={bootstrap.user.id}
          invitations={team.invitations}
          members={team.members}
          workspaceId={activeWorkspace.id}
        />
      ) : null}
    </div>
  )
}

function MembersTable({
  canManageMembers,
  currentUserId,
  invitations,
  members,
  workspaceId,
}: {
  canManageMembers: boolean
  currentUserId: string
  invitations: WorkspaceInvitation[]
  members: WorkspaceMember[]
  workspaceId: string
}) {
  return (
    <div className="min-w-0 overflow-x-auto">
      <Table className="min-w-[680px] table-fixed border-separate border-spacing-y-0.5">
        <colgroup>
          <col />
          <col className="w-[104px]" />
          <col className="w-[124px]" />
          <col className="w-[112px]" />
          <col className="w-[72px]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="[&:before]:block [&:before]:h-0.5 [&:before]:content-[''] [&_tr:last-child]:border-0">
          {members.map((member) => {
            const isCurrentUser = member.userId === currentUserId

            return (
              <TableRow key={member.id} className="group h-16 border-0 hover:bg-transparent">
                <TableCell className="min-w-0 overflow-hidden rounded-l-lg py-2 pl-2 transition-colors group-hover:bg-secondary">
                  <div className="flex min-w-0 items-center gap-3">
                    <RecipientAvatar
                      recipient={{ imageUrl: member.avatarUrl, name: member.name }}
                      size="xl"
                    />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{member.name}</span>
                        {isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">{member.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-2 transition-colors group-hover:bg-secondary">
                  <RoleBadge role={member.role} />
                </TableCell>
                <TableCell className="py-2 text-sm text-tertiary-foreground transition-colors group-hover:bg-secondary">
                  {formatMemberDate(member.joinedAt)}
                </TableCell>
                <TableCell className="py-2 text-sm text-tertiary-foreground transition-colors group-hover:bg-secondary">
                  {member.lastActiveAt ? formatRelativeTime(member.lastActiveAt) : "Not yet"}
                </TableCell>
                <TableCell className="rounded-r-lg py-2 pr-2 text-right transition-colors group-hover:bg-secondary">
                  {isCurrentUser ? (
                    <Button
                      variant="ghost"
                      size="icon-field"
                      aria-label={`Actions for ${member.name}`}
                      disabled
                    >
                      <IconDotsVertical />
                    </Button>
                  ) : canManageMembers ? (
                    <MemberActions
                      member={member}
                      workspaceId={workspaceId}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
          {invitations.map((invitation) => (
            <TableRow key={invitation.id} className="group h-16 border-0 hover:bg-transparent">
              <TableCell className="min-w-0 overflow-hidden rounded-l-lg py-2 pl-2 transition-colors group-hover:bg-secondary">
                <div className="flex min-w-0 items-center gap-3">
                  <RecipientAvatar recipient={{ name: invitation.email }} size="xl" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{invitation.email}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {invitation.invitedByName
                        ? `Invited by ${invitation.invitedByName}`
                        : "Pending invitation"}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-2 transition-colors group-hover:bg-secondary">
                <RoleBadge role={invitation.role} />
              </TableCell>
              <TableCell className="py-2 transition-colors group-hover:bg-secondary">
                <Badge variant="blue">Invited</Badge>
              </TableCell>
              <TableCell className="py-2 text-sm text-tertiary-foreground transition-colors group-hover:bg-secondary">
                —
              </TableCell>
              <TableCell className="rounded-r-lg py-2 pr-2 text-right transition-colors group-hover:bg-secondary">
                <InvitationActions invitation={invitation} workspaceId={workspaceId} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MemberActions({
  member,
  workspaceId,
}: {
  member: WorkspaceMember
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const [removeOpen, setRemoveOpen] = useState(false)
  const nextRole: WorkspaceRole = member.role === "admin" ? "user" : "admin"
  const roleMutation = useMutation({
    mutationFn: () => updateWorkspaceMember(workspaceId, member.id, { role: nextRole }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      toast.success(`${member.name} is now ${nextRole === "admin" ? "an admin" : "a user"}.`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "The member role could not be updated."))
    },
  })
  const removeMutation = useMutation({
    mutationFn: () => removeWorkspaceMember(workspaceId, member.id),
    onSuccess: async () => {
      setRemoveOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      toast.success(`${member.name} was removed from the workspace.`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "The member could not be removed."))
    },
  })
  const isPending = roleMutation.isPending || removeMutation.isPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-field"
            aria-label={`Actions for ${member.name}`}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : <IconDotsVertical />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => roleMutation.mutate()}>
              <IconShield />
              Make {nextRole === "admin" ? "admin" : "user"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setRemoveOpen(true)}>
              <IconTrash />
              Remove member
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace and its sites. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={() => removeMutation.mutate()}
            >
              {removeMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InvitationActions({
  invitation,
  workspaceId,
}: {
  invitation: WorkspaceInvitation
  workspaceId: string
}) {
  const queryClient = useQueryClient()
  const [revokeOpen, setRevokeOpen] = useState(false)
  const renewMutation = useMutation({
    mutationFn: () => inviteWorkspaceMember(workspaceId, {
      email: invitation.email,
      role: invitation.role,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      toast.success(`Invitation for ${invitation.email} renewed.`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "The invitation could not be renewed."))
    },
  })
  const revokeMutation = useMutation({
    mutationFn: () => revokeWorkspaceInvitation(workspaceId, invitation.id),
    onSuccess: async () => {
      setRevokeOpen(false)
      await queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
      toast.success(`Invitation for ${invitation.email} revoked.`)
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "The invitation could not be revoked."))
    },
  })
  const isPending = renewMutation.isPending || revokeMutation.isPending

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-field"
            aria-label={`Actions for ${invitation.email}`}
            disabled={isPending}
          >
            {isPending ? <Spinner /> : <IconDotsVertical />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {invitation.status === "expired" ? (
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => renewMutation.mutate()}>
                <IconRefresh />
                Renew invitation
              </DropdownMenuItem>
            </DropdownMenuGroup>
          ) : null}
          {invitation.status === "expired" ? <DropdownMenuSeparator /> : null}
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={() => setRevokeOpen(true)}>
              <IconTrash />
              Revoke invitation
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {invitation.email} will no longer be able to join this workspace from this invitation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate()}
            >
              {revokeMutation.isPending ? <Spinner data-icon="inline-start" /> : null}
              Revoke invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InviteMemberDialog({
  defaultOpen = false,
  workspaceId,
  workspacePlan,
}: {
  defaultOpen?: boolean
  workspaceId: string
  workspacePlan: WorkspacePlan
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(defaultOpen)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<WorkspaceRole>("user")
  const [submitted, setSubmitted] = useState(false)
  const emailValidation = validateEmail(email)
  const mutation = useMutation({
    mutationFn: () => inviteWorkspaceMember(workspaceId, { email, role }),
    onSuccess: async (response) => {
      setOpen(false)
      setEmail("")
      setRole("user")
      setSubmitted(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.billing(workspaceId) }),
      ])
      toast.success(response.result === "member_added" ? "Teammate added." : "Invitation created.")
    },
  })
  const serverEmailError = getApiFieldError(mutation.error, "email")
  const emailError = submitted && !emailValidation.ok ? emailValidation.message : serverEmailError

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen && new URLSearchParams(window.location.search).get("invite") === "true") {
          const url = new URL(window.location.href)
          url.searchParams.delete("invite")
          window.history.replaceState(null, "", url)
        }
        if (!nextOpen && !mutation.isPending) {
          mutation.reset()
          setSubmitted(false)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="compact">
          <IconMailPlus data-icon="inline-start" />
          Invite teammate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="gap-0.5">
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            Invite someone to this workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="contents"
          onSubmit={(event) => {
            event.preventDefault()
            setSubmitted(true)
            if (!emailValidation.ok || mutation.isPending) return
            mutation.mutate()
          }}
        >
          <FieldSet>
            <FieldGroup>
              <Field data-invalid={Boolean(emailError) || undefined}>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  aria-invalid={Boolean(emailError) || undefined}
                  autoComplete="email"
                  disabled={mutation.isPending}
                  maxLength={HANDOUT_TEXT_LIMITS.email}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (mutation.isError) mutation.reset()
                  }}
                />
                {emailError ? <FieldError>{emailError}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel>Workspace role</FieldLabel>
                <ToggleGroup
                  type="single"
                  value={role}
                  onValueChange={(value) => {
                    if (value === "admin" || value === "user") setRole(value)
                  }}
                  className="grid grid-cols-2"
                  spacing={2}
                  disabled={mutation.isPending}
                >
                  <ToggleGroupItem value="user" variant="outline">User</ToggleGroupItem>
                  <ToggleGroupItem value="admin" variant="outline">Admin</ToggleGroupItem>
                </ToggleGroup>
                <FieldDescription>
                  Admins can manage the workspace.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>

          {workspacePlan !== "free" ? (
            <Alert>
              <IconCreditCard />
              <AlertTitle>A paid seat will be added</AlertTitle>
              <AlertDescription>
                This invitation adds one seat to your subscription. The prorated charge will appear on your next invoice.
              </AlertDescription>
            </Alert>
          ) : null}

          {mutation.isError && !serverEmailError ? (
            <Alert variant="destructive">
              <AlertDescription>
                {getApiErrorMessage(mutation.error, "The invitation could not be created.")}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={mutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Spinner data-icon="inline-start" /> : <IconMailPlus data-icon="inline-start" />}
              Invite teammate
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TeamLoadingState() {
  return <LoadingState placement="section" label="Loading team members" />
}

function TeamErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Team members could not be loaded</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="compact" onClick={onRetry}>
          <IconRefresh data-icon="inline-start" />
          Retry
        </Button>
      </AlertAction>
    </Alert>
  )
}

function formatMemberDate(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? memberDateFormatter.format(timestamp) : value
}
