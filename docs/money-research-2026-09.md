# Deep research: making money with Claude in 2026

*A ranked, evidence-flagged answer to "how do I harness Claude to make money?", researched
11 September 2026 for a solo founder who is full-time, has 3 to 9 months of runway, is open
to services and products, ships production software by directing Claude Code rather than
hand-coding, and sells in Spanish and English. Waypoint (this repo) is evaluated as one
candidate among many. Companion to `idea-research-2026-08.md`, which covered the travel
product portfolio; this doc does not repeat it.*

**How to read the confidence flags.** VERIFIED = a primary page was opened (Anthropic
pricing, Claude Code docs, GitHub repos, official changelog). REPORTED = a named outlet
or two independent sources agree, seen through search results. CLAIMED = a single vendor
blog or unevidenced founder self-report. The research environment's egress proxy blocked
almost every direct page fetch outside anthropic.com and github.com, so most money figures
below are REPORTED or CLAIMED. Where two research threads disagreed, the conflict is
recorded in the source notes and the better-sourced number is used.

---

## TL;DR

1. **The fastest money is services, sold as fixed-scope outcomes, not hours.** Every
   credible source shows hourly developer rates flat or falling (freelance dev rates down
   9 to 16 percent in 2026) while fixed-price builds ($5k to $25k) and retainers ($2k to
   $15k per month) hold. A solo operator who directs Claude Code well can realistically
   invoice within 30 days with three offers: a fixed-price two-week build, a document
   assistant for small firms, and Claude Code enablement for engineering teams.
2. **The most defensible product for you is a regulated, deadline-driven back-office
   workflow in Spanish.** Spain's Verifactu invoicing mandate lands 1 January 2027 for
   companies and 1 July 2027 for autónomos. Its e-invoicing law follows in October 2027
   and 2028. Every Latin American tax authority tightened rules in 2026. Compliance
   deadlines convert buyers faster than "AI" ever will, and the platforms will never chase
   per-country tax logic. Sell it through gestorías, who control thousands of small firms.
3. **Do not build developer tools, plugins, skills, or MCP servers as products.** No one
   has shown verified revenue from selling any of them. Anthropic's marketplace has no
   payment rail and its official directory has no application process. Every product that
   was "Claude Code plus a missing surface" was absorbed within 6 to 12 months (Terragon,
   Vibe Kanban, memory and usage plugins, code review bots).
4. **Waypoint is not a revenue candidate for this runway.** The August research called
   the friend graph the defensible asset. Since then Polarsteps shipped "places your friends
   loved" to 23 million users, Apple shipped Visited Places and Local Lists, Instagram
   shipped Map, and at least two direct entrants launched. Beli, the closest structural
   comparable, has 45 staff and no revenue model after five years. Turn Waypoint into a
   portfolio piece in two weeks and keep it as a nights-and-weekends project.
5. **Value is moving to owned distribution, proprietary vertical data, human sign-off in
   regulated niches, and integration into the systems small businesses already use.** It is
   moving away from generic building skill, prompt engineering, thin wrappers, and seat
   pricing. Building is now the cheap part.

---

## What changed 2025 to 2026 (market context)

1. **Building is nearly free and capability is a commodity.** SWE-bench Verified is
   saturated (Opus 5 at 96 percent, three labs within one point) and OpenAI stopped
   reporting it. Lovable reached a $200M to $600M run-rate with roughly 100 people; Base44
   went from zero to $100M ARR in about a year after Wix bought it. The price of "I can
   ship an app" has collapsed toward the price of a Lovable subscription. REPORTED.
2. **The frontier price is flat while last-generation prices fall.** Claude Fable 5.1 is
   $10 in and $50 out per million tokens; Opus 5 is $5 and $25; Sonnet 5 is $2 and $10 with
   a planned rise cancelled; cache reads on Fable 5.1 are $0.25. A one-hour Opus 5 coding
   session costs about $0.53 with caching. Agents with stable, long contexts are now cheap
   to run; browser and screenshot agents remain expensive (4,500 to 6,600 tokens of tool
   overhead per step). VERIFIED from Anthropic's pricing page.
