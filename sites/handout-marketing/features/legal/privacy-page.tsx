import Link from "next/link"

import {
  LegalAddress,
  LegalCallout,
  LegalDocument,
  LegalTable,
  type LegalSection,
} from "@/features/legal/legal-document"
import { legalConfig } from "@/features/legal/legal-config"

const sections: ReadonlyArray<LegalSection> = [
  {
    id: "scope-and-roles",
    number: "01",
    title: "Scope and our privacy roles",
    shortTitle: "Scope and roles",
    children: (
      <>
        <p>
          This Privacy Policy explains how {legalConfig.operatorDescription}{" "}
          (&ldquo;<strong>Handout</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
          &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>our</strong>&rdquo;)
          collects, uses, discloses, and otherwise processes personal information.
          It applies to our website at{" "}
          <Link href={legalConfig.websiteUrl}>handout.link</Link>, the Handout
          application, browser extension, APIs, Model Context Protocol
          (&ldquo;MCP&rdquo;) tools, support and business communications, and the
          infrastructure used to deliver customer-created Handout sites
          (collectively, the &ldquo;<strong>Services</strong>&rdquo;).
        </p>
        <p>
          This Policy covers account users, prospective customers, people who
          communicate with us, recipients whose information a customer enters, and
          visitors to customer-created sites. It does not govern a customer&rsquo;s
          independent practices, a third-party site or service, or information that
          cannot reasonably be linked to a person.
        </p>
        <LegalCallout title="The role depends on the context">
          When we decide why and how information is used for our own website,
          accounts, billing, security, support, and product operations, Handout is
          the controller or business. When a customer uses Handout to publish a
          site, personalize it for a recipient, measure engagement, record a
          consented session, or send a webhook, the customer generally decides the
          purpose and means. In that context the customer is the controller or
          business and Handout processes information as its processor or service
          provider. Contact the site owner first about that owner&rsquo;s use of
          visitor information.
        </LegalCallout>
        <p>
          A customer may have its own privacy notice, legal basis, consent
          obligations, and retention choices. If this Policy conflicts with our
          data processing terms for information we process for a customer, the
          data processing terms govern that processing.
        </p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    number: "02",
    title: "Information we collect",
    shortTitle: "Information collected",
    children: (
      <>
        <h3>Information you or your organization provide</h3>
        <ul>
          <li>
            <strong>Account and profile information:</strong> name, business email
            address, password or one-time verification information, profile image,
            job or company details you choose to add, preferences, and
            authentication records.
          </li>
          <li>
            <strong>Workspace and team information:</strong> organization and
            workspace names, slugs and domains, logos, team memberships, roles,
            invitee email addresses, invitations, and administrator actions.
          </li>
          <li>
            <strong>Customer Content:</strong> text, layouts, structured editor
            content, images, logos, GIFs, links, files, videos, embeds, calendar
            links, variables, design settings, drafts, published versions, and
            collaborative editing data.
          </li>
          <li>
            <strong>Recipient and personalization information:</strong> recipient
            name, company, website or domain, customer-defined variable values,
            public-link codes, and other information a customer chooses to use to
            personalize a site. Handout is not designed to store recipient email
            addresses in the canonical recipient record.
          </li>
          <li>
            <strong>Billing and transaction information:</strong> plan, billing
            interval, seat count, subscription status, transaction references, and
            Stripe customer, subscription, price, and billing-period identifiers.
            Stripe collects and processes payment-card and bank details; Handout
            does not store full payment-card numbers.
          </li>
          <li>
            <strong>Communications:</strong> support requests, feedback, survey
            responses, security reports, legal requests, and related attachments
            and correspondence.
          </li>
          <li>
            <strong>Integrations and automations:</strong> webhook configuration,
            destination host, encrypted endpoint and signing secret, trigger and
            filter settings, delivery status, and payload snapshots; credentials,
            authorization grants, and commands for customer-authorized MCP or
            agent clients; and configuration for optional third-party content.
          </li>
        </ul>

        <h3>Information collected automatically from account users</h3>
        <ul>
          <li>
            <strong>Device and network information:</strong> IP address, browser
            and operating-system type, user agent, device characteristics, request
            timestamps, and general network and diagnostic data.
          </li>
          <li>
            <strong>Usage and security information:</strong> authentication and
            session activity, feature interactions, error and performance data,
            audit-relevant actions, rate-limit signals, and suspected abuse or
            security events.
          </li>
          <li>
            <strong>Local application information:</strong> interface preferences,
            recovery and navigation state, and local offline copies of
            collaborative documents maintained in browser storage.
          </li>
        </ul>
        <p>
          Some information is required to create an account, secure access, enter a
          subscription, or provide a requested feature. If you do not provide it,
          we may be unable to create the account, process payment, or deliver that
          feature. Other profile, content, recipient, and integration information
          is optional and is processed when a user chooses to provide or configure
          it.
        </p>

        <h3>Information from other sources</h3>
        <p>
          We may receive information from your organization&rsquo;s administrator
          or team members, payment and email providers, authentication and
          infrastructure providers, security and fraud-prevention sources, public
          websites a user asks us to access for a company logo or remote asset, and
          a third-party client that a user authorizes to access Handout. We may
          combine that information with information described above.
        </p>
      </>
    ),
  },
  {
    id: "customer-sites",
    number: "03",
    title: "Visitors to customer-created sites",
    shortTitle: "Customer-site visitors",
    children: (
      <>
        <p>
          Customer-created sites may be personalized and may include measurement
          features chosen by the customer. The particular settings for a site or
          recipient determine what Handout processes.
        </p>
        <h3>Public link and personalization context</h3>
        <p>
          When you open a Handout site, the public URL or link code may identify a
          site and a customer-defined recipient record. Personalized links may
          contain a recipient name, company, domain, or variable in the path or
          query string. URLs can be visible to anyone who receives or forwards the
          link and may be stored in browser history, server or network logs, chat
          previews, and referrer information handled by third parties. Do not treat
          a Handout link as an access-controlled data room.
        </p>
        <h3>Activity measurement</h3>
        <p>
          If the site owner enables activity measurement and any required consent
          has been obtained, Handout may process a site visit, button or link
          click, tab change, visit time, active time, session state, and a limited
          link-preview or bot signal. We may derive a broad browser, operating
          system, and device category from the user agent and use trusted edge
          headers to record a coarse city, region, and country.
        </p>
        <p>
          Handout&rsquo;s customer-site activity system is designed not to store a
          raw visitor IP address, persistent device identifier or fingerprint,
          full visited URL, URL query or fragment, referring URL, arbitrary DOM
          labels, or a cross-site browsing profile in the customer-facing tracking
          record. A raw IP address may be processed transiently for security,
          rate-limiting, customer-configured internal-network suppression, and
          coarse geolocation, and then discarded from that record. Infrastructure
          providers may retain network logs for security and service delivery.
        </p>
        <h3>Session replay</h3>
        <p>
          A site owner on an eligible plan may enable session replay only after
          accepting the replay terms and obtaining the visitor&rsquo;s affirmative
          consent where Handout presents the choice. Replay may capture a
          time-ordered, sanitized representation of visible page text and
          structure, clicks, cursor movements, scrolling, viewport changes, timing,
          and page changes so the owner can understand the visit.
        </p>
        <p>
          Handout configures replay to mask values entered into input fields and
          text areas and to omit placeholders, scripts, embedded frames, designated
          blocked regions, canvas contents, cross-origin frames, clipboard data,
          cookies, browser storage, audio, camera, microphone, and raw IP
          addresses. URL credentials, query strings, and fragments are removed
          from recorded URLs. Image or font inlining is disabled. These controls
          reduce risk but cannot guarantee that a customer will never place
          personal information in otherwise visible page text or misconfigure its
          content.
        </p>
        <p>
          Replay is bounded to approximately ten minutes, 20,000 captured events,
          or 5 MiB of uncompressed event data per recording, whichever limit is
          reached first. Selecting &ldquo;decline&rdquo; prevents consent-gated
          measurement from starting. Withdrawing through the site&rsquo;s Privacy
          choices control stops ongoing consent-gated collection for that browser.
        </p>
        <h3>Customer-directed webhooks</h3>
        <p>
          A customer may configure Handout to send selected visit or interaction
          data to an HTTPS endpoint that the customer controls or selects. The
          destination receives information on the customer&rsquo;s instructions and
          is governed by the customer&rsquo;s and destination provider&rsquo;s
          practices. Handout signs deliveries when configured; endpoint and signing
          credentials are encrypted at rest.
        </p>
      </>
    ),
  },
  {
    id: "extension-agents",
    number: "04",
    title: "Browser extension, APIs, MCP, and agents",
    shortTitle: "Extension and agents",
    children: (
      <>
        <h3>Gmail browser extension</h3>
        <p>
          The Handout extension uses browser identity and local-storage
          permissions and runs on Gmail pages so a signed-in user can select a
          recipient and insert a Handout link or card into a draft. It reads the
          primary compose recipient&rsquo;s email address and displayed name and a
          compose identifier locally to provide that action. It is designed not to
          read or transmit the email subject, message body, thread contents,
          attachments, contacts, or Google access tokens. It transmits information
          to Handout only when needed for a user-requested Handout action. The
          extension stores a Handout access token and recent preferences in local
          browser-extension storage.
        </p>
        <h3>Customer-authorized clients and agents</h3>
        <p>
          Handout may expose APIs or MCP tools that let a user-authorized software
          client or AI agent list, create, read, update, validate, publish, or
          delete customer content and recipients, or read tracking information.
          We process the authorization grant, access token, tool input, tool output,
          and relevant audit or security data required to provide that access. The
          third-party client or model provider independently processes information
          the user sends to it under its own terms and privacy policy. Handout does
          not send Customer Content to an AI model merely because MCP access is
          available. We do not use Customer Content to train a shared generative-AI
          model or disclose it to a model provider for that provider&rsquo;s
          training unless the customer expressly directs or separately agrees to
          that use.
        </p>
      </>
    ),
  },
  {
    id: "cookies-storage",
    number: "05",
    title: "Cookies and local storage",
    shortTitle: "Cookies and storage",
    children: (
      <>
        <p>
          We use cookies and similar technologies such as local storage,
          session storage, IndexedDB, and browser-extension storage. The following
          summarizes their principal current uses.
        </p>
        <LegalTable
          caption="Handout storage technologies"
          headers={["Context", "Technology and data", "Purpose / duration"]}
          rows={[
            [
              "Account and app",
              "Secure session cookie and authentication records",
              "Sign-in, account security, and session continuity; expires or is revoked under the applicable session settings.",
            ],
            [
              "App interface",
              "Cookie or local/session storage for preferences and recovery state",
              "Remember interface choices and short-lived navigation, copy, or recovery state.",
            ],
            [
              "Collaborative editor",
              "IndexedDB offline document data",
              "Support local-first collaboration and recovery. It remains on the device until cleared by the user, browser, or application behavior.",
            ],
            [
              "Customer site",
              "Local-storage consent record containing allow/decline, notice version, and decision time",
              "Remember the visitor’s privacy choice for that site and browser for up to 180 days, unless cleared or replaced.",
            ],
            [
              "Customer-site measurement",
              "No Handout persistent visitor cookie or cross-site device ID",
              "Measurement uses the site/link context and a logical visit session after required consent.",
            ],
            [
              "Gmail extension",
              "Browser-extension storage for Handout access token and recent preferences",
              "Authenticate and make the extension usable until sign-out, revocation, removal, or local clearing.",
            ],
          ]}
        />
        <p>
          Strictly necessary technologies support authentication, security, load
          management, requested functionality, and privacy choices. We seek an
          active choice before starting customer-site measurement that requires
          consent. Blocking necessary storage may prevent parts of the Services
          from working. A customer&rsquo;s embedded content may use third-party
          cookies or storage under the third party&rsquo;s policies.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    number: "06",
    title: "How we use personal information",
    shortTitle: "How information is used",
    children: (
      <>
        <p>We use personal information to:</p>
        <ul>
          <li>
            provide, authenticate, operate, maintain, personalize, and support the
            Services;
          </li>
          <li>
            create and manage accounts, workspaces, teams, invitations, sites,
            recipient links, published versions, previews, integrations, and
            subscriptions;
          </li>
          <li>
            process customer instructions, including consented site measurement,
            replay, webhooks, and authorized API or agent actions;
          </li>
          <li>
            communicate about transactions, verification, password resets,
            invitations, service changes, support, security, and legal matters;
          </li>
          <li>
            send requested product news, events, surveys, or business marketing
            where permitted, and manage communication preferences and opt-outs;
          </li>
          <li>
            provide customer service, diagnose errors, test features, understand
            aggregate product performance, and improve usability and reliability;
          </li>
          <li>
            prevent fraud, spam, malware, unauthorized access, abuse, excessive
            resource use, and violations of our Terms;
          </li>
          <li>
            protect users, visitors, Handout, and the public; enforce agreements;
            preserve evidence; and establish, exercise, or defend legal claims;
          </li>
          <li>
            comply with law, valid legal process, sanctions, accounting, tax, and
            regulatory obligations; and
          </li>
          <li>
            conduct a merger, financing, acquisition, reorganization, bankruptcy,
            sale of assets, or similar corporate transaction.
          </li>
        </ul>
        <p>
          We may aggregate or de-identify information and use it for lawful
          purposes. We will not attempt to re-identify data that applicable law
          requires us to maintain as de-identified.
        </p>
      </>
    ),
  },
  {
    id: "legal-bases",
    number: "07",
    title: "Legal bases for processing",
    shortTitle: "Legal bases",
    children: (
      <>
        <p>
          Where European Economic Area, United Kingdom, Swiss, or similar law
          requires a legal basis, our bases depend on the context:
        </p>
        <ul>
          <li>
            <strong>Contract:</strong> processing needed to provide an account or
            requested Service, administer subscriptions, and respond to requested
            support.
          </li>
          <li>
            <strong>Legitimate interests:</strong> securing and improving the
            Services, preventing abuse, communicating with business users,
            administering our business, and protecting legal rights, balanced
            against affected individuals&rsquo; rights.
          </li>
          <li>
            <strong>Consent:</strong> where we ask for an optional choice, including
            consent-gated measurement or session replay. Consent may be withdrawn
            without affecting earlier lawful processing.
          </li>
          <li>
            <strong>Legal obligation:</strong> tax, accounting, compliance, lawful
            requests, and other obligations imposed by law.
          </li>
          <li>
            <strong>Legal claims and vital interests:</strong> where necessary to
            protect a person or establish, exercise, or defend claims.
          </li>
        </ul>
        <p>
          When we act for a customer, the customer determines the legal basis for
          its processing. Customers must not enable tracking, replay, embeds,
          personalization, or webhooks unless they have a valid basis and provide
          all required notices and choices.
        </p>
      </>
    ),
  },
  {
    id: "disclosures",
    number: "08",
    title: "How we disclose information",
    shortTitle: "Disclosures",
    children: (
      <>
        <p>We may disclose personal information to:</p>
        <ul>
          <li>
            <strong>Your organization and workspace:</strong> administrators and
            authorized team members may access and control workspace accounts,
            content, recipients, tracking, integrations, billing, and audit-relevant
            activity. If you use an organization email address, we may help the
            organization verify or administer its relationship with the account.
          </li>
          <li>
            <strong>The public and link recipients:</strong> published sites,
            assets, recipient-specific content, and generated preview images are
            available to anyone with the relevant public link and may be cached,
            copied, indexed if enabled, or shared.
          </li>
          <li>
            <strong>Service providers and subprocessors:</strong> companies that
            provide hosting, storage, databases, edge delivery, email, payments,
            security, error diagnosis, and support under contracts limiting their
            use of the information.
          </li>
          <li>
            <strong>Customer-directed recipients:</strong> webhook endpoints,
            embedded-service providers, remote asset hosts, MCP or API clients, and
            other services a customer chooses to connect or display.
          </li>
          <li>
            <strong>Professional advisers and transaction parties:</strong>
            lawyers, auditors, insurers, lenders, investors, and actual or
            prospective participants in a corporate transaction, subject to
            appropriate safeguards.
          </li>
          <li>
            <strong>Authorities and affected parties:</strong> when we reasonably
            believe disclosure is required by law or valid process, or necessary
            to protect rights, safety, security, property, users, or the public.
          </li>
        </ul>
        <p>
          We do not sell personal information for money. We do not share personal
          information for cross-context behavioral advertising, use it for
          targeted advertising, or profile people to make decisions producing
          legal or similarly significant effects. We have not done so in the
          preceding 12 months. We do not knowingly sell or share the personal
          information of anyone under 18.
        </p>
      </>
    ),
  },
  {
    id: "third-parties",
    number: "09",
    title: "Third-party content and customer directions",
    shortTitle: "Third parties",
    children: (
      <>
        <p>
          A customer site may load an image, GIF, video, iframe, calendar, social
          preview, or other content from a third party such as GIPHY, YouTube,
          Vimeo, Loom, Calendly, or Cal.com. The editor may also request search
          results from GIPHY or a company logo from Logo.dev. Loading third-party
          content can disclose the visitor&rsquo;s IP address, browser information,
          referring page, and interaction data directly to that provider and may
          allow the provider to set its own cookies.
        </p>
        <p>
          The customer selects and controls those resources. Their providers are
          independent parties governed by their own notices. Handout does not
          control their collection, security, availability, or use. Site owners
          must evaluate whether to gate an embed or obtain additional consent.
        </p>
        <p>
          Our marketing website may load interactive presentation code through
          Unicorn Studio and the jsDelivr content-delivery network. Those providers
          may receive ordinary network and browser request information, such as an
          IP address, user agent, requested asset, and time, under their own
          practices.
        </p>
      </>
    ),
  },
  {
    id: "subprocessors",
    number: "10",
    title: "Service providers and subprocessors",
    shortTitle: "Subprocessors",
    children: (
      <>
        <p>
          The following providers support material parts of the current Services.
          A provider may process information in the United States and other
          countries where it or its approved subprocessors operate.
        </p>
        <LegalTable
          caption="Handout service providers and subprocessors"
          headers={["Provider", "Purpose", "Data involved"]}
          rows={[
            [
              "Cloudflare, Inc.",
              "DNS, edge security and delivery, Pages/Workers hosting, caching, and private R2 object storage",
              "Network and request data, public content, and encrypted or access-controlled replay/preview objects as applicable",
            ],
            [
              "Render Services, Inc.",
              "API, background-worker, and scheduled-job hosting in the United States",
              "Account, workspace, content, tracking, automation, and operational data processed by the application",
            ],
            [
              "Neon, Inc.",
              "Managed PostgreSQL database infrastructure",
              "Account, workspace, content, recipient, tracking, integration, billing-reference, and operational records",
            ],
            [
              "Resend, Inc.",
              "Transactional email delivery",
              "Email address, name where needed, template variables, delivery and diagnostic data",
            ],
            [
              "Stripe, Inc.",
              "Checkout, subscription, invoicing, tax, fraud prevention, and payment processing",
              "Contact, organization, plan, seat, transaction, payment, and billing information",
            ],
            [
              "Logo.dev",
              "Customer-requested company-logo lookup",
              "Requested company domain and related network/diagnostic data",
            ],
            [
              "jsDelivr and Unicorn Studio",
              "Delivery and operation of interactive visuals on Handout’s marketing website",
              "IP address, user agent, requested asset, referring page, timing, and related network/diagnostic data",
            ],
          ]}
        />
        <p>
          GIPHY and customer-selected embed, webhook, or agent providers receive
          information at the user&rsquo;s direction and may act as independent
          controllers rather than Handout subprocessors. We may replace or add
          providers as our Services evolve. Customers with a DPA receive the
          subprocessor notice and objection rights described there.
        </p>
      </>
    ),
  },
  {
    id: "international-transfers",
    number: "11",
    title: "International data transfers",
    shortTitle: "International transfers",
    children: (
      <>
        <p>
          Handout is based in the United States. If you access the Services from
          another country, information may be transferred to and processed in the
          United States and other jurisdictions whose laws may differ from yours.
        </p>
        <p>
          Where required, we use approved transfer safeguards such as the European
          Commission&rsquo;s Standard Contractual Clauses and the UK International
          Data Transfer Addendum, with supplementary measures as appropriate. We
          do not claim participation in a privacy certification or framework
          unless it is expressly stated on this page. You may request information
          about the safeguard relevant to your transfer by contacting us.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    number: "12",
    title: "Retention and deletion",
    shortTitle: "Retention",
    children: (
      <>
        <p>
          We retain personal information only as long as reasonably necessary for
          the purposes described here, customer instructions, and legal, security,
          tax, accounting, dispute, and enforcement needs. Criteria include the
          account or contract term, configuration selected by a customer, data
          sensitivity, backup cycles, limitation periods, and the need to prevent
          abuse or preserve evidence.
        </p>
        <LegalTable
          caption="Key Handout retention periods"
          headers={["Data", "Current operational period", "What happens next"]}
          rows={[
            [
              "Customer-site activity events and session summaries",
              "Customer-selected 30, 90, 180, or 365 days; 90 days by default",
              "Expired events and related session data are deleted or de-identified through retention jobs, subject to backups and legal holds.",
            ],
            [
              "Session replay objects and metadata",
              "Customer-selected 7, 14, or 30 days; 14 days by default and 30 days maximum",
              "Objects and metadata are queued for deletion; provider lifecycle and backup copies may persist for a limited period.",
            ],
            [
              "Webhook message payload snapshots",
              "7 days after creation, once no delivery is pending",
              "Payload fields are redacted; limited delivery activity may remain.",
            ],
            [
              "Webhook messages, retired revisions, and delivery activity",
              "30 days after creation or retirement, once no delivery is pending",
              "Activity is deleted; monthly aggregate usage may be retained for up to 12 months.",
            ],
            [
              "Customer-site consent choice",
              "Up to 180 days in that site visitor’s browser",
              "Replaced by a new decision or removed when browser storage is cleared.",
            ],
            [
              "Account, workspace, content, recipients, and billing references",
              "For the account or subscription term and a reasonable period afterward",
              "Deleted, returned, de-identified, or retained only where needed for backup cycles, security, payment, tax, claims, or legal obligations.",
            ],
            [
              "Support, security, and legal records",
              "For the time needed to resolve the matter and meet limitation, audit, compliance, or enforcement needs",
              "Deleted or de-identified when the purpose no longer applies.",
            ],
          ]}
        />
        <p>
          Public content or preview images copied, cached, indexed, or shared by
          recipients or third parties may remain outside our control after a
          customer unpublishes or deletes it. Local offline editor data may remain
          on a user&rsquo;s device until browser data is cleared. Deletion from
          active systems does not always immediately remove encrypted backup
          copies; backups remain protected and age out under ordinary cycles unless
          law requires preservation.
        </p>
      </>
    ),
  },
  {
    id: "security",
    number: "13",
    title: "Security",
    shortTitle: "Security",
    children: (
      <>
        <p>
          We use administrative, technical, and organizational safeguards designed
          for the nature of the Services and information, including transport
          encryption, access controls, tenant-aware authorization, secret and
          credential protection, private object storage for replay data,
          rate-limiting, log redaction, security monitoring, backup and recovery
          measures, and software testing. We review safeguards as risks and the
          Services evolve.
        </p>
        <p>
          No service, network, or storage method is completely secure. Customers
          are responsible for strong credentials, account access, team roles,
          endpoint security, link sharing, connected services, and promptly
          reporting suspected compromise. Email us immediately if you believe an
          account, public link, or integration has been compromised.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    number: "14",
    title: "Your privacy rights",
    shortTitle: "Privacy rights",
    children: (
      <>
        <p>
          Depending on where you live and subject to exceptions, you may have the
          right to request access, confirmation, correction, deletion, portability,
          or restriction of personal information; object to processing; withdraw
          consent; opt out of certain sales, sharing, targeted advertising, or
          profiling; obtain information about or a list of recipients where
          applicable; and appeal a denied request. You may also complain to your
          local data-protection authority.
        </p>
        <p>
          Email <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>{" "}
          with the subject &ldquo;Privacy Request.&rdquo; Describe the right and
          context, and provide enough information for us to locate the relevant
          account or visit. For a customer-site visit, include the public site
          address, approximate date and time, and site owner if known. Avoid
          emailing passwords, full payment details, or other sensitive information.
        </p>
        <p>
          If Handout processed the information only for a customer, we may direct
          the request to that customer and assist it as required. We may verify your
          identity and authority using information proportionate to the request. An
          authorized agent may submit a request where law permits; we may require
          proof of authorization and direct verification with the individual. We
          will not discriminate against you for exercising a right.
        </p>
        <p>
          To appeal a decision, reply to our response with &ldquo;Privacy
          Appeal&rdquo; and explain your concern. We will respond within the period
          required by applicable law and provide any regulator contact required
          after a denied appeal.
        </p>
        <p>
          You may opt out of optional marketing at any time through the unsubscribe
          mechanism in the message or by contacting us. We may still send
          transactional, security, billing, and legal communications needed for
          the account or Services.
        </p>
      </>
    ),
  },
  {
    id: "california",
    number: "15",
    title: "United States state privacy disclosures",
    shortTitle: "US state disclosures",
    children: (
      <>
        <p>
          This section supplements the Policy for residents of California and
          other states with comprehensive privacy laws. In the preceding 12
          months, depending on the person and features used, we collected the
          categories below. The examples are descriptive and do not mean we
          collect every item about every person.
        </p>
        <LegalTable
          caption="United States privacy-law categories"
          headers={["Category", "Examples", "Sources and recipients"]}
          rows={[
            [
              "Identifiers",
              "Name, business email, account ID, IP address, session token, public-link code, device or integration identifier",
              "You, your organization, devices, customers, and providers; disclosed as described in Sections 8 and 10.",
            ],
            [
              "Customer-record and commercial information",
              "Organization, subscription, plan, seat count, invoices, payment references, support and transaction history",
              "You, organization administrators, and Stripe; disclosed to business providers and advisers.",
            ],
            [
              "Internet or electronic activity",
              "Authentication, app use, customer-site interactions, clicks, scrolling, session timing, replay, browser and device category",
              "Devices and service interactions; disclosed to the applicable customer and infrastructure providers.",
            ],
            [
              "Approximate geolocation",
              "Coarse city, region, and country derived from trusted network headers",
              "Network and edge provider; disclosed to the applicable customer and service providers.",
            ],
            [
              "Professional or employment-related information",
              "Business affiliation, role, customer-entered recipient company, or profile details",
              "You, your organization, customers, and public/business sources at a user’s direction.",
            ],
            [
              "Visual or interaction information",
              "Profile images, uploaded assets, public content, and sanitized session-replay representations; no replay audio",
              "Users, customers, and consented visitor interactions; disclosed to authorized workspace users and processors.",
            ],
            [
              "Inferences",
              "Broad browser, operating-system, or device category inferred from user agent",
              "Technical signals; disclosed to the applicable customer and providers. We do not use these for significant automated decisions.",
            ],
            [
              "Sensitive personal information",
              "Account credentials and precise access tokens; content a customer improperly submits may contain other sensitive information",
              "Users and customers; used only for permitted service, security, and compliance purposes, not to infer characteristics.",
            ],
          ]}
        />
        <p>
          We collect and use these categories for the business and commercial
          purposes in Section 6 and retain them using the criteria in Section 12.
          We do not use or disclose sensitive personal information for purposes
          requiring a California right to limit. We do not offer financial
          incentives for personal information.
        </p>
        <p>
          Because we do not sell or share personal information for cross-context
          behavioral advertising, we do not provide a sale/share opt-out link. We
          do not respond to browser-based opt-out preference signals as a
          sale/share request where no such processing occurs. We will honor any
          legally required signal if our practices change.
        </p>
        <p>
          We do not disclose personal information to third parties for their own
          direct-marketing purposes as contemplated by California&rsquo;s
          &ldquo;Shine the Light&rdquo; law. California residents may still contact
          us with a request about that practice.
        </p>
      </>
    ),
  },
  {
    id: "children",
    number: "16",
    title: "Children",
    shortTitle: "Children",
    children: (
      <>
        <p>
          The Services are business tools and are not directed to children under
          18. You must be at least 18 to create or use an account. Customers may
          not use Handout to intentionally collect personal information from
          children under 13 in the United States, under 16 in the EEA or United
          Kingdom where consent rules apply, or under the corresponding minimum
          age in another jurisdiction, without our prior written approval and all
          legally required parental authorization.
        </p>
        <p>
          If you believe a child provided personal information to us contrary to
          this section, contact us so we can investigate and take appropriate
          action.
        </p>
      </>
    ),
  },
  {
    id: "sensitive-data",
    number: "17",
    title: "Sensitive and regulated information",
    shortTitle: "Sensitive information",
    children: (
      <>
        <p>
          Handout is not designed for protected health information subject to
          HIPAA, payment-card data subject to PCI DSS beyond use of Stripe&rsquo;s
          payment interface, nonpublic consumer financial information governed by
          GLBA, biometric identifiers, precise geolocation, genetic data, education
          records, government identifiers, account passwords, or other highly
          sensitive or specially regulated data in Customer Content, recipient
          variables, replay-visible content, or webhook payloads.
        </p>
        <p>
          Do not submit that information unless Handout has expressly agreed in
          writing to the processing and any required addendum. We do not sign a
          HIPAA Business Associate Agreement through standard online acceptance.
          Customers remain responsible for determining whether their content,
          visitors, recipients, and intended use are appropriate for the Services.
        </p>
      </>
    ),
  },
  {
    id: "regional-information",
    number: "18",
    title: "Additional regional information",
    shortTitle: "Regional information",
    children: (
      <>
        <h3>EEA, United Kingdom, and Switzerland</h3>
        <p>
          Handout is the controller for the account and operational processing
          identified in Section 1. You may contact us about our legitimate-interest
          assessment or transfer safeguards. You may lodge a complaint with the
          supervisory authority where you live, work, or believe a violation
          occurred. If applicable law requires Handout to appoint a local
          representative for processing within its territorial scope, we will make
          the representative&rsquo;s contact details available here or on request.
        </p>
        <h3>Canada</h3>
        <p>
          You may request access to or correction of personal information and ask
          about our service providers outside Canada. We rely on consent or another
          basis permitted by applicable federal or provincial law and use
          contractual and other measures for transferred information.
        </p>
        <h3>Australia, Brazil, and other jurisdictions</h3>
        <p>
          We honor rights required by applicable law, including access, correction,
          deletion, information about processing and sharing, portability,
          revocation of consent, and review of automated decisions where relevant.
          Handout does not currently use personal information for solely automated
          decisions with legal or similarly significant effects.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    number: "19",
    title: "Changes to this Policy",
    shortTitle: "Policy changes",
    children: (
      <>
        <p>
          We may update this Policy to reflect changes in law, providers,
          technology, or the Services. We will post the revised version and update
          the date above. If a change materially reduces protections or introduces
          a materially different use of personal information, we will provide
          additional notice or seek consent where required. Earlier versions may
          be requested by email.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    number: "20",
    title: "Contact us",
    shortTitle: "Contact",
    children: (
      <>
        <p>
          Questions, privacy requests, and complaints may be sent to:
        </p>
        <LegalAddress>
          <strong>{legalConfig.operatorDescription}</strong>
          <br />
          Attn: Privacy
          <br />
          {legalConfig.address}
          <br />
          Email:{" "}
          <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>
        </LegalAddress>
        <p>
          Please use &ldquo;Privacy Request&rdquo; in the subject line. If your
          request concerns a customer-created site, identify that site and its
          owner if possible so we can route the request without unnecessary delay.
        </p>
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal · Privacy"
      title="Privacy Policy"
      description="How Handout handles account data, customer content, recipient personalization, visitor analytics, session replay, browser-extension data, and connected services."
      effectiveDate={legalConfig.effectiveDate}
      scopeItems={[
        {
          label: "App and account",
          description:
            "Handout is generally the controller for accounts, billing, security, support, and our own operations.",
        },
        {
          label: "Customer-created sites",
          description:
            "The site owner generally controls personalization, visitor measurement, replay, and downstream use.",
        },
        {
          label: "Connected services",
          description:
            "Embeds, webhooks, payment, extension, and agent clients may send data to providers selected by Handout or the customer.",
        },
      ]}
      sections={sections}
      relatedLink={{ href: "/terms", label: "Terms of Service" }}
    />
  )
}
