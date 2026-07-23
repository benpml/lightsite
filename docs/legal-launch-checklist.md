# Handout legal launch and operating checklist

The Privacy Policy and Terms of Service describe and allocate risk; they do not
replace the operational work below. This checklist should have a named owner and
be reviewed at least quarterly and before a material product, vendor, data, or
geographic expansion.

## Must be completed before publishing the legal documents

- [ ] Confirm that `Scaleframe, Inc., doing business as Handout` is the correct
      contracting entity, that `101 Arch Street, Boston, Massachusetts 02110` is
      its current legal-notice address, and that New York law and New York County
      venue are intended. The single source is
      `sites/handout-marketing/features/legal/legal-config.ts`.
- [ ] Confirm that `hello@handout.link` is monitored for privacy, copyright,
      moderation, legal-notice, arbitration-opt-out, and security mail. Configure
      ticket routing, backup personnel, and preservation rules.
- [ ] Have qualified privacy and commercial counsel in the relevant launch
      jurisdictions review the final text, especially the arbitration agreement,
      liability cap, indemnity, Session Replay Addendum, DPA, SCC selections, and
      representative analysis.
- [ ] Record board/officer approval or other corporate authorization to issue the
      Terms on behalf of the contracting entity.
- [ ] Preserve a PDF or immutable copy of every policy version, its effective
      dates, and the source commit.
- [ ] Require affirmative acceptance of the Terms at account creation and when a
      material update requires renewed assent. Store user, organization, version,
      time, and acceptance event. The sign-up notice now presents the links beside
      the action, but a footer link or UI copy without a durable acceptance record
      is not sufficient evidence by itself.
- [ ] Ensure the in-app replay acceptance records the exact Terms/Addendum version,
      workspace, accepting administrator, time, and affected setting.
- [ ] Verify that the checkout clearly displays price, billing interval, per-seat
      basis, automatic renewal, cancellation timing, and a link to the Terms before
      purchase.

## Privacy governance

- [ ] Maintain a data inventory mapping every database table, object bucket,
      browser store, log, analytics stream, support system, email provider,
      payment provider, and customer-directed destination to purpose, legal basis,
      owner, recipients, location, and retention.
- [ ] Reconcile the inventory against the Privacy Policy whenever a migration,
      environment variable, SDK, integration, embed provider, new event type, or
      new AI feature is introduced.
- [ ] Maintain an intake and verification procedure for access, correction,
      deletion, portability, objection, consent withdrawal, restriction, opt-out,
      and appeal requests. Calendar every statutory deadline and document the
      response.
- [ ] Maintain a controller-versus-processor decision record. Route
      customer-site visitor requests to the customer while providing required
      processor assistance; handle account, security, billing, and Handout website
      requests as Handout-controller requests.
- [ ] Implement and test account/workspace export and deletion. Document what is
      deleted immediately, what is queued, what remains in backups, and every
      legal-hold exception.
- [ ] Verify at least quarterly that tracking event retention supports only
      30/90/180/365 days, replay supports only 7/14/30 days, webhook payloads are
      redacted after 7 days, webhook activity is deleted after 30 days, and
      monthly automation usage is pruned after 12 months.
- [ ] Document log and backup retention that is not expressed as an exact public
      period. Keep security logs no longer than justified.
- [ ] Maintain an incident-response plan with 24/7 escalation, evidence
      preservation, processor-to-customer notification, jurisdictional deadline
      analysis, regulator/individual templates, and a post-incident review.
- [ ] Keep a vendor register and signed DPAs with Cloudflare, Render, Neon, Resend,
      Stripe, and any provider that processes personal data on Handout's behalf.
- [ ] Maintain a public subprocessor list and a working 30-day change-notice
      subscription. Test the objection workflow before adding a material
      subprocessor.
- [ ] Complete and retain transfer impact assessments for the actual EEA and UK
      transfers and subprocessors. Reassess government-access law and supplementary
      measures at least annually.
- [ ] Determine with counsel whether Handout must appoint and publish an EEA
      Article 27 representative, UK representative, EU Digital Services Act legal
      representative, data protection officer, or local privacy representative as
      its visitor/user footprint changes.
- [ ] Maintain records of processing, legitimate-interest assessments, and the
      legal basis for Handout's own account, security, product, and website
      processing.
- [ ] Complete a DPIA before expanding session replay, persistent identification,
      cross-site measurement, sensitive-data processing, employee monitoring,
      children-facing use, precise location, biometrics, or significant automated
      decision-making.
- [ ] Do not claim Privacy Framework, SOC, ISO, HIPAA, PCI, accessibility, or other
      certification until the claim is documented and current.

## Customer-site consent, tracking, and replay

- [ ] Test that no consent-gated tracking or replay request starts before an
      affirmative Allow action in every supported browser and page path.
- [ ] Test that Decline enters the site without tracking, Privacy choices remains
      available, withdrawal immediately stops the current capture, and the saved
      decision is site-scoped and expires after 180 days.
- [ ] Preserve the notice version, setting version, customer acceptance, and
      visitor choice needed to investigate a complaint without creating a
      persistent visitor identity.
- [ ] Verify on every replay release that input and textarea values remain masked;
      placeholders, scripts, iframes, blocked regions, canvas, cross-origin frames,
      cookies, browser storage, clipboard, audio, camera, and microphone remain
      excluded; URL credentials, queries, and fragments are removed; and capture
      limits remain enforced.
- [ ] Make the default replay retention 14 days and prohibit any option above 30
      days without a new DPIA, policy update, counsel review, and product approval.