3. **Platforms absorb horizontal surfaces on a 6 to 12 month cycle.** Anthropic's Cowork
   legal, finance and marketing plugins on 3 February 2026 moved roughly $285 billion of
   public software value in a week even though they were "structured prompts, no
   proprietary model". OpenAI killed its own Atlas browser after 292 days. Horizontal SaaS
   funding fell 35 percent in the year to Q1 2026 while vertical stayed flat. REPORTED.
4. **Revenue concentrates in four places.** Coding (Cursor at a reported $4B ARR),
   regulated vertical workflows with a licensed human signing off (Harvey $350M ARR, Basis
   $1.15B valuation for accounting firms), voice and phone agents that book real work
   (Avoca at $1B with 800 customers in trades; HappyRobot, a Madrid company, at $1.22B in
   freight), and "services rewired" rollups that buy accounting and IT firms and apply AI
   to the margin (Thrive Holdings raised $2B at $12B). REPORTED.
5. **The adoption gap is the SMB market.** The US Census finds 19.8 percent of businesses
   use AI; surveys of large enterprises say 88 percent. In Spain, small firms with 10 to
   49 staff sit at 8.7 percent, and only 9 percent of pymes report AI integrated
   "structurally". Agent deployment is in single digits across nearly all business
   functions (Stanford AI Index 2026). Systematic use is under 20 percent everywhere.
   That gap is closed by someone doing the integration, not by another chatbot. REPORTED.
6. **Pricing is moving from seats to outcomes.** Codex, GitHub Copilot and Cursor all
   moved to credits or usage in 2026. AI tools under $50 per month retained about 23
   percent of gross revenue in 2025; tools over $250 per month retained 70 to 85 percent.
   Annual billing cuts churn 40 to 60 percent. CLAIMED benchmarks, directionally
   consistent across sources.
7. **Spanish-speaking markets have a regulatory calendar that creates forced purchases.**
   Verifactu (Jan and Jul 2027), Crea y Crece B2B e-invoicing (Oct 2027 for firms over
   €8M, Oct 2028 for the rest), EU AI Act Article 50 disclosure for chatbots (in force
   since 2 August 2026), Mexico's SAT real-time platform access (April 2026), Colombia's
   DIAN consolidation, Chile's digital boleta (March 2026), Argentina's ARCA e-invoicing
   for monotributistas (November 2026), Peru's day-one e-receipts (June 2026). REPORTED,
   dates concordant across multiple sources.
8. **Public money in Spain is mostly spent.** Kit Digital closed on 31 October 2025 after
   860,000 grants; no new call was open as of August 2026. Kit Consulting still exists
   with AI advisory capped at €6k. Ticket Innova (up to €7k) is live. Do not plan revenue
   on subsidies. REPORTED.
9. **WhatsApp is the channel and Meta is commoditizing the generic bot.** Meta Business AI
   reached 18 Latin American countries in February 2026 and "Meta Business Agent" launched
   in July. From October 2026 Meta charges $2 per million tokens for automated
   conversations. Generic FAQ bots are dead; value sits in integrations with calendars,
   invoicing, payments and CRMs. REPORTED.
10. **The solo revenue curve is slower than the hype.** Evidenced solo results run $1k to
    $23k MRR after 6 to 8 months of work. "$62k MRR in 90 days" stories are unevidenced.
    Roughly 40 percent of micro-SaaS never reaches $1k MRR and about 6 percent clears
    $10k. With 3 to 9 months of runway you need paying pilots by month two, which points to
    a services-led entry into a product, not a self-serve launch. CLAIMED aggregates.

---

## The evaluation frame

Each candidate is scored on time to first revenue, fit with your two edges (directing
Claude Code; Spanish-speaking markets), moat and 12-month platform-absorption risk, capital
and hires needed, ceiling, and evidence quality. Because the year-one target is undecided,
the shortlists are given per tier: salary replacement (€3k to €8k per month), small company
(€20k to €100k per month), and venture scale.

---

## Verdicts by path

### Services

