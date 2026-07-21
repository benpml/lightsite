import {
  renderEmailAction,
  renderEmailDetails,
  renderEmailDividerNote,
  renderEmailHeading,
  renderEmailMutedParagraph,
  renderEmailParagraph,
  renderHandoutEmail,
} from "./email-template";

export type WorkspaceInvitationEmailInput = {
  inviterName: string;
  workspaceName: string;
  role: "admin" | "member";
  acceptUrl: string;
};

export function getWorkspaceInvitationEmailSubject(input: WorkspaceInvitationEmailInput) {
  return `${input.inviterName} invited you to ${input.workspaceName}`;
}

export function renderWorkspaceInvitationEmail(input: WorkspaceInvitationEmailInput) {
  const subject = getWorkspaceInvitationEmailSubject(input);

  return renderHandoutEmail({
    title: subject,
    preheader: `${input.inviterName} invited you to join ${input.workspaceName} on Handout.`,
    contentHtml: [
      renderEmailHeading("You're invited"),
      renderEmailParagraph(`${input.inviterName} invited you to collaborate in Handout.`),
      renderEmailDetails([
        { label: "Workspace", value: input.workspaceName },
        { label: "Role", value: input.role === "admin" ? "Admin" : "Member" },
      ]),
      renderEmailAction("Accept invitation", input.acceptUrl),
      renderEmailMutedParagraph("This invitation expires in 14 days."),
      renderEmailDividerNote("If you weren't expecting this invitation, you can safely ignore this email."),
    ].join("\n"),
  });
}

export function renderWorkspaceInvitationEmailText(input: WorkspaceInvitationEmailInput) {
  return [
    "You're invited",
    "",
    `${input.inviterName} invited you to join ${input.workspaceName} on Handout as ${input.role === "admin" ? "an admin" : "a member"}.`,
    "",
    input.acceptUrl,
    "",
    "This invitation expires in 14 days.",
    "",
    "If you weren't expecting this invitation, you can safely ignore this email.",
  ].join("\n");
}