- [ ] Provide customers with implementation guidance that identifies them as site
      owner/controller and requires an accurate notice, legal basis, consent record,
      downstream-use disclosure, and rights contact.
- [ ] Give customers a way to block regions containing sensitive or confidential
      visible text and document that masking does not replace their review.
- [ ] Evaluate all customer-selected embeds. A third-party iframe or image can
      receive a visitor's IP and browser data independently of Handout tracking and
      may need its own consent gate.
- [ ] Do not introduce a persistent device identifier, fingerprint, full URL,
      referrer, arbitrary DOM label, or cross-site profile without a new design,
      legal review, DPIA, customer notice, and Policy update.
- [ ] Maintain rate, duration, event, size, and daily-volume ceilings and alert on
      unusual capture or export patterns.

## User content, copyright, and platform obligations

- [ ] Register the correct contracting entity and all relevant alternate names in
      the U.S. Copyright Office DMCA Designated Agent Directory. Publish the
      registered agent's exact name or title, address, telephone number, and email.
      Renew or update the registration at least every three years.
- [ ] Implement a notice, counter-notice, restoration, repeat-infringer, evidence,
      and complainant/customer communication procedure. Train at least two people.
- [ ] Maintain an illegal-content reporting queue that can disable a precise public
      link quickly, preserve evidence, distinguish urgent safety issues, and issue
      a reasoned moderation notice and appeal path where required.
- [ ] Assess whether Handout qualifies as an intermediary, hosting service, or
      online platform under the EU Digital Services Act and similar laws. Complete
      any required terms, transparency report, point of contact, legal
      representative, authority-response, trusted-flagger, or complaint obligations.
- [ ] Publish and enforce a repeat-infringer and severe-abuse standard consistently.
      Document the rationale for exceptions and restoration.
- [ ] Provide an emergency law-enforcement request path, validation process,
      preservation process, and policy for notifying customers unless prohibited.
- [ ] Maintain sanctions/export screening appropriate to the business and a
      documented escalation for prohibited jurisdictions, parties, and end uses.

## Product and integration controls

- [ ] Keep recipient email addresses out of the canonical recipient record unless a
      later approved feature changes the data map and policy.
- [ ] Keep Gmail extension access limited to the primary compose recipient and
      compose identifier. Test that subject, body, thread, attachments, contacts,
      and Google tokens are not read or transmitted.
- [ ] Keep the Chrome Web Store privacy disclosures synchronized with the extension
      manifest, data access, token storage, and this Privacy Policy.
- [ ] Require short-lived, scoped, revocable authorization for MCP/API clients where
      feasible. Log publication, deletion, recipient changes, and tracking reads
      sufficiently to investigate misuse without logging secrets or full sensitive
      payloads.
- [ ] Never send Customer Content to a third-party AI model for training or
      inference unless the customer intentionally invokes that provider and has
      been shown the relevant data flow and terms.
- [ ] Keep webhook endpoint and signing-secret encryption, SSRF protection,
      signature generation, retry ceilings, queue ceilings, and payload redaction
      covered by automated tests.
- [ ] Ensure generated public preview URLs contain no hidden credentials or
      sensitive variable values beyond the content the customer intentionally
      rendered.
- [ ] Review all new remote-asset, logo, GIF, video, calendar, CDN, telemetry, or
      analytics providers before code ships. Determine whether each is a
      subprocessor, independent controller, or customer-directed recipient.

## Security, finance, and risk transfer

- [ ] Maintain a written security program with risk assessment, secure development,
      access review, vulnerability management, secrets management, backups,
      restoration tests, endpoint security, logging, vendor review, and incident
      response.
- [ ] Conduct periodic tenant-isolation and authorization testing for sites,
      recipients, tracking, replay, assets, billing, MCP, and webhook data.
- [ ] Test that direct origin access is blocked, object storage is private where
      promised, signed access expires, logs redact secrets, and remote fetches
      cannot reach internal networks.
- [ ] Carry cyber, technology errors-and-omissions, commercial general liability,
      directors-and-officers, and crime/social-engineering coverage appropriate to
      the exposure. Reconcile policy exclusions with session replay, user content,
      and AI integrations.
- [ ] Review corporate separateness, capitalization, contracts, tax collection,
      accounting retention, sanctions, and authority to use the Handout name and
      intellectual property.
- [ ] Ensure no sales or support statement promises an SLA, security certification,
      data residency, legal compliance, indefinite storage, recovery point, or
      feature commitment absent an approved Order.

## Release gate for a policy or material product change

- [ ] Update the repository data-flow map and subprocessor list.
- [ ] Review Privacy Policy categories, purposes, legal bases, disclosures,
      retention, rights, cookies/storage, regional terms, and the California table.
- [ ] Review Terms feature descriptions, acceptable use, prohibited data,
      third-party allocations, warranty, indemnity, liability, billing, and
      termination.
- [ ] Review DPA processing details, security measures, subprocessor notice,
      transfer clauses, and U.S. service-provider terms.
- [ ] Obtain counsel and executive approval where the risk or data use is material.
- [ ] Update effective dates, archive the old version, and decide whether notice or
      renewed acceptance is required.
- [ ] Run marketing-site typecheck, lint, build, rendered-route tests, link checks,
      and mobile/desktop accessibility review.
- [ ] Verify production `/privacy` and `/terms`, footer links, canonical URLs,
      sitemap entries, consent-policy link, email deliverability, and the stored
      acceptance version.