**S1. Fixed-price two-week build ("producto en 2 semanas").** HouseofMVPs sells exactly this
in English at $7,499 with Claude Code and claims 50 shipped products; no Spanish-language
equivalent surfaced. Spanish boutique pricing for AI-assisted MVPs is €5k to €25k over 3 to
5 weeks. A €6k to €12k, two-to-three-week offer with a handoff repo and a CLAUDE.md is both
credible and under-served. Risk: the buyer can get 80 percent from Lovable for $25 a month,
so the pitch must be "production-grade with auth, data model and tests", which Waypoint's
RLS suite and migration tests demonstrate. **Verdict: launch in week one. Ceiling: salary
replacement; a funnel for everything else.**

**S2. Document assistant for small firms ("agente sobre tus documentos").** The most
requested SMB item in Spain and Mexico: an assistant over the firm's own documents,
delivered on web and WhatsApp, with the EU AI Act disclosure built in. SMB pricing sits at
€4k to €8k build plus €300 to €600 per month. Deliverable in two weeks with the Anthropic
SDK pattern already in this repo (evidence retrieved deterministically, model rewrites but
never invents facts). **Verdict: launch in week one; it is the entry point to vertical P1
below.**

**S3. Claude Code enablement for engineering teams.** Vendors price discovery workshops at
$5k, team enablement at $15k to $40k, and Spanish training from €1,200 per day. The sales
wedge is documented: a 30-developer shop owned seats for a year with 50 percent weekly use
and no shared skills, hooks or settings. Near-zero delivery cost, no build risk, and the
natural on-ramp to fractional retainers of $6k to $18k per month. **Verdict: launch in
week one. Highest margin, slowest to scale.**

**S4. Rescue and hardening of vibe-coded apps.** Lovable and Base44 have flooded the
market with apps that break at the first real customer. "Security, auth, data, cost
control, then we run it for you" is a real 2026 wedge for someone who can prove testing
discipline. **Verdict: add as an offer under S1; do not lead with it.**

**S5. Fractional AI engineer or forward-deployed engineer retainer.** Job postings for
forward-deployed engineers grew several hundred percent year on year; 59 percent of hiring
companies are seed to Series A. Retainers of $6k to $18k per month for 8 to 20 hours a week
are the highest-value solo offer but the slowest to close. **Verdict: month two or three
upsell from S1 to S3, not a day-one offer.**

**S6. White-label overflow for agencies.** Agencies source Claude Code build capacity at
€23 to €60 per hour. Low margin, immediate. **Verdict: use only to land invoices one to
three if the warm network is dry.**

### Products

**P1. Verifactu and e-invoice readiness practice sold through gestorías, converting to
per-client software.** Gestorías are the best channel found in the whole research: 86
percent of advisor time is automatable, a 12-person firm chose a €12k four-week AI project
over a €78k incumbent bid (single case, CLAIMED), and each firm controls hundreds of
client companies that must comply by January or July 2027. The free AEAT app is manual-only;
incumbents (Holded, Sage, A3, Anfix, Quipu) are horizontal. Paid work is migration of
legacy Excel, Access and custom ERPs, document intake, and validation, not reselling
invoicing software. Warning: writing your own invoicing engine makes you a "productor" with
declaración responsable liability; integrate a certified engine. **Verdict: the best
product bet. Start as a fixed-fee service in Q4 2026, convert to per-client SaaS as the
January 2027 wave arrives. Ceiling: small company.**

**P2. WhatsApp agent with tax-compliant invoicing for small tourism and hospitality
operators.** Spain's hotel bookings grew 11.5 percent in summer 2026; hotel-grade vendors
(Mirai, SiteMinder) and funded bots (Instinct at $2.5B, WeSpeak) ignore apartamentos
turísticos, tour operators and small agencies. Booking plus payment plus a Verifactu or
CFDI receipt in one WhatsApp flow is a real gap, and Stripe works in both Spain and Mexico.
Meta's own Business Agent will eat any version that is only a chatbot. **Verdict: strong
second product, or the first if a paying operator appears during S2. Ceiling: small
company.**

