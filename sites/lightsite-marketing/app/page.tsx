const appOrigin = "https://lightsite-bfi.pages.dev";

const nav = [
  ["Product", "#product"],
  ["How it works", "#how-it-works"],
  ["Tracking", "#tracking"],
  ["Pricing", "#pricing"],
] as const;

const proof = [
  "Super easy.",
  "Build in minutes.",
  "Start for free.",
  "No card required.",
] as const;

const faqs = [
  [
    "What can I add to a Lightsite?",
    "Add the client-facing material that moves a deal forward—documents, videos, links, timelines, next steps, and supporting context—all inside one simple site.",
  ],
  [
    "Does my prospect need an account?",
    "No. Prospects open the link you send and view the experience directly. You can update the site without sending a new link.",
  ],
  [
    "What does Lightsite track?",
    "Lightsite helps you understand meaningful buyer activity, including visits, return visits, content engagement, and sharing signals.",
  ],
  [
    "Can I start without a credit card?",
    "Yes. Create your account and start building for free. No card is required to get started.",
  ],
] as const;

export default function Home() {
  return (
    <div className="site-shell">
      <Header />
      <main>
        <section className="hero" id="top">
          <div className="hero-glow" aria-hidden="true" />
          <div className="container hero-inner">
            <p className="eyebrow-pill"><span aria-hidden="true">↗</span> One link. A clearer path to yes.</p>
            <h1>Build one pagers that close prospects.</h1>
            <p className="hero-subtitle">Bundle client-facing content into one sleek, trackable site.</p>
            <div className="hero-actions">
              <a className="button button-primary" href={`${appOrigin}/auth?mode=sign-up`}>Start building free <span aria-hidden="true">→</span></a>
              <a className="button button-secondary" href="#how-it-works">See how it works <span aria-hidden="true">▷</span></a>
            </div>

            <div className="product-wrap" id="product">
              <ul className="proof-strip">
                {proof.map((item) => <li key={item}><span className="check" aria-hidden="true">✓</span>{item}</li>)}
              </ul>
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="audience" aria-label="Teams that use Lightsite">
          <div className="container audience-row">
            <p>Built for client-facing teams</p>
            <div><span>Sales</span><span>Partnerships</span><span>Client services</span><span>Fundraising</span></div>
          </div>
        </section>

        <section className="section" id="how-it-works">
          <div className="container">
            <SectionHeading eyebrow="How it works" title="From scattered follow-up to one clear next step." description="Lightsite gives every deal a polished destination—and gives you the context to follow up at the right moment." />
            <div className="steps">
              <Step number="01" icon="↗" title="Collect the right content">Bring decks, videos, links, proposals, and next steps into one focused place.</Step>
              <Step number="02" icon="✦" title="Shape the story">Arrange everything into a polished one pager that feels built for the prospect.</Step>
              <Step number="03" icon="➤" title="Share and follow the signal">Send one link, then see what buyers open, revisit, and share with their team.</Step>
            </div>
          </div>
        </section>

        <section className="section product-story">
          <div className="container story-grid">
            <div>
              <p className="eyebrow">One link, built around the deal</p>
              <h2>Give buyers a place worth returning to.</h2>
              <p className="section-copy">Stop asking prospects to dig through old threads. Keep the story, the proof, and the next step together in a site that stays current.</p>
              <ul className="check-list">
                <CheckItem>Update content without resending the link</CheckItem>
                <CheckItem>Personalize the experience for every account</CheckItem>
                <CheckItem>Keep the buying team aligned in one place</CheckItem>
              </ul>
            </div>
            <StoryCards />
          </div>
        </section>

        <section className="section tracking" id="tracking">
          <div className="container">
            <div className="tracking-head">
              <SectionHeading eyebrow="Tracking" title="Know when interest turns into intent." description="See the moments that matter without turning your workflow into a dashboard chore." />
              <div className="metrics">
                <Metric value="Now" label="Live visit" /><Metric value="3×" label="Return visits" /><Metric value="4m 18s" label="Active time" /><Metric value="+2" label="New viewers" />
              </div>
            </div>
            <div className="signal-rail">
              <div className="signal-rail-head"><span><i /> Acme activity</span><small>Live signal rail</small></div>
              <div className="signals">
                <Signal tone="green" time="09:42" icon="◉" title="Maya opened the site">Viewed your launch plan</Signal>
                <Signal tone="blue" time="09:46" icon="▤" title="Business case opened">Active for 2m 31s</Signal>
                <Signal tone="purple" time="09:51" icon="♧" title="Shared with a teammate">A new stakeholder joined</Signal>
              </div>
            </div>
            <div className="tracking-benefits">
              <Benefit icon="◉" title="See real attention">Separate real engagement from a link that was merely opened.</Benefit>
              <Benefit icon="♧" title="Spot the buying team">Know when new stakeholders enter the conversation.</Benefit>
              <Benefit icon="◷" title="Follow up with context">Reach out when the deal is active and know what to talk about.</Benefit>
            </div>
          </div>
        </section>

        <section className="section pricing" id="pricing">
          <div className="container pricing-grid">
            <SectionHeading eyebrow="Pricing" title="Start with the deal in front of you." description="Create your first Lightsite for free. No card, no setup call, and no reason to keep sending attachment-heavy follow-ups." />
            <div className="price-card">
              <div className="price-top">
                <div><p>Free to start</p><div className="price"><strong>$0</strong><span>to build your first site</span></div></div>
                <a className="button button-primary" href={`${appOrigin}/auth?mode=sign-up`}>Start for free <span aria-hidden="true">→</span></a>
              </div>
              <ul className="price-features"><CheckItem>Build a polished one pager</CheckItem><CheckItem>Share with one simple link</CheckItem><CheckItem>Update content any time</CheckItem><CheckItem>No credit card required</CheckItem></ul>
            </div>
          </div>
        </section>

        <section className="section faq" id="faq">
          <div className="container faq-grid">
            <div><p className="eyebrow">FAQ</p><h2>A few things buyers usually ask.</h2></div>
            <div className="faq-list">
              {faqs.map(([question, answer], index) => (
                <details key={question} open={index === 0}><summary>{question}<span aria-hidden="true">⌄</span></summary><p>{answer}</p></details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta section">
          <div className="container cta-panel">
            <p className="eyebrow">One link. One clear story.</p>
            <h2>Make the next follow-up the one they remember.</h2>
            <p>Build a Lightsite in minutes and give your prospect a better way to say yes.</p>
            <a className="button button-light" href={`${appOrigin}/auth?mode=sign-up`}>Start building free <span aria-hidden="true">→</span></a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a className="logo-link" href="#top" aria-label="Lightsite home"><img src="/lightsite-logo.svg" alt="Lightsite" width="87" height="18" /></a>
        <nav aria-label="Primary navigation">{nav.map(([label, href]) => <a href={href} key={href}>{label}</a>)}</nav>
        <div className="auth-links"><a href={`${appOrigin}/auth`}>Log in</a><a className="button button-primary button-small" href={`${appOrigin}/auth?mode=sign-up`}>Sign up</a></div>
      </div>
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="preview-stage">
      <div className="live-toast"><i /><div><strong>Maya is viewing your Lightsite</strong><span>Business case · just now</span></div></div>
      <div className="browser-frame">
        <div className="browser-bar"><span className="dots"><i /><i /><i /></span><span className="address">↗ lightsite.io/acme/launch-plan</span><span className="live"><i /> Live</span></div>
        <div className="app-grid">
          <aside className="preview-nav"><div className="company"><b>N</b><span><strong>Northstar</strong><small>Renewal hub</small></span></div><ul><li className="active">Overview</li><li>Business case</li><li>Security</li><li>Implementation</li></ul></aside>
          <div className="preview-page"><p className="prepared"><i /> Prepared for Acme</p><h2>Your launch plan, all in one place.</h2><p>Everything your team needs to align, decide, and move into implementation.</p><div className="resources"><Resource icon="▥" title="ROI model" meta="Interactive sheet"/><Resource icon="▤" title="Security overview" meta="8 page brief"/><Resource icon="◷" title="Launch timeline" meta="4 week plan"/><Resource icon="○" title="Next-step recap" meta="From your last call"/></div><div className="next-step"><span><strong>Ready to move forward?</strong><small>Choose the next step that works for you.</small></span><b>Book kickoff</b></div></div>
          <aside className="activity"><p>Live activity</p><Activity tone="green" icon="◉" title="Maya opened" detail="Business case · now"/><Activity tone="blue" icon="♧" title="Shared internally" detail="2 new viewers · 9m"/><Activity tone="purple" icon="◷" title="Returned to site" detail="Third visit · 1h"/></aside>
        </div>
      </div>
    </div>
  );
}

function Resource({icon,title,meta}:{icon:string;title:string;meta:string}) { return <div className="resource"><i>{icon}</i><span><strong>{title}</strong><small>{meta}</small></span></div>; }
function Activity({tone,icon,title,detail}:{tone:string;icon:string;title:string;detail:string}) { return <div className="activity-card"><i className={tone}>{icon}</i><strong>{title}</strong><small>{detail}</small></div>; }
function SectionHeading({eyebrow,title,description}:{eyebrow:string;title:string;description:string}) { return <div className="section-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="section-copy">{description}</p></div>; }
function Step({number,icon,title,children}:{number:string;icon:string;title:string;children:string}) { return <article><div><span>{number}</span><i>{icon}</i></div><h3>{title}</h3><p>{children}</p></article>; }
function CheckItem({children}:{children:string}) { return <li><span className="check" aria-hidden="true">✓</span>{children}</li>; }
function Metric({value,label}:{value:string;label:string}) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function Signal({tone,time,icon,title,children}:{tone:string;time:string;icon:string;title:string;children:string}) { return <article><div><i className={tone}>{icon}</i><time>{time}</time></div><strong>{title}</strong><p>{children}</p></article>; }
function Benefit({icon,title,children}:{icon:string;title:string;children:string}) { return <article><i>{icon}</i><h3>{title}</h3><p>{children}</p></article>; }

function StoryCards() {
  return <div className="story-cards"><div className="impact-card"><div><span>Business case</span><span>Updated now</span></div><div className="impact"><small>Projected impact</small><strong>18 hours</strong><span>saved every week</span><div className="bars"><i/><i/><i/><i/><i/></div></div></div><div className="checklist-card"><div><span>Buyer checklist</span><span>3 of 4</span></div><ul><CheckItem>Review success plan</CheckItem><CheckItem>Share security brief</CheckItem><CheckItem>Confirm launch team</CheckItem><li><span className="empty-check"/>Book kickoff</li></ul></div></div>;
}

function Footer() {
  return <footer><div className="container footer-inner"><a className="logo-link" href="#top" aria-label="Back to top"><img src="/lightsite-logo.svg" alt="Lightsite" width="87" height="18" /></a><nav aria-label="Footer navigation">{nav.map(([label,href])=><a key={href} href={href}>{label}</a>)}<a href="#faq">FAQ</a><a href={`${appOrigin}/auth`}>Log in</a></nav><small>© {new Date().getFullYear()} Lightsite</small></div></footer>;
}
