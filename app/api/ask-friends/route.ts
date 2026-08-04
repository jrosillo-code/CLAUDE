import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// "Ask your friends" — AI narrative layer. The client already computed the
// evidence (friends' pins, ratings, Top-5 ranks, trips) from the trust graph;
// with ANTHROPIC_API_KEY set, Claude turns that evidence into a warm, direct
// answer. The facts must all come from the evidence — the model adds voice,
// not knowledge. Without a key the client's deterministic answer stands.

export const maxDuration = 30;

interface EvidencePin {
  friend: string;
  place: string;
  country: string;
  title: string;
  note: string;
  rating: number | null;
  topFiveRank: number | null;
  likes: number;
}

interface EvidenceTrip {
  friend: string;
  title: string;
  stops: string[];
}

interface EvidenceQuote {
  friend: string;
  question: string;
  answer: string;
  scale: string | null;
  about: string;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ source: "none" });
  }

  let body: {
    question?: string;
    pins?: EvidencePin[];
    trips?: EvidenceTrip[];
    quotes?: EvidenceQuote[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const question = (body.question ?? "").slice(0, 300).trim();
  const pins = (body.pins ?? []).slice(0, 10);
  const trips = (body.trips ?? []).slice(0, 4);
  const quotes = (body.quotes ?? []).slice(0, 6);
  if (!question || (pins.length === 0 && trips.length === 0 && quotes.length === 0)) {
    return NextResponse.json({ source: "none" });
  }

  const pinLines = pins.map(
    (p) =>
      `- ${p.friend} @ ${p.place} (${p.country})` +
      (p.rating != null ? `, rated ${p.rating}/10` : "") +
      (p.topFiveRank != null ? `, #${p.topFiveRank} in their Top 5` : "") +
      (p.note ? ` — "${p.note}"` : ""),
  );
  const tripLines = trips.map(
    (t) => `- ${t.friend}'s trip "${t.title}": ${t.stops.join(" → ")}`,
  );
  const quoteLines = quotes.map(
    (q) =>
      `- ${q.friend}, asked "${q.question}" about ${q.about}` +
      (q.scale ? ` [answered: ${q.scale}]` : "") +
      `: "${q.answer}"`,
  );

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      system:
        "You answer a traveler's question using ONLY their friends' real travel records, provided below. " +
        "Write 2-4 conversational sentences, mentioning friends by first name with their actual ratings and quotes. " +
        "Debrief answers are the friends' exact words: when you use one, quote it verbatim inside quotation " +
        "marks with the friend's name — never reword it or present a paraphrase as something they said. " +
        "Never invent places, opinions or facts beyond the evidence. If the evidence only partly answers the " +
        "question, say so plainly. No markdown, no lists — just the answer.",
      messages: [
        {
          role: "user",
          content:
            `Question: ${question}\n\nFriends' pins:\n${pinLines.join("\n") || "(none)"}\n\n` +
            `Friends' planned trips:\n${tripLines.join("\n") || "(none)"}\n\n` +
            `Friends' post-trip debrief answers (verbatim):\n${quoteLines.join("\n") || "(none)"}`,
        },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) return NextResponse.json({ source: "none" });
    return NextResponse.json({ source: "ai", answer: text });
  } catch (err) {
    console.error("ask-friends: Claude call failed", err);
    return NextResponse.json({ source: "none" });
  }
}