**P3. Missed-call-to-booked-job voice agent for Spanish-speaking trades.** Avoca ($1B, 800
customers, first ten from trade shows) and HappyRobot ($1.22B, Madrid) prove buyers pay for
agents that book real work. Nobody at scale serves Spanish-speaking HVAC, plumbing and
roofing crews in the US Sunbelt or small contractors in Spain and Mexico. Priced per booked
job or $200 to $1,000 per month. Telephony adds cost and ops. **Verdict: the venture-shaped
option. Pursue after services cover burn, ideally with a design partner from the trades.**

**P4. Extranjería intake and case monitoring for immigration lawyers and gestorías.**
Documented pain (appointment slots gone in under five minutes, multilingual intake), and
Lexroom (€43M raised, €10M revenue) will own general legal AI in Spain but is unlikely to
go this narrow. Regulatory risk if you automate appointment booking itself. **Verdict: a
credible niche; evidence is vendor-blog grade. Validate with three lawyers before building.**

**P5. Licitaciones assistant plus micro-bidding on public AI contracts.** Spain awarded
about 200 AI contracts in the year to May 2026 at a median of €80k, two thirds under €150k.
**Verdict: longer sales cycle; pair with P1 or S3 rather than lead.**

**P6. Spanish-language Claude Code course and audience.** The top two English Udemy courses
have 99,000 and 81,000 students; a Portuguese-language course is a bestseller with 14,600.
No instructor disclosed revenue, and Anthropic's own academy is free. The value is less the
course income than the owned audience, which the predictions section rates as the position
that appreciates most. **Verdict: build the audience as a by-product of S3 (record the
workshops); do not make it the business.**

**P7. Slot-drop copilot for Rome (from the August doc).** Still the most credible paid
standalone in the travel portfolio, but it is a net-new product with scraping ops, legal
grey zones, and the Colosseum now ships a free official ticket-finder app. **Verdict: a
second bet only once income exists.**

### Waypoint

**W1. Consumer launch.** Probability of exceeding €2k per month by month twelve: 3 to 5
percent. The best comparables monetize late and thinly: Polarsteps needed about ten years
and €5M to make print books its revenue line; Wanderlog is at roughly $1M ARR after six
years with 1.5M monthly users; Mindtrip pays creators $1 to $1.50 per registered user,
which is the market's revealed price of a travel-app user. Paid acquisition at $5.84 per
iOS install makes €2k per month cost $200k to $500k of installs. And the whitespace is
gone: Polarsteps Explore (summer 2026), Apple Visited Places (iOS 26) and Local Lists (iOS
27), Instagram Map (August 2025), Pinr, Boop. **Verdict: no.**

**W2. B2B white-label for tour operators or agencies.** Competes with Travefy at $39 per
month, Tern, TravelJoy and WeTravel (free plus 1 percent). About 40 percent code reuse.
**Verdict: only as a paid €3k to €10k engagement if an operator asks; never speculatively.**

**W3. Sell the codebase.** Pre-revenue projects fetch $1k to $5k on Acquire.com. **Verdict:
no; its portfolio value exceeds that in the first client conversation.**

**W4. Portfolio piece feeding services.** Open-source it, write the case study around what
buyers pay for (production Next.js and Supabase, row-level security proven by 30 automated
privacy assertions, a migration chain tested end to end through real PostgREST, a Claude
layer that never fabricates facts, all built solo by directing Claude Code), record a
three-minute demo, keep the seeded demo live. Probability this contributes to more than €2k
per month within twelve months: 55 to 70 percent, conditional on doing outbound.
**Verdict: yes, within two weeks. Keep feature work to what a client pays for or what
tests the one falsifiable question from the August doc.**

### Do not do these

