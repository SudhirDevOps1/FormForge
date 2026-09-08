export type SubmissionIntent = "urgent" | "sales" | "support" | "feedback" | "general";

interface IntentRule {
  intent: SubmissionIntent;
  keywords: string[];
  regex: RegExp;
  weight: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: "urgent",
    keywords: [
      "urgent", "urgently", "emergency", "asap", "broken", "crash", "crashing",
      "outage", "down", "critical", "refund", "locked out", "payment failed",
      "payment failure", "breach", "exploit", "hacked", "security alert"
    ],
    regex: /\b(urgent|urgently|emergency|asap|broken|crash|crashing|outage|down|critical|refund|locked out|payment failed|payment failure|breach|exploit|hacked)\b/i,
    weight: 10,
  },
  {
    intent: "sales",
    keywords: [
      "quote", "pricing", "cost", "demo", "enterprise", "procurement", "contract",
      "proposal", "hire", "budget", "purchase", "buying", "sales", "subscription",
      "tier", "license", "licensing", "partnership", "commercial"
    ],
    regex: /\b(quote|pricing|cost|demo|enterprise|procurement|contract|proposal|hire|budget|purchase|buying|sales|subscription|licens(e|ing)|partnership|commercial)\b/i,
    weight: 8,
  },
  {
    intent: "support",
    keywords: [
      "help", "issue", "bug", "error", "how to", "problem", "assistance",
      "trouble", "glitch", "failing", "not working", "cannot", "doesn't work", "fix"
    ],
    regex: /\b(help|how to|issue|bug|error|problem|trouble|glitch|failing|not working|assistance|cannot|doesn't work|fix)\b/i,
    weight: 6,
  },
  {
    intent: "feedback",
    keywords: [
      "feedback", "suggestion", "suggest", "feature request", "improvement",
      "review", "great job", "kudos", "complaint", "recommend", "would love", "idea"
    ],
    regex: /\b(feedback|suggest(ion)?|feature request|improvement|review|great job|kudos|complaint|recommend|would love|ideas?)\b/i,
    weight: 4,
  },
];

export function classifyIntent(data: Record<string, unknown>): SubmissionIntent {
  if (!data || typeof data !== "object") return "general";

  const textParts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("_") && key !== "_intent") continue;
    textParts.push(key);
    if (typeof value === "string") {
      textParts.push(value);
    } else if (typeof value === "number") {
      textParts.push(String(value));
    }
  }

  const fullText = textParts.join(" ").toLowerCase();

  for (const rule of INTENT_RULES) {
    if (rule.regex.test(fullText)) {
      return rule.intent;
    }
  }

  return "general";
}

export function getIntentMeta(intent?: string): {
  label: string;
  icon: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (intent) {
    case "urgent":
      return {
        label: "Urgent",
        icon: "🚨",
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/30",
      };
    case "sales":
      return {
        label: "Sales Lead",
        icon: "💼",
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/30",
      };
    case "support":
      return {
        label: "Support",
        icon: "🛠️",
        color: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    case "feedback":
      return {
        label: "Feedback",
        icon: "💡",
        color: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/30",
      };
    default:
      return {
        label: "General",
        icon: "💬",
        color: "text-slate-400",
        bg: "bg-slate-800/40",
        border: "border-slate-700/50",
      };
  }
}
