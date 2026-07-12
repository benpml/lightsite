import { useState } from "react"
import { LIGHTSITE_TEXT_LIMITS } from "@lightsite/domain"
import {
  IconDotsVertical,
  IconMailForward,
  IconMailPlus,
  IconRefresh,
  IconShield,
  IconTrash,
} from "@tabler/icons-react"

import { PageHeader } from "@/components/common/page-header"
import { InviteStatusBadge, RoleBadge } from "@/components/common/status-badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  teamMembers,
  workspaceInvites,
  type TeamMemberRecord,
  type WorkspaceRole,
} from "@/data/sample-data"

export function TeamPage() {
  return (
    <div className="flex min-h-full flex-col gap-5 px-6 pt-5 pb-6">
      <PageHeader
        title="Team"
        description="Invite teammates, manage workspace roles, and keep site access server-authoritative."
        actions={<InviteUserDialog />}
      />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">
            Admins can manage workspace settings, members, and every workspace-owned site.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{member.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{member.name}</span>
                          {member.isCurrentUser ? (
                            <span className="text-xs text-muted-foreground">You</span>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Joined {member.joinedAt}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{member.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.lastActiveAt}</TableCell>
                  <TableCell>
                    <MemberActions member={member} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-medium">Invites</h2>
          <p className="text-sm text-muted-foreground">
            Pending invites grant no access until accepted by the matching work email.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaceInvites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-medium">{invite.email}</TableCell>
                  <TableCell>
                    <RoleBadge role={invite.role} />
                  </TableCell>
                  <TableCell>
                    <InviteStatusBadge status={invite.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invite.sentAt} by {invite.invitedBy}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${invite.email}`}>
                          <IconDotsVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem>
                            <IconRefresh />
                            Resend invite
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive">
                            <IconTrash />
                            Revoke invite
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function MemberActions({ member }: { member: TeamMemberRecord }) {
  const isProtected = Boolean(member.isCurrentUser)
  const nextRole = member.role === "admin" ? "user" : "admin"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
          <IconDotsVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={isProtected}>
            <IconShield />
            Set role to {nextRole}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isProtected} variant="destructive">
          <IconTrash />
          Remove member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function InviteUserDialog() {
  const [role, setRole] = useState<WorkspaceRole>("user")

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="compact">
          <IconMailPlus data-icon="inline-start" />
          Invite user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Invite a teammate with a work email. Personal email domains and plus-addresses are blocked.
          </DialogDescription>
        </DialogHeader>
        <FieldSet>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="invite-email">Work email</FieldLabel>
              <Input
                id="invite-email"
                maxLength={LIGHTSITE_TEXT_LIMITS.email}
                placeholder="name@company.com"
                type="email"
              />
              <FieldDescription>
                The invite can only be accepted by this exact email address.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Workspace role</FieldLabel>
              <ToggleGroup
                type="single"
                value={role}
                onValueChange={(value) => {
                  if (value === "admin" || value === "user") {
                    setRole(value)
                  }
                }}
                className="grid grid-cols-2"
                spacing={2}
              >
                <ToggleGroupItem value="user" variant="outline">
                  User
                </ToggleGroupItem>
                <ToggleGroupItem value="admin" variant="outline">
                  Admin
                </ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                Admins can manage members, settings, billing, and all workspace-owned sites.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>
            <IconMailForward data-icon="inline-start" />
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