- **Claude Code plugins, skills, MCP servers or agent harnesses as products.** Anthropic's
  plugin system has no licensing, payment or metering (VERIFIED in the docs). The official
  directory lists about 280 entries, roughly 240 of them large partners, with "no
  application process". Fewer than 5 percent of the 9,652 registry servers are monetized.
  Repos with 100k to 250k stars monetize through $19-a-seat hosted tiers, affiliate
  commissions from API relays, or vendor sponsorship; individual donations are effectively
  zero (SuperClaude: $0 of a $500 per month goal). The paid-MCP boilerplate was archived
  on 13 August 2026. Registries did not become businesses; Smithery sold for an undisclosed
  sum. Stars buy distribution, not income.
- **Anything that is "Claude Code plus a missing surface".** Terragon (cloud runner) died
  in February 2026; Claude Code on the web already existed. Vibe Kanban died in April 2026
  because "the vast majority were free users"; Anthropic shipped a native agent view one
  month later. Memory, usage tracking, code review and remote control all went native in
  2026. The changelog telegraphs intent weeks ahead; anything Anthropic iterates on daily is
  off limits.
- **Horizontal inbox, calendar, notes, support-bot or "chat with your docs" products.**
  ChatGPT Work, Claude Cowork and Gemini in Workspace do these natively; Intercom and
  Zendesk bundle support at $1 to $2 per resolution. Fyxer-type products must go vertical
  or die. Superhuman sold to Grammarly.
- **Agent infrastructure: evals, observability, gateways, browser agents, payment rails.**
  Langfuse went to ClickHouse and Promptfoo to OpenAI (VERIFIED), Braintrust raised $80M,
  Snowflake and Cloudflare ship gateways, three labs ship computer use natively, and the
  x402 payments standard sits under the Linux Foundation with Visa, Mastercard, Amex and
  Stripe. Your Claude Code skill is a cost advantage here, not a moat.
- **Generic "AI for agencies", consumer tutoring, marketing copy, clinic receptionists,
  restaurant bots, oposiciones apps, remittances.** Either absorbed by platforms, crowded
  (eight Spanish clinic-receptionist vendors in one search), or licence-gated.
- **Thin legal or accounting assistants.** The Cowork plugins prove Anthropic will keep
  shipping vertical prompts for legal, finance and marketing. Build below them, in a
  sub-niche with proprietary data or a compliance workflow, or not at all.

---

## Scorecard

Time = weeks to first invoice. Fit = match to your edges. Moat = defensibility and inverse
of 12-month absorption risk. Ceiling: SAL = salary replacement, SME = small company,
VEN = venture. Evidence: V = verified, R = reported, C = claimed.

| Path | Time | Fit | Moat | Capital | Ceiling | Evidence | Verdict |
|---|---|---|---|---|---|---|---|
| S1 Fixed-price two-week build | 2 to 4 | High | Low | None | SAL | R/C | Launch now |
| S2 Document assistant for small firms | 2 to 4 | High | Low to med | None | SAL to SME | R | Launch now |
| S3 Claude Code enablement | 1 to 3 | High | Low | None | SAL | C (vendor prices) | Launch now |
| S4 Vibe-code rescue | 2 to 4 | High | Low | None | SAL | R | Offer under S1 |
| S5 Fractional or FDE retainer | 8 to 12 | High | Low | None | SAL to SME | R | Month 2 to 3 upsell |
| S6 Agency overflow | 1 to 2 | Med | None | None | SAL | C | Fallback only |
| P1 Verifactu practice via gestorías | 4 to 8 | Very high | Med to high | Low | SME | R (dates V-grade) | Best product bet |
| P2 WhatsApp + compliant invoicing, tourism | 8 to 12 | High | Med | Low | SME | R | Second product |
| P3 Trades voice agent, Spanish | 12 to 20 | High | Med | Low to med | SME to VEN | R | After burn is covered |
| P4 Extranjería intake | 8 to 12 | High | Med | Low | SAL to SME | C | Validate first |
| P5 Licitaciones assistant | 12+ | Med | Med | Low | SME | R | Pair, do not lead |
| P6 Spanish Claude Code course | 6 to 10 | High | Low | None | SAL | R | By-product of S3 |
| P7 Slot-drop copilot (Rome) | 12+ | Med | Med | Low | SAL to SME | R | Later bet |
| W1 Waypoint consumer | 26+ | Med | None now | Med | SAL at best | R | No |
| W2 Waypoint B2B white-label | 12+ | Med | Low | Low | SAL | R | Only if paid |
| W4 Waypoint as portfolio | 2 | High | n/a | None | Enables S1 to S3 | R | Yes, now |
| Plugins, skills, MCP as products | n/a | High | None | None | None shown | V | No |
| Agent infra, horizontal copilots | n/a | Med | None | High | n/a | V/R | No |

