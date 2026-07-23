/**
 * Google and email OTP are two ways to prove ownership of the same Handout
 * identity. Better Auth links Google to an existing verified user by email,
 * while email OTP signs directly into the user already stored for that email.
 */
export const accountLinkingPolicy = {
  enabled: true,
  disableImplicitLinking: false,
  trustedProviders: ["google"] as string[],
  allowDifferentEmails: false,
  updateUserInfoOnLink: false,
} as const;
