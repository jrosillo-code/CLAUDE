# Research: Spanish insurance brokerages as a market for workflow automation

*Evidence base for Track A of `plan-2026-09.md`, researched 12 September 2026. About 70
Spanish-first web searches; direct page fetches were blocked, so figures come from search
snippets of the cited pages. VERIFIED = verbatim in an official or primary snippet;
REPORTED = sector press citing a primary source; CLAIMED = vendor or forum.*

## TL;DR

- About 3,445 corredores and corredurías in the DGSFP registry (November 2025), shrinking
  6.6 percent a year through consolidation; roughly 2,560 are companies. Revenue is
  concentrated: 212 independent firms over €1M make about 65 percent of independent
  revenue. The long tail (under €250k revenue, about €76k revenue per employee) is where a
  family brokerage most likely sits. REPORTED.
- The broker channel earned about €2.0B in commissions in 2024 (up 7 percent), average
  non-life commission 13.2 percent. Money exists, but is concentrated. REPORTED.
- **The pilot workflow to start with is monthly commission reconciliation** (insurer
  settlement statements against the firm's expected receipts). It is the one task
  vendors, press and US funding all agree is manual, format-fragmented, recurring and
  money-bearing; it is back-office only (no AI Act Article 50 exposure, no health data);
  a family brokerage has 12+ months of history to backtest; and the deliverable is a euro
  figure. Comulate raised $20M on exactly this in the US; Applied Systems ships it inside
  its suite; nobody serves the Spanish small-brokerage slot.
- Second pilot: a coverage and claims assistant over condicionados plus cartera. Claims
  service is the worst-rated insurer service in the ADECOSE barometer (6.46 of 10) and
  the knowledge lives in two or three veterans per firm.
- Integrate with whatever the brokerage runs (ebroker has open web services; segElevia
  works through partners; Mediator is desktop) and treat EIAC files as the canonical data
  source: 46 insurers and about 85 to 90 percent of mediated premiums flow through it.
- Price in the observed band: €250 to €600 a month per brokerage plus setup, anchored
  against an admin employee at roughly €24k to €32k fully loaded (estimate). Mediator is
  €299 a month all-in; Avant2 is about €24 per user per month.
- Go through networks and colegios, not one by one: one deal with Senda, Espabrok or E2K
  reaches 100 to 150 brokerages; "segElevia by Colegio de Madrid" proves colegios
  white-label vendors.
- Watch Afori (Barcelona and Berlin, €4M from General Catalyst, same "email and documents
  to tasks" thesis); it will go after large ADECOSE brokers and networks first.

## Market structure

| Item | Figure | Source | Flag |
|---|---|---|---|
| Corredores and corredurías, DGSFP | 3,445 at 21 Nov 2025 (down 6.6 percent); 884 individuals, 2,561 companies; 90 new companies vs 247 cancellations | DGSFP annual report via INESE | REPORTED |
| Exclusive agents | 50,241 (Nov 2025), down 5.8 percent | DGSFP via SegurosNews | REPORTED |
| Broker-channel non-life premiums | €14,322M intermediated in 2024 (up 3.6 percent), about 31 percent of non-life | DGSFP via INESE; ICEA | REPORTED |
| Broker commission income | €2,033M in 2024 (up 7 percent); non-life average 13.19 percent; home 22 to 25 percent | DGSFP via INESE | REPORTED |
| Size distribution | 1,683 independents with revenue over €25k made €1,172.6M; 212 over €1M made €762.5M | INESE Estado Económico-Financiero 2025 | REPORTED |
| Small-broker economics | Under €250k revenue: growth 2.3 percent vs 10.7 percent sector; €76,550 revenue per employee vs €159,000 at over €1M | INESE 2025 | REPORTED |
| ADECOSE (large brokers) | About 100 members, €9.3B premiums, claims about 70 percent of the channel | ADECOSE 2025 | REPORTED |
| FECOR (small and medium) | 18 to 19 associations, 800 to 850 brokerages; congress in October | fecor.es | REPORTED |
| Networks | E2K about 150 brokerages, 357 offices, €460M; Espabrok 135 brokerages, €451M (2025); Grupo Concentra consolidator over €260M; Willis Networks; Senda Vivir Seguros; Club Català | vendor and press | CLAIMED / REPORTED |
| Events | Semana del Seguro (February, IFEMA); Forinvest (March, Valencia); ADECOSE Foro (June); FECOR congress (October); CIMA annual meeting; colegio jornadas | press | REPORTED |

## Incumbent software

| Vendor | What | Price | API and integrations | AI | Flag |
|---|---|---|---|---|---|
| ebroker (Suite ebroker) | Cloud ERP: policies, receipts, claims, accounting, CRM with WhatsApp, Merlin quoting, BI | Not public; forum calls it expensive | Web services and API, Outlook, EIAC bidirectionality pilots; Kit Digital agent for 200+ brokerages | Xirin assistant, SELL PRO propensity, AI quoting on 2026 roadmap | REPORTED |
| MPM segElevia | Cloud ERP and CRM, TarifAI quoting (35 insurers), client portals; "by Colegio de Madrid" and Colmedse deals; Senda network deal | Not public; Kit Digital pack €5,200 to €15,000 | TarifAI, IMEureka, EIAC | EVIA support assistant, Elevia Analytics | REPORTED |
| Codeoscopic Avant2 + Tesis | Quoting and sales CRM (50+ insurers, 120 products); ERP bidirectional | From €23.95 per user per month | REST API to quote and issue; Consejo General agreement | ML sales opportunities | VERIFIED (price) |
| Mediator | Desktop, 30 years, 1,000+ brokerages: clients, policies, receipts, claims, commissions, settlements, SEPA | From €299 a month, unlimited users, no minimum | Insurer connectors | None found | VERIFIED (price) |
| Brokersfarm, iSegur, Euro Agent, Gecose | Smaller cloud or desktop managers | Not public; "a third of ebroker" (forum) | EIAC | None | CLAIMED |
| ZOA Suite | Communications layer: WhatsApp API inbox, virtual PBX, shared mailboxes, alerts | Not public | Beside the ERP | AI answers out-of-hours claims on WhatsApp | CLAIMED |
| Foliume | Cross-sell and churn analytics, Wilfredo assistant in WhatsApp, voice agents | By portfolio size | ERP, quoting, insurers | Core | CLAIMED |
| Gesbroker, Mediaseg, Broker Suite, Solvermedia, Alicia | No evidence as broker ERPs; treat as stale names | | | | Thin |

EIAC and CIMA: EIAC is the UNESPA and broker-association open standard for policies,
receipts, claims and settlements; version 7.1 rolls out in 2026. CIMA (2025): 46 insurers,
28 tech firms, about 2,200 brokers adhered, about 800k files a month, about 90 percent of
mediated premiums. For connected brokers the residual manual work is insurers not on
EIAC, settlements that still arrive as PDF or Excel, and everything client-facing.

## Workflow pain points

| Workflow | Evidence | System touched | Flag |
|---|---|---|---|
| Commission settlements (liquidaciones) | Each insurer settles in a different format; someone opens them one by one to cross with cartera; brokers must also check insurer-issued commission invoices. US analog Comulate claims over 90 percent of manual accounting eliminated | ERP, insurer portals, EIAC files | CLAIMED (vendors) plus REPORTED (Grupo Aseguranza on invoices) |
| Claims and coverage lookup | Claims service rated 6.46 of 10 in the ADECOSE barometer, no improvement in 8 years; a 12-person brokerage case: coverage questions required searching dozens of condicionados, knowledge in 2 or 3 veterans; project €5k to €20k in about a month | condicionados PDFs, ERP claims, email and WhatsApp | REPORTED / CLAIMED |
| Renewals | 2026 growth carried by cartera (about plus 5 percent) while new business fell in Q2 amid an insurer price war; brokers must re-quote to retain | ERP expiries, quoting, client comms | REPORTED |
| Returned receipts | Standard demand for alerts; chasing the client is manual | ERP receipts, WhatsApp, phone | CLAIMED |
| Client communications | Calls on the PBX, emails on each agent's PC, WhatsApp on personal phones; hours answering routine questions and requesting documents | personal phones, Outlook, ERP | CLAIMED |
| Regulatory paperwork | 592 of 3,704 supervised brokers (16 percent) did not file the last DEC; sanctions €25k to €80k; new DEC model since January 2025 | DEC portal, archive | REPORTED |
| AI adoption | "High or very high" tech level rose from 38 to 53 percent in six months; about 30 percent of brokerages use AI tools | | REPORTED |

No independent Spanish time-and-motion data exists for any workflow. The family pilot is
the way to produce the first credible number.

## Regulatory drivers

| Driver | Date | Meaning for a small brokerage | Flag |
|---|---|---|---|
| RDL 3/2020 (IDD) | In force | Advice duties, pre-contractual documents, 6-year retention, training hours, sanctions up to 5 percent of turnover | REPORTED |
| New DEC (Orden ECM/1501/2024) | 2 Jan 2025 | Heavier statistical return; 16 percent non-filing means enforcement risk | REPORTED |
| DGSFP priorities 2026 to 2028 | Early 2026 | Digitalisation and tech risk including AI governance: explainability, human oversight, traceability | REPORTED |
| DORA | 17 Jan 2025 | Micro, small and medium intermediaries excluded; a vendor to small brokers is not a DORA ICT third party | REPORTED |
| EU AI Act | Literacy Feb 2025; Article 50 transparency 2 Aug 2026; high-risk (life and health pricing) 2 Dec 2027 | Back-office automation is minimal risk; any client-facing agent must self-identify; pricing is the insurer's problem | REPORTED |
| EIOPA opinion on AI governance | 6 Aug 2025 | Covers intermediaries; proportionality, human oversight, records; a useful checklist for the pitch | VERIFIED |
| GDPR and health data | Ongoing | Brokerage is an independent controller; health questionnaires are special categories; EU processing and a DPA are required | REPORTED |
| Verifactu | 1 Jan 2027 companies, 1 Jul 2027 individuals | Brokerages issue VAT-exempt commission invoices; many delegate to insurers but remain responsible for numbering | REPORTED |
| Price war | 2026 | New production up 17 percent in Q1, down in Q2; retention automation is revenue-protective | REPORTED |

## AI and insurtech entrants

| Company | What | Funding | Flag |
|---|---|---|---|
| Afori (Berlin, Barcelona office; ex-wefox founders) | AI agents for broker back office: email classification, document extraction, task creation in Outlook; DE and EN | €4M pre-seed, Oct 2025, General Catalyst | REPORTED |
| SegurosIA (Málaga) | AI agents for service, sales, underwriting, claims; its agent passed the official level-2 distributor exam; in the financial sandbox | EONIQ, Backfund | REPORTED |
| Foliume, ZOA Suite, Correduidea ONE | Analytics, communications, internal AI ecosystems for brokers | Undisclosed | CLAIMED |
| Javadex (solo consultant) | Private RAG over condicionados and cartera, 4 to 6 week builds, €5k to €20k | Consultancy | CLAIMED |
| Insurers' own | Generali GenIA advisor for brokers (Mar 2025); Mapfre broker portal with assistant; Zurich connectivity | | REPORTED |
| US comparables | Comulate $20M Series B (commission reconciliation); Fintary $10M; Fulcrum $25M (policy checking, certificates, proposals); Outmarket $17M; Harper $46.8M (AI-native brokerage); Applied Recon inside Applied Systems | | REPORTED |

Spanish insurtech ecosystem: 107 companies, 2,357 jobs, €171M revenue (Santalucía
Impulsa 2026). REPORTED.

## Willingness to pay

| Signal | Figure | Flag |
|---|---|---|
| Mediator licence | From €299 a month, unlimited users | VERIFIED |
| Avant2 | From €23.95 per user per month plus add-ons | VERIFIED |
| segElevia Kit Digital pack (3 users) | €5,200 to €15,000 | REPORTED |
| Bespoke AI project at a 12-person brokerage | €5k to €20k, about a month | CLAIMED |
| Admin employee, fully loaded | About €24k to €32k a year (estimate from the sector agreement's minimums) | ESTIMATE |
| Revenue per employee | €76,550 (under €250k firms) to €159,000 (over €1M) | REPORTED |
| Independent ROI case at a correduría | None found | Thin |

## Distribution channels

1. Broker networks that centralise technology: Senda (ZOA deal), Espabrok, E2K, Willis
   Networks, Club Català, BLB Partner. One deal reaches 100 to 150 brokerages.
2. Colegios and the Consejo General: "segElevia by Colegio de Madrid" shows white-label
   deals; Consejo General had an Avant2 framework deal; colegios run AI jornadas.
3. Associations: FECOR sponsor programme and October congress; ADECOSE forum in June
   (large members).
4. Incumbent ecosystems: ebroker open APIs, MPM's marketplace, Codeoscopic REST API, CIMA
   adhesion as a technology firm.
5. Sector press: SegurosNews, Grupo Aseguranza and Carta del Mediador, PymeSeguros, INESE
   and its Füture vertical, Muy Segura, Seguros TV, elblogdelcorredor.
6. Events: Semana del Seguro, Forinvest, FECOR congress, CIMA meeting, regional colegio
   encounters.
7. LinkedIn: Consejo General, colegio pages, Correduidea's broker test group.

## Takeaways for Track A

1. Pilot first: monthly settlement reconciliation. Output is euros recovered plus hours.
2. Second pilot: coverage and claims assistant over condicionados, citing clause and page.
3. Integrate with the family brokerage's ERP; treat EIAC files as canonical data.
4. Check the brokerage's EIAC and CIMA status before pitching; if all insurers already
   deliver settlements bidirectionally, the pain moves to non-EIAC insurers and MGAs.
5. Sharpest pitch: "Cerramos las liquidaciones del mes en horas, no en días, y te decimos
   qué comisiones no te han pagado." Revenue recovery beats cost saving at €76k revenue
   per employee.
6. Price €250 to €600 a month plus setup, against €2k to €3k a month of an admin.
7. Networks and colegios, not one by one.
8. Watch ebroker (Xirin, Merlin AI) and MPM (EVIA); win by being deeper on one workflow
   and vendor-agnostic across ERPs.
9. Watch Afori; position for the FECOR and colegio long tail and Spanish settlements.
10. Regulatory copy: DGSFP 2026 to 2028 priorities on AI governance, DEC data quality,
    Article 50 (only if client-facing), DORA exemption. Respect GDPR special categories
    and the EIOPA opinion as the control checklist.
11. Risks: shrinking, price-sensitive segment; no independent ROI data; dependence on one
    family ERP; insurers absorbing parts (GenIA, Mapfre portal), though not broker-side
    reconciliation.
12. Gaps to close in the pilot: hours per month on settlements, receipt chasing and claims
    documents; actual ebroker and segElevia fees; the brokerage's EIAC coverage by insurer.

## Sources

Market and registry: INESE (número de corredores 2025 and 2024; altas 2025; ingresos por
comisiones 2024; Estado Económico-Financiero 2025 and its productivity notes); DGSFP
Informe Estadístico Anual de Mediación 2024; SegurosNews (agentes 50,241; Generalitat;
Galicia; comisiones medias; multirriesgo ICEA; M&A; Espabrok; Club Català); UNESPA 2024;
PymeSeguros and ADECOSE Memoria 2025 and Barómetro 2025; FECOR; E2K; Willis Networks;
Consejo General; Semana del Seguro 2026; Forinvest 2026; Colegio de Madrid jornadas.
Software and connectivity: ebroker (site, Xirin and SELL PRO, pilares 2026, web services,
WhatsApp CRM 360, Kit Digital); MPM (segElevia, EVIA, Analytics, TarifAI, Kit Digital, by
Colegio de Madrid, IMEureka); Codeoscopic Avant2 terms and ERP connection; Mediator
pricing; Rankia ebroker vs Elevia thread; Openfarm comparison; ZOA Suite; Foliume; Lamb
Software; Gecose; Correduidea; CIMA (EIAC 7.1, liquidaciones, siniestros); INESE Füture
and SegurosNews on CIMA; Mapfre, Generali GenIA, Zurich.
Pain and adoption: Ciberfobia; Javadex case; BLB Partner; SegurosNews on communication;
Grupo Aseguranza (AI level, commission invoices, DEC non-filing); Aegon informe mediador;
FECOR and INESE on 2026 competition.
Regulation: RDL 3/2020; Orden ECM/1501/2024; DGSFP priorities 2026 to 2028 (SegurosNews,
INESE, finReg360); ADECOSE on DORA; EIOPA opinion 6 Aug 2025; Augusta Abogados and Ecija on
the AI Act; Legiscope and Atico34 on GDPR; Noticias Jurídicas on Verifactu; Galicia DOG
order; sector collective agreement 2023 to 2026; life5 on Kit Digital.
Entrants: EU-Startups, Fintech Global and General Catalyst on Afori; SegurosIA coverage in
El Español and Community of Insurance; Grupo Aseguranza and Upliora on the insurtech
ecosystem; Comulate, Fintary, Applied Recon, Fulcrum, Outmarket, Harper, Sixfold, Indemn.