---

## Three shortlists, one per target

**If the goal is to replace a salary (€3k to €8k per month, profitable, solo):**
1. S3 Claude Code enablement (two workshops a month at €2.5k to €5k covers the floor).
2. S1 fixed-price builds (one per month at €6k to €12k).
3. S2 document assistants (build fee plus €300 to €600 per month recurring, which is what
   turns this tier into a cushion). Target: five retainers by month six.

**If the goal is a small company (€20k to €100k per month, a few hires, bootstrapped):**
1. P1 Verifactu practice through gestorías, priced per client firm, launched as service in
   Q4 2026 and productized before the January 2027 deadline.
2. P2 WhatsApp plus compliant invoicing for small tourism operators, Spain then Mexico.
3. S5 retainers with the two or three best services clients to fund the build. Hire a
   Spanish-speaking implementer at nearshore rates ($35 to $70 per hour) when retainers
   exceed your hours.

**If the goal is venture scale:**
1. P3 Spanish-language trades voice agent, with Avoca and HappyRobot as the comparables
   and a trade association or franchise network as the first channel.
2. A micro-rollup of gestoría functions: take over document intake, reconciliation and
   compliance for a few firms at a per-unit price, which is the Thrive Holdings playbook at
   solo scale. This is the only path where the dataset you accumulate (labeled workflow
   output from real firms) is what private equity is currently paying billions for.
3. Nothing in the travel portfolio qualifies on this runway.

---

## Recommended sequence and 90-day plan

**Days 0 to 14: convert what you have into proof.**
- Open-source Waypoint, publish the case study, record the demo, keep the seeded deploy
  live. Add a one-page services site in Spanish and English with the three offers (S1, S2,
  S3), fixed prices, and Article 50 disclosure language in every chatbot deliverable.
- Join the Claude Partner Network (free) and sit the Claude Certified Architect
  Foundations exam ($125) for the badge and academy access. Ignore the Select tier; it needs
  ten certified people, though a "virtual firm" of certified solos is a cheap moat later.
- List every warm contact who runs or advises a company. Warm intros close 5 to 10 times
  faster than cold; the only numeric cold-email account found needed 83 emails for five
  clients at about $1,280 each.

**Days 14 to 60: first three invoices.**
- Lead every conversation with a three-minute recording of a working agent on the
  prospect's own public data. Sell scope, never hours. Take 50 percent up front.
- Offer S3 to CTOs of Spanish software houses with unused Claude Code seats; offer S1 and
  S2 to founders and ops managers; use S6 agency overflow only if the pipeline is empty by
  day 30.
- Every build ships with the disclosure, a CLAUDE.md, and a maintenance retainer priced
  above €250 per month, billed annually where possible.

**Days 60 to 90: pick the vertical by who paid.**
- If a gestoría, asesoría or accountant bought S2, go to P1: package "client-base
  migration plus document intake" as a fixed fee and line up three firms before the Q1 2027
  rush.
- If a tourism operator bought S2, go to P2.
- If neither, keep the services stack and revisit at month six. The Verifactu wave and the
  October 2027 e-invoicing start both fall inside your window either way.
- Hard rule for Waypoint: no feature work unless a client pays for it or it tests the one
  question from the August doc with real users.

**Months 3 to 9: productize what repeated.** Turn the second identical build into a
product, accumulate the dataset (corrections, outcomes, document types), price per client
or per completed unit, and decide at month six whether the tier-two shortlist is funded by
retainers or whether services remain the business.

---

## Predictions

### Next 6 to 18 months (to roughly March 2028)

