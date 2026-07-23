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
    id: "agreement",
    number: "01",
    title: "Agreement and order of precedence",
    shortTitle: "Agreement",
    children: (
      <>
        <p>
          These Terms of Service (the &ldquo;<strong>Terms</strong>&rdquo;) are a
          legally binding agreement between {legalConfig.operatorDescription}{" "}
          (&ldquo;<strong>Handout</strong>,&rdquo; &ldquo;<strong>we</strong>,&rdquo;
          &ldquo;<strong>us</strong>,&rdquo; or &ldquo;<strong>our</strong>&rdquo;)
          and the person or organization accepting them
          (&ldquo;<strong>Customer</strong>,&rdquo; &ldquo;<strong>you</strong>,&rdquo;
          or &ldquo;<strong>your</strong>&rdquo;). They govern access to and use of
          Handout&rsquo;s websites, application, customer-created sites, browser
          extension, APIs, MCP tools, tracking, session replay, integrations,
          previews, and related services, documentation, and support
          (collectively, the &ldquo;<strong>Services</strong>&rdquo;).
        </p>
        <p>
          You accept these Terms by creating an account, clicking to accept,
          executing an Order, or accessing or using the Services. If you do not
          agree, do not use the Services. If you use the Services for an
          organization, &ldquo;Customer&rdquo; means that organization and you
          represent that you have authority to bind it.
        </p>
        <p>
          An &ldquo;<strong>Order</strong>&rdquo; means an online checkout,
          order form, statement of work, or other document accepted by Handout that
          identifies Services, fees, or a subscription term. If documents conflict,
          the order is: (1) an expressly negotiated Order; (2) the Data Processing
          Addendum in Sections D1–D10 for personal data processing; (3) these Terms;
          and (4) product documentation. A purchase order or Customer form is for
          administrative convenience only and does not modify this agreement unless
          Handout expressly signs it.
        </p>
        <LegalCallout title="Business service; arbitration agreement">
          The Services are offered for business and professional use, not personal,
          family, or household use. Section 24 requires most disputes to be resolved
          by binding individual arbitration and includes a class-action and jury
          waiver. Review it carefully.
        </LegalCallout>
      </>
    ),
  },
  {
    id: "eligibility",
    number: "02",
    title: "Eligibility and authority",
    shortTitle: "Eligibility",
    children: (
      <>
        <p>
          You must be at least 18, legally able to contract, and using the Services
          for business purposes. You may not use the Services if you are barred
          under applicable law, subject to sanctions that prohibit the relationship,
          or acting for a competitor to evaluate, benchmark, or copy the Services
          without our written permission.
        </p>
        <p>
          If an organization invited you, its administrator may control your
          account and workspace, access or export Customer Content, manage members
          and permissions, change or cancel the subscription, and request account
          transfer or deletion. Your relationship with that organization is between
          you and it.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    number: "03",
    title: "Accounts, administrators, and security",
    shortTitle: "Accounts and security",
    children: (
      <>
        <p>
          You must provide accurate, current information; keep it updated; protect
          passwords, one-time codes, sessions, extension tokens, API credentials,
          MCP grants, and webhook secrets; and use reasonable device and endpoint
          security. Accounts and seats are for the assigned individual and may not
          be shared. You are responsible for activity under your accounts and for
          users, agents, applications, and endpoints you authorize.
        </p>
        <p>
          Customer administrators are responsible for assigning least-privilege
          roles, promptly removing former personnel, reviewing connected clients
          and destinations, and keeping workspace and billing contacts current.
          Notify us immediately at{" "}
          <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>{" "}
          of suspected compromise, unauthorized access, or credential disclosure.
          We may require credential rotation, revoke sessions or tokens, or take
          protective action.
        </p>
      </>
    ),
  },
  {
    id: "services",
    number: "04",
    title: "The Services, changes, and availability",
    shortTitle: "The Services",
    children: (
      <>
        <p>
          Subject to these Terms and payment of applicable fees, Handout grants
          Customer a limited, non-exclusive, non-transferable, non-sublicensable
          right during the subscription term to access and use the Services for
          Customer&rsquo;s internal business operations and authorized
          client-facing sites. Documentation and plan descriptions may identify
          usage limits, entitlements, retention choices, seats, storage,
          automations, recordings, or support levels.
        </p>
        <p>
          We may improve, modify, replace, or discontinue features to address law,
          security, abuse, provider changes, technical constraints, or product
          development. We will use commercially reasonable efforts to give advance
          notice before discontinuing a material paid feature where practicable. If
          we discontinue the core paid Service during a prepaid term without a
          substantially similar replacement, Customer&rsquo;s exclusive remedy is
          a pro-rata refund of unused prepaid fees for that discontinued Service.
        </p>
        <p>
          We do not promise uninterrupted or error-free operation. Maintenance,
          incidents, internet conditions, provider outages, browser changes, Gmail
          or marketplace changes, Customer configurations, or force majeure may
          affect availability. No service-level agreement, support response time,
          backup commitment, or data-residency commitment applies unless an Order
          expressly says so.
        </p>
        <h3>Free, preview, beta, and experimental features</h3>
        <p>
          Free, trial, beta, preview, early-access, and experimental features may
          be changed or withdrawn at any time, may be incomplete, and may have
          different limits or support. They are provided &ldquo;AS IS&rdquo; without
          any commitment to continued availability and should not be used for
          mission-critical or regulated workloads.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    number: "05",
    title: "Subscriptions, fees, renewal, and taxes",
    shortTitle: "Billing",
    children: (
      <>
        <h3>Subscriptions and automatic renewal</h3>
        <p>
          Paid Services are sold for the billing period shown at checkout or in an
          Order, usually monthly or annually. Unless an Order states otherwise,
          each paid subscription automatically renews for successive periods of
          the same length until canceled. By purchasing, Customer authorizes
          Handout and Stripe to charge the payment method on file for recurring
          fees, additional seats, usage, taxes, and approved adjustments.
        </p>
        <h3>Fees and plan changes</h3>
        <p>
          Fees are stated in U.S. dollars unless the checkout says otherwise and
          are due in advance or as invoiced. Seat or plan changes may take effect
          immediately and be prorated through Stripe; a downgrade may take effect
          at the end of the current period or reduce functionality, limits, and
          retention. Customer is responsible for charges incurred by its
          administrators and authorized users. We may correct pricing or billing
          errors.
        </p>
        <p>
          We may change fees for a future renewal by giving at least 30 days&rsquo;
          notice. Continuing the subscription after the change takes effect accepts
          the new fee. If Customer does not agree, its remedy is to cancel before
          renewal.
        </p>
        <h3>Taxes and payment disputes</h3>
        <p>
          Fees exclude sales, use, value-added, withholding, and similar taxes and
          duties. Customer will pay them except taxes based on Handout&rsquo;s net
          income. If law requires withholding, Customer will gross up the payment
          so Handout receives the invoiced amount, unless prohibited. Customer must
          raise a good-faith billing dispute within 30 days of the charge and pay
          undisputed amounts on time. Overdue amounts may accrue the lesser of 1.5%
          per month or the lawful maximum, plus reasonable collection costs.
        </p>
        <h3>Cancellation and refunds</h3>
        <p>
          An administrator may cancel through the billing settings or by contacting
          us. Cancellation takes effect at the end of the then-current paid period,
          and Customer retains paid access until then unless the account is
          suspended or terminated for cause. Except where an Order or law requires
          otherwise, fees are non-cancelable and non-refundable, and we do not give
          credits for partial periods, unused seats, unused features, or Customer
          configuration. Removing the app, extension, content, or payment method
          does not itself cancel a subscription.
        </p>
      </>
    ),
  },
  {
    id: "customer-content",
    number: "06",
    title: "Customer Content and licenses",
    shortTitle: "Customer Content",
    children: (
      <>
        <p>
          &ldquo;<strong>Customer Content</strong>&rdquo; means information,
          documents, editor content, sites, assets, recipient records, variables,
          links, embeds, instructions, configuration, and other materials submitted
          to or generated through the Services for Customer, excluding Handout
          technology, aggregated or de-identified information, and third-party
          materials.
        </p>
        <p>
          As between the parties, Customer retains its rights in Customer Content.
          Customer grants Handout and its subprocessors a worldwide, non-exclusive,
          royalty-free license during the applicable term and wind-down period to
          host, copy, cache, transmit, render, modify for technical formatting,
          create previews of, display, and otherwise process Customer Content only
          to provide, secure, support, and improve the operation of the Services,
          comply with Customer instructions, and meet legal obligations.
        </p>
        <p>
          Customer represents and warrants that it has all rights, permissions,
          notices, and lawful bases necessary for Customer Content and Handout&rsquo;s
          processing under these Terms; Customer Content and its use will not
          violate law, contract, confidentiality, privacy, publicity, intellectual
          property, or other rights; and Customer&rsquo;s instructions will not
          cause Handout to violate applicable law.
        </p>
        <p>
          Handout does not acquire ownership of Customer Content and will not use a
          customer&rsquo;s name, logo, site, or content in public marketing without
          permission. Suggestions and feedback are governed by Section 18.
        </p>
      </>
    ),
  },
  {
    id: "public-sites",
    number: "07",
    title: "Published sites, recipient links, and previews",
    shortTitle: "Public sites and links",
    children: (
      <>
        <p>
          Handout sites and recipient-specific versions are link-accessible public
          webpages, not authenticated virtual data rooms. Anyone with a link may
          open, copy, forward, screenshot, download, scrape, or share it. A link
          may identify a recipient or include name, company, domain, or variable
          values in its path or query. Links and preview images may appear in
          browser history, message previews, logs, caches, search results if
          indexing is enabled, and third-party systems.
        </p>
        <p>
          Customer must use recipient links only for appropriate business
          information, avoid confidential or sensitive data, review the rendered
          result before sending, and unpublish or rotate links when access should
          end. Customer is responsible for whether content is indexed and for
          recipients to whom it distributes links. Handout does not guarantee that
          unpublishing or deletion removes copies, caches, previews, or records
          already made by a recipient or third party.
        </p>
        <p>
          Preview images may be generated through automated browser rendering and
          stored at versioned public URLs to support email and social previews. A
          preview may persist in third-party caches after the underlying site is
          changed. Customer authorizes that generation and is responsible for the
          content displayed.
        </p>
      </>
    ),
  },
  {
    id: "customer-responsibilities",
    number: "08",
    title: "Customer legal and operational responsibilities",
    shortTitle: "Customer responsibilities",
    children: (
      <>
        <p>Customer is solely responsible for:</p>
        <ul>
          <li>
            Customer Content, recipients, public links, site settings, users,
            credentials, connected clients, embeds, automations, and webhook
            destinations;
          </li>
          <li>
            providing privacy, cookie, recording, and other notices; obtaining and
            recording valid consent; honoring opt-outs and rights; and selecting
            lawful retention settings;
          </li>
          <li>
            complying with privacy, ePrivacy, wiretap, communications,
            telemarketing, advertising, anti-spam, consumer-protection, accessibility,
            employment, export, sanctions, and industry-specific laws that apply to
            its use;
          </li>
          <li>
            ensuring any email, text, call, outreach, or sales activity involving a
            Handout link complies with CAN-SPAM, TCPA, Canada&rsquo;s Anti-Spam
            Legislation (CASL), GDPR, PECR, and other applicable marketing and
            communications rules;
          </li>
          <li>
            evaluating recipients and visitors, establishing a legal basis for
            their information, responding to their requests, and ensuring
            Customer&rsquo;s downstream use is compatible with the notice and
            consent given;
          </li>
          <li>
            testing sites, links, variables, embeds, replay blocking, and webhooks
            before use and maintaining appropriate records of consent and
            instructions; and
          </li>
          <li>
            maintaining its own backup or export of information it cannot afford to
            lose and a lawful notice and incident-response process.
          </li>
        </ul>
        <p>
          Handout&rsquo;s templates, consent interface, privacy link, replay
          masking, blocking, or documentation help implement Customer choices but
          are not legal advice and do not make Customer compliant. Customer must
          consult its own counsel and adapt its practices to its audience,
          jurisdiction, content, and purpose.
        </p>
      </>
    ),
  },
  {
    id: "tracking-replay",
    number: "09",
    title: "Activity tracking and Session Replay Addendum",
    shortTitle: "Tracking and replay",
    children: (
      <>
        <p>
          This Section is the &ldquo;<strong>Session Replay Addendum</strong>&rdquo;
          referenced in the application. Enabling activity tracking or session
          replay constitutes Customer&rsquo;s acceptance of this Section for the
          workspace.
        </p>
        <h3>Permitted purpose</h3>
        <p>
          Customer may use tracking and replay only to understand legitimate
          engagement with Customer&rsquo;s own business content, improve that
          content, follow up lawfully, prevent abuse, and support recipients.
          Customer may not use replay for covert surveillance, employee monitoring,
          eligibility or credit decisions, insurance, housing, employment,
          education admissions, healthcare decisions, law-enforcement profiling,
          biometric analysis, or another high-impact or legally significant
          decision.
        </p>
        <h3>Notice and affirmative consent</h3>
        <p>
          Before enabling consent-gated measurement, Customer must determine that
          it has a lawful basis and, wherever consent is required, obtain freely
          given, specific, informed, unambiguous, and affirmative consent before
          collection begins. Customer must identify itself, explain the categories
          of behavior captured and purposes, link to an accurate notice, provide a
          genuine decline option, and make withdrawal as easy as consent. Customer
          must not bypass, obscure, manipulate, preselect, or interfere with
          Handout&rsquo;s choice interface or trigger collection before a valid
          choice.
        </p>
        <p>
          Customer acknowledges that consent requirements may arise under GDPR,
          UK GDPR, PECR, ePrivacy laws, state wiretap and interception laws,
          consumer-protection law, or contract even if a cookie is not used.
          Customer will maintain evidence of notice and consent and provide it to
          Handout upon reasonable request related to a complaint or investigation.
        </p>
        <h3>Data minimization and prohibited capture</h3>
        <p>
          Customer must configure pages and blocked regions so replay-visible text
          does not contain sensitive, regulated, confidential, authentication,
          financial, health, government-identifier, biometric, children&rsquo;s,
          or payment-card data. Customer may not modify the Services to defeat
          masking, collect field values, reconstruct blocked content, fingerprint
          a visitor, or combine tracking with data for an undisclosed incompatible
          purpose.
        </p>
        <h3>Customer access and downstream use</h3>
        <p>
          Customer will limit tracking and replay access to trained personnel with
          a business need, review access when roles change, select the shortest
          appropriate retention, and secure exports and webhook destinations.
          Customer is responsible for actions based on analytics and for any data
          it exports, copies, combines, or sends downstream.
        </p>
        <h3>Handout controls and enforcement</h3>
        <p>
          Handout may impose entitlement, storage, duration, event, start-rate, and
          daily-volume limits; pause or stop collection; delete recordings; update
          masking or consent controls; or require Customer to disable a feature
          when needed for law, security, capacity, or risk. Current replay is
          designed to mask form values, omit scripts and frames, strip URL
          credentials and query data, and cap individual recordings, but no control
          eliminates all risk.
        </p>
        <LegalCallout title="Allocation of responsibility">
          Customer determines the purpose, audience, legal basis, notice, consent,
          configuration, access, retention, and use of tracking and replay.
          Customer assumes the compliance risk of enabling these features and will
          indemnify Handout for Customer&rsquo;s breach as provided in Section 22.
        </LegalCallout>
      </>
    ),
  },
  {
    id: "prohibited-data",
    number: "10",
    title: "Prohibited and regulated data",
    shortTitle: "Prohibited data",
    children: (
      <>
        <p>
          Unless an Order expressly authorizes it and the parties sign every
          required addendum, Customer must not submit, expose, or cause Handout to
          process:
        </p>
        <ul>
          <li>
            protected health information under HIPAA, medical records, or patient
            treatment data;
          </li>
          <li>
            full payment-card or bank credentials, card verification values, or
            PCI cardholder data outside Stripe&rsquo;s hosted payment flow;
          </li>
          <li>
            government identifiers, passwords, authentication secrets, private
            keys, financial-account credentials, or precise geolocation;
          </li>
          <li>
            biometric templates, genetic information, intimate-life information,
            highly sensitive demographic profiles, or nonpublic consumer financial
            information governed by GLBA;
          </li>
          <li>
            education records governed by FERPA, criminal-justice information, or
            classified, export-controlled, or national-security information;
          </li>
          <li>
            information about children prohibited by Section 16 of the Privacy
            Policy; or
          </li>
          <li>
            material requiring access controls or regulatory assurances that
            Handout has not expressly agreed to provide.
          </li>
        </ul>
        <p>
          Standard Services are not HIPAA-compliant services, and Handout does not
          enter a Business Associate Agreement by online acceptance. Customer bears
          all risk and cost arising from prohibited data and must notify Handout
          immediately if it is submitted.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    number: "11",
    title: "Acceptable use",
    shortTitle: "Acceptable use",
    children: (
      <>
        <p>Customer and its users must not:</p>
        <ul>
          <li>
            violate law or the rights of others; facilitate fraud, phishing,
            impersonation, deceptive marketing, harassment, stalking, threats,
            exploitation, trafficking, or illegal goods or services;
          </li>
          <li>
            publish malware, malicious code, credential traps, unlawful sexual
            content, child sexual abuse material, non-consensual intimate imagery,
            or content that promotes terrorism or credible violence;
          </li>
          <li>
            infringe intellectual property, privacy, publicity, confidentiality,
            database, or contractual rights;
          </li>
          <li>
            send unsolicited bulk messages, evade opt-outs, misrepresent sender or
            destination, or use Handout to build or enrich an unlawful marketing
            database;
          </li>
          <li>
            probe, scan, interfere with, disrupt, overload, attack, or bypass
            security, rate limits, entitlement, consent, access, or usage controls;
          </li>
          <li>
            access another tenant, scrape nonpublic data, introduce viruses, use
            automated means that impose unreasonable load, or use the Services to
            develop or benchmark a competing product;
          </li>
          <li>
            reverse engineer, decompile, disassemble, copy, translate, or create
            derivative works of the Services except to the limited extent law
            prohibits that restriction;
          </li>
          <li>
            sell, rent, sublicense, time-share, or provide the Services as a service
            bureau, or transfer an account, except as expressly allowed in an
            Order; or
          </li>
          <li>
            encourage, enable, or attempt any prohibited act.
          </li>
        </ul>
        <p>
          We may investigate suspected violations, preserve evidence, limit
          distribution, disable links or features, remove content, suspend access,
          and cooperate with authorities or affected parties as permitted by law.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    number: "12",
    title: "Third-party services and content",
    shortTitle: "Third-party services",
    children: (
      <>
        <p>
          The Services may interoperate with Stripe, Gmail and Chrome, GIPHY,
          Logo.dev, YouTube, Vimeo, Loom, calendar services, remote images, customer
          webhooks, AI or MCP clients, and other third-party products
          (&ldquo;<strong>Third-Party Services</strong>&rdquo;). Customer chooses
          whether to use them and authorizes Handout to exchange information
          necessary for the requested interoperability.
        </p>
        <p>
          Third-Party Services are governed by their own terms and privacy
          practices and may change, block, rate-limit, suspend, or discontinue
          integration. Handout does not control and is not responsible for their
          content, security, data use, acts, omissions, availability, or
          compatibility. Handout does not warrant or endorse customer-selected
          embeds or destinations. Customer is responsible for obtaining licenses,
          complying with third-party terms, configuring privacy controls, and
          assessing transfers.
        </p>
      </>
    ),
  },
  {
    id: "extension-agents",
    number: "13",
    title: "Extension, integrations, APIs, MCP, and agents",
    shortTitle: "Extension and agents",
    children: (
      <>
        <h3>Browser extension</h3>
        <p>
          The Gmail extension is provided only to help an authorized user insert a
          selected Handout link or card into a compose window. Customer must comply
          with Google, Gmail, Chrome Web Store, communications, and privacy rules.
          Customer must not modify or use the extension to access message bodies,
          threads, attachments, contacts, or tokens beyond its intended
          functionality. Gmail and browser changes may interrupt the extension.
        </p>
        <h3>APIs, MCP, and software agents</h3>
        <p>
          A tool, script, AI agent, or third-party client acting with Customer
          credentials or authorization is an Authorized User. Customer authorizes
          Handout to treat its requests as Customer instructions and is responsible
          for every action it takes, including creating, changing, publishing, or
          deleting content or recipients and reading tracking data.
        </p>
        <p>
          Customer must review an agent&rsquo;s scope and provider terms, grant the
          least privilege, protect tokens, validate output, supervise publication,
          and promptly revoke access that is no longer needed. AI or automated
          output may be inaccurate, incomplete, infringing, or unsuitable. Handout
          is not responsible for a third-party model&rsquo;s training, retention,
          security, output, or use of information Customer sends to it.
        </p>
        <h3>Webhooks</h3>
        <p>
          Customer is responsible for its destination, lawful basis, recipient,
          availability, security, secret rotation, signature validation, payload
          handling, and downstream retention. Handout may retry deliveries, impose
          queues and usage limits, disable unsafe or failing destinations, and
          redact or delete delivery data under operational retention schedules.
        </p>
      </>
    ),
  },
  {
    id: "handout-ip",
    number: "14",
    title: "Handout intellectual property",
    shortTitle: "Handout IP",
    children: (
      <>
        <p>
          Handout and its licensors own the Services, software, source and object
          code, designs, interfaces, workflows, documentation, templates, models,
          compilations, improvements, trademarks, and all related intellectual
          property, excluding Customer Content. No rights are granted except the
          limited access right expressly stated in these Terms.
        </p>
        <p>
          &ldquo;Handout,&rdquo; its logo, and related marks are Handout marks.
          Customer may not use them in a way that implies endorsement, partnership,
          or ownership. Customer may accurately identify that a site is powered by
          Handout and use materials expressly provided for that purpose, subject to
          brand guidelines and revocation.
        </p>
      </>
    ),
  },
  {
    id: "confidentiality",
    number: "15",
    title: "Confidentiality",
    shortTitle: "Confidentiality",
    children: (
      <>
        <p>
          &ldquo;<strong>Confidential Information</strong>&rdquo; means nonpublic
          information disclosed by one party that is marked confidential or should
          reasonably be understood as confidential given its nature and context.
          Customer Confidential Information includes nonpublic Customer Content;
          Handout Confidential Information includes nonpublic product, security,
          pricing, roadmap, and technical information.
        </p>
        <p>
          The recipient will use Confidential Information only to perform or
          exercise rights under the agreement, protect it using at least reasonable
          care, and disclose it only to personnel, advisers, and providers who need
          to know and are bound by protective obligations. These duties do not
          cover information that the recipient can document was lawfully known
          without restriction, independently developed, rightfully received from
          another source, or made public without breach.
        </p>
        <p>
          A recipient may disclose information when legally required if, where
          lawful, it gives prompt notice and reasonable assistance at the
          discloser&rsquo;s expense. Published sites, recipient links, public
          previews, and content Customer directs us to disclose are not confidential
          as to their intended recipients. This Section does not make Handout a
          secure data room or expand agreed security obligations.
        </p>
      </>
    ),
  },
  {
    id: "privacy-dpa",
    number: "16",
    title: "Privacy and data processing",
    shortTitle: "Privacy and DPA",
    children: (
      <>
        <p>
          Our <Link href="/privacy">Privacy Policy</Link> explains processing for
          which Handout determines the purposes and means. Sections D1–D10 form the
          Data Processing Addendum (&ldquo;<strong>DPA</strong>&rdquo;) governing
          Customer Personal Data processed by Handout on Customer&rsquo;s behalf
          and are incorporated into these Terms.
        </p>
        <p>
          Customer will not instruct Handout to process personal data in violation
          of law, will provide all notices and obtain all rights and consents, and
          will respond to individuals and regulators. If Customer is a processor
          for another controller, Customer represents it is authorized to appoint
          Handout as a subprocessor and to give the instructions in this agreement.
        </p>
      </>
    ),
  },
  {
    id: "moderation-copyright",
    number: "17",
    title: "Content reports, moderation, and copyright",
    shortTitle: "Reports and copyright",
    children: (
      <>
        <h3>Illegal or harmful content reports</h3>
        <p>
          A person may report content or conduct to{" "}
          <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>
          . A useful report identifies the exact URL or content location, explains
          the alleged illegality or violation, identifies the applicable right or
          law, includes supporting evidence, provides the reporter&rsquo;s name and
          contact details, and states a good-faith belief that the report is
          accurate. We may request more information, forward the report to the
          customer, preserve evidence, and take proportionate action.
        </p>
        <p>
          Where applicable law requires, we will provide a statement of reasons for
          a restriction and an internal complaint path. A customer may appeal a
          moderation decision within six months by replying to the notice with
          relevant facts. We may decline to disclose information where doing so
          would compromise safety, security, an investigation, legal obligations,
          or another person&rsquo;s rights.
        </p>
        <h3>Copyright notices</h3>
        <p>
          A copyright owner or authorized agent may send a notice identifying:
          (1) the copyrighted work; (2) the exact location of allegedly infringing
          material; (3) contact information; (4) a good-faith statement that the
          use is unauthorized; (5) a statement under penalty of perjury that the
          notice is accurate and the sender is authorized; and (6) a physical or
          electronic signature.
        </p>
        <LegalAddress>
          <strong>{legalConfig.operatorDescription}</strong>
          <br />
          Attn: Copyright
          <br />
          {legalConfig.address}
          <br />
          Email:{" "}
          <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>
        </LegalAddress>
        <p>
          A user whose material was removed may submit a counter-notice identifying
          the material and former location, consenting to jurisdiction in the
          U.S. federal judicial district where the user&rsquo;s address is located
          (or, if outside the United States, any district where Handout may be
          found), agreeing to accept service from the complainant, and stating
          under penalty of perjury a good-faith belief that removal resulted from
          mistake or misidentification, with contact information and a signature.
          We may forward a counter-notice to the complainant and restore material
          after the statutory waiting period if the complainant does not notify us
          of a filed court action. False claims may create liability. We may
          terminate repeat infringers in appropriate circumstances.
        </p>
      </>
    ),
  },
  {
    id: "feedback",
    number: "18",
    title: "Feedback and aggregated data",
    shortTitle: "Feedback",
    children: (
      <>
        <p>
          If Customer voluntarily provides an idea, suggestion, or feedback,
          Customer grants Handout a perpetual, irrevocable, worldwide, royalty-free,
          sublicensable, transferable license to use and incorporate it without
          restriction or compensation. Do not submit feedback subject to a duty
          that would restrict this license.
        </p>
        <p>
          Handout may create and use aggregated or de-identified information for
          analytics, security, capacity planning, benchmarking, and product
          improvement, provided it does not identify Customer or an individual.
          We will not attempt to re-identify data that law requires to remain
          de-identified.
        </p>
      </>
    ),
  },
  {
    id: "suspension",
    number: "19",
    title: "Suspension and protective action",
    shortTitle: "Suspension",
    children: (
      <>
        <p>
          Handout may immediately limit, suspend, or disable an account, site,
          public link, integration, tracking, replay, webhook, or other feature if
          reasonably necessary to: prevent harm or unauthorized access; address a
          security incident or credible legal claim; comply with law, court order,
          provider requirement, or sanctions; stop prohibited conduct or excessive
          use; protect another tenant or the Services; or address overdue fees.
        </p>
        <p>
          We will use reasonable efforts to give notice and limit the scope and
          duration where circumstances permit. Customer remains responsible for
          fees during a suspension caused by Customer. We may require remediation,
          identity or authority verification, content removal, credential rotation,
          or written assurances before restoring access.
        </p>
      </>
    ),
  },
  {
    id: "termination",
    number: "20",
    title: "Term, termination, and data after termination",
    shortTitle: "Termination",
    children: (
      <>
        <p>
          These Terms begin when accepted and continue while Customer has an
          account or Order. Either party may terminate an Order for a material
          breach not cured within 30 days after written notice, or immediately if
          the breach cannot be cured, involves unlawful or dangerous conduct,
          threatens the Services, or the other party becomes insolvent, ceases
          business, or enters bankruptcy proceedings not dismissed within 60 days.
        </p>
        <p>
          On expiration or termination, Customer&rsquo;s access ends, public sites
          may be unpublished, and Customer must stop using the Services and pay all
          accrued fees. If Handout terminates for uncured Customer breach, prepaid
          fees are not refunded and committed unpaid fees become due. If Customer
          terminates for Handout&rsquo;s uncured material breach, Customer&rsquo;s
          exclusive fee remedy is a pro-rata refund of unused prepaid fees for the
          terminated period.
        </p>
        <p>
          During the subscription, Customer should export data it needs using
          available features. After termination, Handout may delete Customer
          Content after a reasonable wind-down period, subject to the DPA, backups,
          legal holds, security records, and information Handout is independently
          entitled or required to retain. We do not guarantee post-termination
          retrieval unless an Order states otherwise. Sections that by their nature
          should survive do survive, including accrued payment, ownership,
          confidentiality, disclaimers, indemnity, liability, dispute, and general
          terms.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    number: "21",
    title: "Disclaimers",
    shortTitle: "Disclaimers",
    children: (
      <>
        <p className="uppercase">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICES, DOCUMENTATION,
          OUTPUTS, TEMPLATES, CONSENT TOOLS, TRACKING, REPLAY, PREVIEWS, AND
          THIRD-PARTY CONTENT ARE PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS
          AVAILABLE.&rdquo; HANDOUT AND ITS AFFILIATES, LICENSORS, AND PROVIDERS
          DISCLAIM ALL EXPRESS, IMPLIED, STATUTORY, AND OTHER WARRANTIES, INCLUDING
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
          NON-INFRINGEMENT, ACCURACY, QUIET ENJOYMENT, AND WARRANTIES ARISING FROM
          COURSE OF DEALING OR USAGE OF TRADE.
        </p>
        <p className="uppercase">
          HANDOUT DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE,
          ERROR-FREE, COMPLIANT FOR CUSTOMER, OR FREE OF HARMFUL COMPONENTS; THAT
          DATA WILL NEVER BE LOST OR EXPOSED; THAT MASKING OR BLOCKING WILL CAPTURE
          EVERY SENSITIVE ELEMENT; THAT A LINK WILL REMAIN PRIVATE; THAT AN
          INTEGRATION OR THIRD-PARTY SERVICE WILL CONTINUE; OR THAT CUSTOMER WILL
          ACHIEVE ANY SALES, ENGAGEMENT, REVENUE, DELIVERY, OR OTHER RESULT.
        </p>
        <p>
          Handout does not provide legal, tax, accounting, compliance, marketing,
          employment, or security advice. Customer is responsible for independent
          review, professional advice, backups, results, and decisions. Some
          jurisdictions do not allow certain disclaimers, so they apply only to the
          extent lawful.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    number: "22",
    title: "Customer indemnification",
    shortTitle: "Indemnification",
    children: (
      <>
        <p>
          Customer will defend, indemnify, and hold harmless Handout, its affiliates,
          and their officers, directors, employees, contractors, licensors, and
          providers from claims, demands, investigations, proceedings, losses,
          judgments, settlements, penalties, damages, costs, and reasonable
          attorneys&rsquo; fees arising from or relating to:
        </p>
        <ul>
          <li>
            Customer Content, public sites, recipient data, links, previews,
            communications, products, services, or business practices;
          </li>
          <li>
            Customer&rsquo;s tracking, replay, consent, personalization, embeds,
            webhooks, integrations, agents, exports, or downstream use;
          </li>
          <li>
            Customer&rsquo;s or an Authorized User&rsquo;s violation of these Terms,
            law, third-party terms, or another person&rsquo;s rights;
          </li>
          <li>
            prohibited data, inaccurate instructions, or failure to provide notice,
            obtain consent, honor rights, or secure credentials and destinations;
            or
          </li>
          <li>any dispute between Customer and its users, recipients, or visitors.</li>
        </ul>
        <p>
          Handout will give prompt notice, except delay relieves Customer only to
          the extent materially prejudiced. Customer controls the defense with
          qualified counsel, but may not settle in a way that admits fault by,
          imposes obligations on, or fails to unconditionally release an indemnified
          party without Handout&rsquo;s written consent. Handout may participate
          with counsel at its own expense and may assume control if a conflict
          exists or Customer fails to defend.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    number: "23",
    title: "Limitation of liability",
    shortTitle: "Liability limits",
    children: (
      <>
        <p className="uppercase">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, HANDOUT AND ITS AFFILIATES,
          LICENSORS, AND PROVIDERS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL,
          SPECIAL, EXEMPLARY, PUNITIVE, OR CONSEQUENTIAL DAMAGES; LOSS OF PROFITS,
          REVENUE, SAVINGS, GOODWILL, BUSINESS OPPORTUNITY, OR DATA; BUSINESS
          INTERRUPTION; PROCUREMENT OF SUBSTITUTE SERVICES; OR LIABILITY ARISING
          FROM THIRD-PARTY SERVICES, CUSTOMER CONTENT, PUBLIC LINKS, RECIPIENT
          ACTIONS, OR CUSTOMER DECISIONS, UNDER ANY THEORY AND EVEN IF ADVISED OF
          THE POSSIBILITY.
        </p>
        <p className="uppercase">
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, HANDOUT&rsquo;S TOTAL AGGREGATE
          LIABILITY ARISING OUT OF OR RELATING TO THE SERVICES, AN ORDER, THE DPA,
          OR THESE TERMS WILL NOT EXCEED THE GREATER OF: (A) THE FEES PAID OR
          PAYABLE BY CUSTOMER TO HANDOUT FOR THE AFFECTED SERVICES DURING THE THREE
          MONTHS IMMEDIATELY BEFORE THE FIRST EVENT GIVING RISE TO LIABILITY; OR
          (B) ONE HUNDRED U.S. DOLLARS (US $100).
        </p>
        <p>
          The exclusions and cap apply in the aggregate to all claims, are an
          essential allocation of risk, and apply even if a remedy fails of its
          essential purpose. They do not limit liability that cannot lawfully be
          excluded or limited. Handout&rsquo;s providers and licensors are intended
          beneficiaries of this Section. Customer&rsquo;s payment and indemnity
          obligations are not limited by this Section.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    number: "24",
    title: "Disputes, arbitration, and governing law",
    shortTitle: "Disputes",
    children: (
      <>
        <h3>Informal resolution</h3>
        <p>
          Before filing a claim, a party must send a written notice describing the
          claimant, facts, legal basis, requested relief, and calculation of any
          amount. The parties will confer individually and in good faith for 60
          days. Limitation periods are tolled during that period. Notices to
          Handout must be sent by email and certified mail to the contact in
          Section 28.
        </p>
        <h3>Binding individual arbitration</h3>
        <p className="uppercase">
          EXCEPT FOR THE EXCEPTIONS BELOW, ANY DISPUTE ARISING OUT OF OR RELATING TO
          THE SERVICES, AN ORDER, THE DPA, THESE TERMS, OR THE PARTIES&rsquo;
          RELATIONSHIP WILL BE RESOLVED BY FINAL AND BINDING INDIVIDUAL ARBITRATION,
          NOT IN COURT, UNDER THE FEDERAL ARBITRATION ACT.
        </p>
        <p>
          The American Arbitration Association (&ldquo;AAA&rdquo;) will administer
          the arbitration under its Commercial Arbitration Rules then in effect,
          as modified here. One arbitrator will conduct the matter in English. The
          hearing will occur remotely or in New York County, New York, unless the
          parties agree otherwise. The arbitrator may award relief available to an
          individual party under applicable law, must enforce this agreement, and
          will issue a reasoned written decision. A court may enter judgment on the
          award.
        </p>
        <h3>Class, representative, and jury waiver</h3>
        <p className="uppercase">
          EACH PARTY WAIVES TRIAL BY JURY. CLAIMS MAY BE BROUGHT ONLY IN AN
          INDIVIDUAL CAPACITY, NOT AS A PLAINTIFF, CLASS MEMBER, PRIVATE ATTORNEY
          GENERAL, OR REPRESENTATIVE IN A CLASS, COLLECTIVE, CONSOLIDATED, OR
          REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT COMBINE CLAIMS OR AWARD
          RELIEF FOR ANYONE OTHER THAN THE INDIVIDUAL PARTIES.
        </p>
        <h3>Coordinated filings</h3>
        <p>
          If 25 or more substantially similar demands are submitted by or with the
          assistance of the same counsel or coordinated group, the parties will
          meet and select ten demands for initial bellwether proceedings, five per
          side. Other demands are stayed and no AAA fees are due for them. After
          the bellwethers, the parties will mediate in good faith before remaining
          cases proceed in batches of no more than 25. This process does not
          authorize class arbitration; limitation periods are tolled for stayed
          demands.
        </p>
        <h3>Exceptions and opt-out</h3>
        <p>
          Either party may bring an eligible individual claim in small-claims
          court, seek temporary or injunctive relief for unauthorized access,
          misuse, or intellectual-property infringement, or ask a court to enforce
          the arbitration provision. A Customer may opt out of arbitration by
          emailing a signed notice with the subject &ldquo;Arbitration
          Opt-Out&rdquo; within 30 days after first accepting these Terms,
          identifying the Customer and account and clearly stating the decision to
          opt out. Opting out does not affect other Terms.
        </p>
        <h3>Law and courts</h3>
        <p>
          These Terms and non-arbitrable disputes are governed by the laws of{" "}
          {legalConfig.governingLaw}, excluding conflict-of-law rules and the United
          Nations Convention on Contracts for the International Sale of Goods.
          Subject to arbitration, the parties consent to exclusive jurisdiction and
          venue in the {legalConfig.exclusiveCourt}. If part of the class waiver is
          finally unenforceable as to a particular claim, that claim will proceed
          in court after arbitrable claims, and the remainder survives.
        </p>
      </>
    ),
  },
  {
    id: "export",
    number: "25",
    title: "Export controls, sanctions, and government use",
    shortTitle: "Export and sanctions",
    children: (
      <>
        <p>
          Customer will comply with U.S. and other applicable export controls,
          sanctions, and anti-boycott laws. Customer represents that it and its
          users are not located in a comprehensively sanctioned jurisdiction, on a
          prohibited-party list, or owned or controlled by a prohibited party, and
          will not use the Services for prohibited end uses.
        </p>
        <p>
          The Services are commercial computer software and documentation. U.S.
          government use is subject to the rights and restrictions customarily
          provided to the public under these Terms and applicable procurement rules.
        </p>
      </>
    ),
  },
  {
    id: "notices",
    number: "26",
    title: "Electronic communications and notices",
    shortTitle: "Notices",
    children: (
      <>
        <p>
          Customer consents to electronic records, signatures, notices, and
          communications. We may send operational notices to the account email,
          display them in the Services, or post them on our site. Customer must keep
          contact information current. A notice is effective when sent or posted,
          except a formal breach, indemnity, arbitration, or termination notice is
          effective upon confirmed delivery and must also be sent to any notice
          address in the Order.
        </p>
        <p>
          We may send service, security, billing, verification, and legal messages
          without offering a marketing opt-out because they are necessary to the
          relationship. A recipient may unsubscribe from optional marketing through
          the provided mechanism.
        </p>
      </>
    ),
  },
  {
    id: "general",
    number: "27",
    title: "General terms",
    shortTitle: "General",
    children: (
      <>
        <p>
          <strong>Assignment.</strong> Customer may not assign or transfer the
          agreement without Handout&rsquo;s written consent. Handout may assign it
          to an affiliate or in connection with a merger, financing,
          reorganization, sale of assets, or change of control. An unauthorized
          assignment is void.
        </p>
        <p>
          <strong>Independent parties.</strong> The parties are independent
          contractors. The agreement does not create employment, agency,
          partnership, fiduciary duty, franchise, or joint venture, and neither
          party may bind the other.
        </p>
        <p>
          <strong>Force majeure.</strong> Neither party is liable for delay or
          failure caused by events beyond reasonable control, including internet or
          utility failure, provider outage, attack, epidemic, disaster, labor
          dispute, government action, war, or civil unrest. This does not excuse
          payment for Services already provided.
        </p>
        <p>
          <strong>Waiver; severability.</strong> A waiver must be written and is
          limited to that instance. If a provision is unenforceable, it will be
          modified to the minimum extent needed to reflect its intent, and the rest
          remains effective, subject to Section 24&rsquo;s special severability.
        </p>
        <p>
          <strong>No third-party beneficiaries.</strong> Except for indemnified
          parties and providers protected by Sections 21–23, no person other than
          the parties has rights under the agreement.
        </p>
        <p>
          <strong>Interpretation.</strong> &ldquo;Including&rdquo; means
          &ldquo;including without limitation.&rdquo; Headings are for convenience.
          A reference to law includes amendments and replacements. The English
          version controls to the extent permitted by law.
        </p>
        <p>
          <strong>Entire agreement.</strong> These Terms, an Order, the DPA, and
          documents expressly incorporated by reference are the entire agreement
          about the Services and supersede prior or contemporaneous proposals and
          communications. Each party relies only on express terms.
        </p>
        <p>
          <strong>Changes.</strong> We may update these Terms for changes in law,
          risk, technology, providers, or the Services. We will post the revised
          version and give reasonable advance notice of a material change. Except
          where law requires express acceptance, continued use after the effective
          date accepts the update. A material change will not retroactively reduce
          an express right or expand liability for events already completed. If
          Customer objects, its remedy is to stop using and cancel before the
          update takes effect.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    number: "28",
    title: "Contact and legal notices",
    shortTitle: "Contact",
    children: (
      <>
        <LegalAddress>
          <strong>{legalConfig.operatorDescription}</strong>
          <br />
          Attn: Legal
          <br />
          {legalConfig.address}
          <br />
          Email:{" "}
          <Link href={`mailto:${legalConfig.contactEmail}`}>
            {legalConfig.contactEmail}
          </Link>
        </LegalAddress>
        <p>
          Questions about these Terms may be sent by email. Formal breach,
          indemnity, termination, or dispute notices must also be sent by
          nationally recognized overnight courier or certified mail to the address
          above. An arbitration opt-out may be sent by email as provided in
          Section 24.
        </p>
      </>
    ),
  },
  {
    id: "dpa-scope",
    number: "D1",
    title: "DPA scope, definitions, and roles",
    shortTitle: "DPA scope",
    children: (
      <>
        <p>
          Sections D1–D10 are the Data Processing Addendum between Customer and
          Handout. They apply when Handout processes Customer Personal Data to
          provide the Services. &ldquo;<strong>Customer Personal Data</strong>&rdquo;
          means personal data, personal information, or equivalent regulated
          information contained in Customer Content or generated from a
          customer-directed site, recipient, tracking, replay, webhook, integration,
          or support workflow. It excludes information for which Handout determines
          the purposes and means as described in the Privacy Policy.
        </p>
        <p>
          &ldquo;<strong>Data Protection Law</strong>&rdquo; means privacy,
          security, breach-notification, and data-protection law applicable to the
          processing, including GDPR, UK GDPR, the UK Data Protection Act 2018,
          Swiss FADP, and applicable U.S. state comprehensive privacy laws.
          &ldquo;<strong>GDPR</strong>&rdquo; means Regulation (EU) 2016/679.
          Controller, processor, business, consumer, sell, share, service provider,
          and personal data have the meanings in applicable Data Protection Law.
        </p>
        <p>
          Customer is the controller or business and Handout is the processor or
          service provider for Customer Personal Data. If Customer is a processor,
          Handout is its subprocessor. Each party will comply with its obligations
          under Data Protection Law. Customer is responsible for the lawfulness,
          fairness, accuracy, notices, legal bases, consents, instructions, and
          rights handling for Customer Personal Data.
        </p>
      </>
    ),
  },
  {
    id: "dpa-details",
    number: "D2",
    title: "DPA processing details",
    shortTitle: "Processing details",
    children: (
      <>
        <LegalTable
          caption="Details of processing under the DPA"
          headers={["Element", "Description"]}
          rows={[
            [
              "Subject matter and purpose",
              "Providing, securing, supporting, and maintaining the customer-configured Handout Services, including sites, personalization, collaboration, tracking, replay, previews, integrations, webhooks, and support.",
            ],
            [
              "Duration",
              "The applicable subscription or account term plus the deletion, return, backup, legal-hold, and wind-down periods described in the agreement.",
            ],
            [
              "Nature and frequency",
              "Collection, receipt, hosting, organization, structuring, storage, retrieval, consultation, rendering, transmission, use, combination at Customer’s direction, restriction, deletion, and other processing necessary for the Services, on a continuous or Customer-directed basis.",
            ],
            [
              "Data subjects",
              "Customer users and invitees; recipients and prospects; visitors to customer-created sites; Customer personnel, clients, contractors, contacts, and other people whose information Customer submits.",
            ],
            [
              "Personal-data categories",
              "Identity and business contact data; account and team data; Customer Content; company, domain, recipient, and variable data; public-link context; device, browser, network, coarse location, visit, event, session, replay, and consent data; support and communications; integration, webhook, and audit data.",
            ],
            [
              "Sensitive data",
              "Not intended or authorized. Credentials and access tokens are processed only to secure and provide the Services. Customer must not submit the sensitive and regulated categories prohibited by Section 10.",
            ],
            [
              "Customer rights and obligations",
              "As controller, Customer may configure, access, export, correct, restrict, unpublish, and delete data through available features and may instruct Handout as provided in the agreement.",
            ],
          ]}
        />
      </>
    ),
  },
  {
    id: "dpa-instructions",
    number: "D3",
    title: "Documented instructions and compliance",
    shortTitle: "Instructions",
    children: (
      <>
        <p>
          Handout will process Customer Personal Data only on documented
          instructions, including the agreement, Customer configuration, Authorized
          User actions, support requests, and other written instructions consistent
          with the Services, unless law requires otherwise. If law requires other
          processing, Handout will inform Customer before processing unless law
          prohibits notice.
        </p>
        <p>
          Handout will promptly inform Customer if, in its opinion, an instruction
          violates Data Protection Law. Handout may suspend the affected instruction
          while the parties work in good faith on a lawful alternative and may
          terminate the affected Service if none is reasonably available. Handout
          does not independently determine whether Customer&rsquo;s business,
          notices, consent, or instructions comply with law.
        </p>
        <p>
          Handout will ensure personnel authorized to process Customer Personal Data
          are subject to confidentiality obligations and receive access appropriate
          to their role.
        </p>
      </>
    ),
  },
  {
    id: "dpa-security",
    number: "D4",
    title: "Security measures",
    shortTitle: "Security measures",
    children: (
      <>
        <p>
          Taking into account the state of the art, implementation cost, and the
          nature, scope, context, and purposes of processing and risk to individuals,
          Handout will maintain appropriate technical and organizational measures,
          including as applicable:
        </p>
        <ul>
          <li>
            encryption in transit; encryption or provider-managed protection at
            rest for managed databases and object storage; and separate encryption
            for sensitive automation endpoints and signing secrets;
          </li>
          <li>
            authenticated, tenant-aware access controls; role and authorization
            checks; session and token revocation; and least-privilege operational
            access;
          </li>
          <li>
            private object storage and time-limited authorized access for replay
            data; input masking, blocked-region controls, and capture limits;
          </li>
          <li>
            secure development practices, dependency and code review, testing,
            vulnerability remediation, rate-limiting, origin protection, and SSRF
            defenses for customer-provided destinations and remote fetches;
          </li>
          <li>
            logging designed to redact secrets and sensitive fields, monitoring,
            incident response, backups, restoration measures, and provider
            resilience controls;
          </li>
          <li>
            subprocessor diligence and written data-protection obligations; and
          </li>
          <li>
            periodic review and adaptation of safeguards in light of risk and
            changes to the Services.
          </li>
        </ul>
        <p>
          Customer is responsible for security within its control, including
          endpoints, credentials, users, roles, content, public links, embeds,
          exports, agents, webhook destinations, and configuration.
        </p>
      </>
    ),
  },
  {
    id: "dpa-subprocessors",
    number: "D5",
    title: "Subprocessors",
    shortTitle: "Subprocessors",
    children: (
      <>
        <p>
          Customer gives Handout general written authorization to use the
          subprocessors listed in the Privacy Policy and their own approved
          subprocessors as needed to provide the Services. Handout will impose
          data-protection obligations that provide materially equivalent protection
          for Customer Personal Data and remains responsible for a subprocessor&rsquo;s
          performance to the extent required by Data Protection Law and this DPA.
        </p>
        <p>
          Handout will provide at least 30 days&rsquo; notice before authorizing a
          new material subprocessor that processes Customer Personal Data, including
          by updating the list and notifying the account contact or making a
          subscription mechanism available. Customer may object during that period
          on reasonable, documented data-protection grounds. The parties will work
          in good faith on a commercially reasonable alternative. If none is
          available, Handout may elect not to provide the affected feature and
          Customer may terminate only that affected feature or Order, with a
          pro-rata refund of unused prepaid fees for it. This is Customer&rsquo;s
          exclusive remedy for a subprocessor objection.
        </p>
      </>
    ),
  },
  {
    id: "dpa-assistance",
    number: "D6",
    title: "Rights, incidents, and regulatory assistance",
    shortTitle: "DPA assistance",
    children: (
      <>
        <p>
          Taking into account the nature of processing and information available,
          Handout will provide reasonable assistance for Customer to:
        </p>
        <ul>
          <li>
            respond to verified requests to exercise data-subject or consumer
            rights;
          </li>
          <li>
            conduct a legally required data-protection impact assessment or prior
            consultation relating to Customer&rsquo;s use of the Services;
          </li>
          <li>
            meet security, breach-notification, and regulator-cooperation
            obligations; and
          </li>
          <li>demonstrate compliance with processor obligations.</li>
        </ul>
        <p>
          If Handout receives a request concerning Customer Personal Data, it will
          not respond on Customer&rsquo;s behalf unless authorized or legally
          required and may direct the requester to Customer. Customer will use
          available self-service tools first. Handout may charge reasonable fees for
          assistance that is unusually burdensome, repetitive, or outside standard
          functionality, unless the need results from Handout&rsquo;s breach.
        </p>
        <h3>Personal Data Breach</h3>
        <p>
          Handout will notify Customer without undue delay after becoming aware of
          a breach of security leading to accidental or unlawful destruction,
          loss, alteration, unauthorized disclosure of, or access to Customer
          Personal Data processed by Handout (a &ldquo;<strong>Personal Data
          Breach</strong>&rdquo;). Notification is not an admission of fault.
        </p>
        <p>
          As information becomes available, Handout will provide the nature of the
          incident, affected categories and approximate volume where known, likely
          consequences, measures taken or proposed, and a contact for follow-up.
          Customer is responsible for notifying regulators and individuals unless
          law assigns that duty to Handout. Unsuccessful attacks, port scans,
          blocked attempts, and incidents confined to Customer-controlled systems
          are not Personal Data Breaches of Handout systems.
        </p>
      </>
    ),
  },
  {
    id: "dpa-return-audit",
    number: "D7",
    title: "Return, deletion, and audits",
    shortTitle: "Deletion and audits",
    children: (
      <>
        <p>
          During the term, Customer may use available features to access, export,
          correct, unpublish, and delete Customer Personal Data. On termination or
          written instruction, Handout will delete or return Customer Personal Data
          within a reasonable period, at Customer&rsquo;s choice where technically
          available, unless law requires retention. Backup copies may remain until
          they age out under ordinary cycles; while retained, they remain protected
          and are not restored except for disaster recovery or legal necessity.
        </p>
        <p>
          On reasonable written request, Handout will provide information needed to
          demonstrate compliance, such as relevant policies, summaries, or
          third-party assessments when available. No more than once in any
          12-month period, Customer may have an independent auditor review that
          information, subject to confidentiality, scope, security, and
          non-disruption requirements.
        </p>
        <p>
          An on-site or technical audit is permitted only where Data Protection Law
          requires it and the supplied information is insufficient, or after a
          confirmed material Personal Data Breach involving Customer Personal Data.
          It must occur during business hours with at least 30 days&rsquo; notice
          unless a regulator requires sooner, avoid access to other customers&rsquo;
          data, and comply with Handout security rules. Customer bears audit costs
          and Handout&rsquo;s reasonable assistance costs unless the audit finds a
          material breach by Handout.
        </p>
      </>
    ),
  },
  {
    id: "dpa-transfers",
    number: "D8",
    title: "Restricted transfers and Standard Contractual Clauses",
    shortTitle: "Transfer clauses",
    children: (
      <>
        <p>
          If Customer Personal Data protected by European transfer restrictions is
          transferred to Handout in a country without an adequacy decision and no
          other lawful mechanism applies, the parties incorporate the European
          Commission{" "}
          <Link href="https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj">
            Standard Contractual Clauses adopted by Decision 2021/914/EU
          </Link>{" "}
          (&ldquo;<strong>EU SCCs</strong>&rdquo;).
        </p>
        <ul>
          <li>
            Module Two applies where Customer is a controller and Handout a
            processor. Module Three applies where Customer is a processor and
            Handout a subprocessor.
          </li>
          <li>
            Clause 7 docking is not used. In Clause 9, Option 2 applies with the
            notice period in D5. The optional language in Clause 11 is not used.
          </li>
          <li>
            In Clause 17, Option 1 applies and the law is Ireland. In Clause 18,
            disputes are resolved by the courts of Ireland.
          </li>
          <li>
            Customer is the data exporter and Handout is the data importer. Annex I
            is completed by the party details in the Order and Section 28, the
            processing details in D2, and the competent supervisory authority
            determined under the EU SCCs. Annex II is D4. Annex III is the
            subprocessor list in the Privacy Policy.
          </li>
        </ul>
        <p>
          For UK restricted transfers, the EU SCCs as completed above are modified
          by and incorporate the{" "}
          <Link href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/appropriate-safeguards/what-are-standard-data-protection-clauses-the-uk-idta-and-the-addendum/">
            then-current UK International Data Transfer Addendum
          </Link>{" "}
          issued by the Information Commissioner. Table 1 is completed by the
          party and contact details in the Order and Section 28; Table 2 by the SCC
          selections above; Table 3 by D2, D4, and the Privacy Policy subprocessor
          list; and Table 4 designates Handout, as Importer, as the party that may
          end the Addendum when the approved Addendum changes, as permitted by its
          mandatory clauses. For Swiss transfers, references to GDPR include the
          Swiss FADP where applicable, the competent authority is the FDPIC, and
          Swiss law and courts apply to the extent required.
        </p>
        <p>
          The parties will reasonably cooperate on transfer assessments and
          supplementary measures. If a transfer mechanism is invalidated or a
          competent authority requires changes, the parties will use an available
          lawful alternative. The EU SCCs or mandatory addendum controls over
          conflicting agreement terms.
        </p>
      </>
    ),
  },
  {
    id: "dpa-us",
    number: "D9",
    title: "United States service-provider terms",
    shortTitle: "US privacy terms",
    children: (
      <>
        <p>
          For Customer Personal Data subject to a U.S. comprehensive state privacy
          law, Handout acts as a service provider or processor and will:
        </p>
        <ul>
          <li>
            process data only for the limited and specified business purposes in
            D2 and Customer&rsquo;s documented instructions;
          </li>
          <li>
            not sell or share Customer Personal Data, retain, use, or disclose it
            outside the direct business relationship, or combine it with personal
            information received from another person or Handout&rsquo;s own
            interactions, except as law permits for a service provider or processor;
          </li>
          <li>
            provide the same level of privacy protection required by applicable
            law, notify Customer if Handout determines it can no longer meet an
            obligation, and allow Customer to take reasonable steps to stop and
            remediate unauthorized use; and
          </li>
          <li>
            require subcontractors to observe applicable restrictions and assist
            with consumer requests as stated in D6.
          </li>
        </ul>
        <p>
          Handout certifies it understands and will comply with these restrictions.
          Customer may monitor compliance through the audit process in D7. Each
          party will comply with legally required opt-out preference signals for
          processing under its control.
        </p>
      </>
    ),
  },
  {
    id: "dpa-liability",
    number: "D10",
    title: "DPA priority, liability, and termination",
    shortTitle: "DPA general terms",
    children: (
      <>
        <p>
          The DPA ends when Handout no longer processes Customer Personal Data,
          except provisions that must survive. If Data Protection Law changes, the
          parties will negotiate in good faith a necessary amendment; Handout may
          implement mandatory changes on notice where needed to keep providing the
          Services lawfully.
        </p>
        <p>
          Except to the extent the EU SCCs or mandatory law prohibits it, the
          disclaimers, exclusions, aggregate liability cap, dispute terms, and
          indemnities in these Terms apply to this DPA and all privacy and security
          claims in the aggregate, not in addition to other caps. Nothing in the
          DPA limits a party&rsquo;s liability under the EU SCCs in a manner the EU
          SCCs prohibit or reduces a data subject&rsquo;s mandatory rights under
          those clauses.
        </p>
      </>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal · Terms"
      title="Terms of Service"
      description="The business terms for creating, publishing, personalizing, measuring, and connecting Handout sites—including the Session Replay Addendum and Data Processing Addendum."
      effectiveDate={legalConfig.effectiveDate}
      scopeItems={[
        {
          label: "Business accounts",
          description:
            "Eligibility, teams, subscriptions, security, acceptable use, and allocation of operational responsibility.",
        },
        {
          label: "Published experiences",
          description:
            "Public links, recipient personalization, previews, tracking, replay, embeds, and visitor compliance.",
        },
        {
          label: "Enterprise data terms",
          description:
            "An integrated DPA, subprocessor authorization, security terms, US service-provider terms, and transfer clauses.",
        },
      ]}
      sections={sections}
      relatedLink={{ href: "/privacy", label: "Privacy Policy" }}
    />
  )
}
