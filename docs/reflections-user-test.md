# Reflections usability test — five participants, ~15 minutes each

## Objective

Learn whether the trust-graph loop works for a new user in practice:
friend evidence → decision → own debrief → visible reward. Specifically,
whether people (a) understand what Waypoint is, (b) believe and use
friends' quotes, (c) can complete the 60-second debrief and choose the
privacy level they intend, and (d) experience the app as one product.

**Not** an opinion survey. Participants get realistic tasks; we observe
completion, hesitation, and misreadings. Never ask "do you like the idea?".

## Setup (before each session)

- Preview deployment with synthetic data (`docs/test-accounts.md`), signed
  in as a fresh synthetic account that is friends with Alice and Leo, whose
  completed trips carry debriefs.
- Fresh browser profile per participant (clears the local event log — the
  facilitator's funnel at `/funnel` then shows only this participant).
- Screen + audio recording with consent; think-aloud requested.
- The guided-start checklist is left ON for participants 1–3, dismissed
  before the session for 4–5 (contrast: do people find things without it?).

## Script (≈15 min)

**0. Framing (1 min).** "This is a travel app using made-up data. I'll ask
you to do a few things. Think out loud. Nothing you do can break it, and
none of it is real."

**1. First impression (2 min).** Open the app, say nothing. After ~30s of
free exploration ask: *"Without tapping anything else — what do you think
this app is for? Whose information are you looking at?"*
→ answers Q1 (comprehension) before any task biases it.

**2. Task: decide with friend evidence (4 min).**
*"You're planning a long weekend on the Portuguese coast. Using anything in
the app, decide: would you include Peniche or skip it? Say why."*
Success: participant finds either Leo's trip-card debrief or the place
card's "What friends said" and cites the skip warning (or knowingly
overrides it). Observe: do they notice the quote's author? Do they check
who said it? *(Q2, Q3)*

**3. Task: ask the graph (2 min).**
*"Find out where your friends surf — without leaving the app."*
Success: uses the search bar's "Ask your friends" and reads the evidence
cards. Observe whether they expect Google-style answers or friend answers.

**4. Task: clone (1 min).**
*"That coast trip of Leo's — make it your own plan."*
Success: Clone trip tapped, draft appears, participant understands the
stops are editable.

**5. Task: the debrief (4 min).**
*"You've just come home from your own trip — the one called 'My sample
trip' in your Trips list. Wrap it up, and make sure only your friends —
not the whole world — can see what you write."*
Start a visible timer at the first question. Success: completes ≤ ~90s of
active answering *(Q6)*, picks **Friends** on the review screen *(Q5)*,
and can then answer: *"Who can read what you just wrote? What would you
pick if you wanted no one to see it?"*
Observe the reward screen: do they read it? Ask: *"In your own words —
what happens with your answers now?"* *(Q4)*

**6. Wrap-up questions (1–2 min).**
- "Walk me back through what you did — did those feel like parts of one
  app, or separate tools?" *(Q7)*
- "Those quotes you saw on Leo's trip — where did they come from?" *(Q2)*
- "If you'd written something embarrassing in your debrief, how would you
  take it back?" (probes discoverability of edit/delete)
- "What's one thing you'd expect to happen that didn't?"

## Behaviors to observe (checklist per participant)

- ☐ Finds friend evidence unprompted vs needs the checklist/hint.
- ☐ Reads quote attribution (names the friend when citing).
- ☐ Distinguishes warning from endorsement on the place card.
- ☐ Uses "Ask your friends" vs tries the geocoder search for questions.
- ☐ Hesitation points in the debrief (which question, how long).
- ☐ Uses Skip when they have nothing to say vs types filler.
- ☐ Anchors an answer to a pin vs leaves "Whole trip".
- ☐ Privacy selector: reads options vs taps through the default.
- ☐ Reads the reward screen vs closes instantly.
- ☐ Debrief active time (target ≤ 90 s).
- ☐ Facilitator funnel (`/funnel`) stages reached by end of session.

## Success / failure criteria

| Question | Success (≥4 of 5 participants) | Failure signal |
|---|---|---|
| Q1 what is Waypoint | Says "friends' travels on a map" or close | "a TripAdvisor", "a photo app" |
| Q2 quote provenance | Attributes quotes to named friends' trips | "reviews", "the app wrote it" |
| Q3 decision help | Cites friend evidence in the Peniche decision | Decides ignoring/never finding evidence |
| Q4 why debrief | Explains friends will see their words as answers | "for my diary", can't say |
| Q5 privacy | Picks Friends when asked; can name Private's effect | Wrong pick, or can't explain who sees it |
| Q6 60-second claim | Active answering ≤ ~90 s median | > 2 min, or abandons |
| Q7 coherence | Describes one app in wrap-up | Names features as unrelated tools |

Global failure regardless of the table: any participant believes the
synthetic people are real, or believes their debrief is private when it
isn't (trust/privacy misunderstandings outrank usability wins).

## After the five sessions

Collate per-question tallies, the funnel screenshots, and the observed
hesitation points into a findings section at the bottom of this file.
Fixes go into the backlog ranked by: privacy misunderstandings first,
task-blocking friction second, polish last.