- **Frontier list prices stay at or above $10 in and $50 out; the previous generation
  drops another 50 percent or more.** Confidence 75 percent. Watch Anthropic's pricing page
  and OpenAI's top tier. Model your unit economics on last-generation prices, never on a
  promised cut.
- **Sonnet-class models become the default agent workhorse and Haiku-class falls below
  $0.50 per million input.** Confidence 70 percent. This is what makes per-client pricing
  of P1 and P2 comfortable.
- **At least one top-five coding tool drops its flat seat plan entirely.** Confidence 65
  percent. Codex, Copilot and Cursor already moved spend to credits between April and June
  2026. Seat-priced AI features are a dying model; price per outcome.
- **The 50 percent METR time horizon passes one work-week while the 80 percent horizon
  stays under eight hours.** Confidence 60 and 70 percent. The 80 percent line gates
  unsupervised deployment. Agents will do more, but a human still signs off on anything
  long. That keeps human-in-the-loop services valuable through 2027.
- **Enterprise agent deployment rises from single digits to 10 to 20 percent of functions
  in the 2027 Stanford index; US Census business AI use crosses 25 but not 35 percent.**
  Confidence 55 and 70 percent. The gap closes through implementers, not chatbots. Your
  services stack sells into exactly this.
- **Anthropic ships more Cowork vertical plugins (legal, finance, marketing, likely
  accounting and HR) and at least one more Claude Code surface that kills a third-party
  category.** Confidence 80 percent. Check the changelog monthly.
- **Meta's token pricing and Business Agent push generic WhatsApp bot vendors in Latin
  America out of business; survivors are integration-heavy.** Confidence 70 percent.
- **Verifactu produces a second last-minute buying wave in H2 2026 and H1 2027, and at
  least one further postponement is possible.** Confidence 65 percent on the wave, 35
  percent on another delay. Sell readiness and migration, which are valuable whether or not
  the date moves.
- **A services rollup publishes audited margin expansion of ten points or more on an
  acquired firm.** Confidence 50 percent. If it does, "services as software" becomes the
  dominant funded model for the next cycle; if it does not, the rollup thesis stalls.
- **Stripe or Visa publishes an agent-initiated transaction figure.** Confidence 65
  percent. Rails exist; volume does not yet.

### Two to five years (2028 to 2031)

- **Undifferentiated text inference (translation, summarization, transcription, basic
  retrieval) is priced under $0.10 per million and is effectively free at small scale.**
  Confidence 85 percent. Never build a product whose value is one of these.
- **The coding harness becomes a feature of the model vendor.** Confidence 65 percent.
  Tools and wrappers around Claude Code have no standalone future.
- **More than half of new enterprise AI spend is priced per outcome or credit.**
  Confidence 70 percent.
- **Three or more AI-services rollups exceed $1B revenue each, and standalone "AI
  consulting" is absorbed by rollups and labs' forward-deployed teams.** Confidence 55
  percent. Services are the entry, not the destination; own a workflow and its data before
  this happens.
- **Computer-use agents reach the human baseline on OSWorld but stay a minority of
  production traffic because API-integrated agents are 5 to 20 times cheaper per step.**
  Confidence 70 percent. Integrations beat browser automation.
- **The 80 percent METR horizon reaches a full work-day, producing the first credible
  drop-in for bounded junior knowledge roles.** Confidence 55 percent. Businesses that
  own the customer relationship and the verification step capture this; businesses that
  sell the labor do not.
- **Open-weight models sit within six months of the frontier on economically valuable
  tasks, and local-language, sovereign products run on near-zero inference cost with the
  trust and compliance layer local.** Confidence 55 percent. Spanish-language,
  compliance-bound products get cheaper to run every year while their moat stays local.
- **Regulated vertical AI captures more enterprise application revenue than horizontal
  copilots.** Confidence 60 percent. In 2025 copilots took $8.4B and verticals $3.5B; watch
  the Menlo report for the flip.

### Positions that gain value, and positions that lose it

More valuable in 12 to 24 months: an owned list or audience of a specific buyer;
proprietary vertical data and feedback loops (private equity is paying for tax-return
histories); human sign-off in a regulated niche; integration into the incumbent systems of
the small-business long tail; reliability engineering for one workflow; local-language
compliance products; outcome-priced service delivery in one niche; and, early and high
variance, products native to agent payments.

Less valuable: generic building skill; prompt engineering (Anthropic's own docs now say
prompts written for earlier models are "too prescriptive" on Fable 5, a half-life of one
model generation); thin wrappers and horizontal copilots; token resale and generic MCP
servers; transcription, translation and summarization without a vertical; seat-based AI
pricing; and betting on a frontier price collapse.

---

## Source notes

Compiled from roughly 190 web searches across six parallel research threads (verified
earners and the Claude Code economy; services market; product categories; Spanish-speaking
markets; Waypoint valuation; predictions), 11 September 2026. Direct page fetches were
blocked by the research environment's proxy for all hosts except anthropic.com, code.claude.com
and github.com, so only the following are VERIFIED from primary pages: Anthropic model,
cache, batch and tool pricing; Claude Code plugin and marketplace documentation; the Claude
Code changelog and release tags; the official and community plugin marketplace manifests;
the READMEs, pricing and sponsor pages of the major Claude Code ecosystem repos (ECC,
claude-mem, Graphify, cc-switch, ccusage, claude-code-templates, marketingskills, Vibe
Kanban, Omnara, mcp-boilerplate); the Langfuse and Promptfoo acquisition notices; and the
Expedia announcement of the Layla acquisition. Everything else is REPORTED from search
results of named outlets or CLAIMED from vendor content, as flagged inline.

Load-bearing REPORTED sources: CNBC (Harvey), Fortune and PRNewswire (Avoca), Yahoo Finance
and Reuters (HappyRobot), Bloomberg and Dealroom (Lovable), Calcalist (Base44), SiliconANGLE
(Braintrust, PitchBook H1 2026), TechCrunch (Atlas shutdown, Thrive Holdings, Superhuman,
Boop), Crunchbase News (H1 2026 venture), Menlo Ventures 2025 enterprise report, Ramp AI
Index, US Census BTOS, Stanford AI Index 2026, METR Time Horizon 1.1, the GDPval paper,
arXiv HORIZON and SWE-ABS papers, Infobae and Infoautónomos (Verifactu postponement, BOE 3
December 2025), BBVA and Docuten (Crea y Crece calendar), Cooley and Stibbe (AI Act Article
50), White & Case and Bird & Bird (Digital Omnibus), IONOS and Eurostat (Spanish adoption),
Microsoft LatAm SME survey, El Español (Lexroom), Ivey Business Review (Beli), Polarsteps
press releases, Peecho case study, Latka (Wanderlog, TypingMind, PDF.ai), Udemy course
pages, HouseofMVPs, Kriv, Syntalith, Javadex and Upliora (Spanish pricing), Uniamos and
Magokoro (Mexican pricing), Leadsales and CRMWhata (WhatsApp rates), Ecosistema Startup
(Meta token fee, Kapso, Félix Pago), Proment Consulting and Aivy (Kit Digital status).

Conflicts resolved: one thread reported Verifactu deadlines of January and July 2026; five
concordant sources confirm the postponement to 2027 by Real Decreto-ley 15/2025, which is
used. One thread described Kit Digital vouchers as available; the Spanish-market thread found
the program closed since 31 October 2025 with no open call, which is used. Lovable's ARR
appears as both $200M and a $600M run-rate in different outlets; both are given as a range.
Two aggregator items (a reported Cursor acquisition and a next-generation OpenAI model name)
were excluded as unverifiable.

Thin areas to re-verify before quoting to a client or investor: Polarsteps Plus pricing;
the €12k gestoría case study; Kit Consulting call status; Bizum business fees; SME AI
adoption in Argentina, Chile and Peru; PAC and DIAN accreditation requirements; Argentine
FX rules for software exports; Claude Partner Network tier requirements (from partner
blogs, not Anthropic); all Udemy enrolment figures; and every hourly or project price,
which comes from vendor content and should be treated as directional.
