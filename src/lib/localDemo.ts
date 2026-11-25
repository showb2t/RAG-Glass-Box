import type { DocumentChunk, FaithfulnessClaim, FaithfulnessReport } from "../types/rag";
import { tokenizeForBm25 } from "./retrieval";

const DEMO_DIMENSIONS = 64;

/**
 * Semantic concept clusters mapped to fixed vector dimensions (0..15) so that
 * Local Demo Mode faithfully reproduces semantic similarity (e.g., Synonym Trap:
 * "cool down / onboard computer / too hot" aligns with "radiative louver / avionics / +52°C")
 * while keeping exact error codes dependent on lexical BM25 + Hybrid RRF.
 */
const CONCEPT_CLUSTERS: { dim: number; terms: string[] }[] = [
  {
    dim: 0,
    terms: [
      "cool", "cooling", "heat", "hot", "thermal", "temperature", "temperatures",
      "radiative", "louver", "vanes", "dissipation", "heatsink", "paraffin",
      "venting", "vent", "overheat", "overheating", "52", "64", "18", "145w",
      "degradation", "thermoelectric",
    ],
  },
  {
    dim: 1,
    terms: [
      "computer", "onboard", "avionics", "processor", "silicon", "junction",
      "flight", "bus", "dual-core", "spectrometer", "clocks", "throttles",
      "hibernation", "mast", "camera",
    ],
  },
  {
    dim: 2,
    terms: [
      "wheel", "wheels", "traction", "slope", "slopes", "regolith", "dust",
      "slip", "slippage", "chassis", "rocker", "bogie", "titanium", "axle",
      "propulsion", "terrain", "mobility", "crab", "steer", "odometry",
    ],
  },
  {
    dim: 3,
    terms: [
      "dish", "antenna", "transmit", "transmission", "downlink", "relay",
      "orbiter", "ka-band", "x-band", "ghz", "mbps", "kbps", "telemetry",
      "communications", "parabolic", "gimbal", "pass", "window", "throughput",
    ],
  },
  {
    dim: 4,
    terms: [
      "power", "battery", "batteries", "mmrtg", "electrical", "night", "nights",
      "cold", "freeze", "survival", "lithium", "fluid", "loops", "110w", "92",
    ],
  },
  {
    dim: 5,
    terms: [
      "fault", "error", "code", "procedure", "trigger", "triggers", "fires",
      "raises", "automatic", "fallback", "emergency", "actuates", "halts",
    ],
  },
  {
    dim: 6,
    terms: [
      "stipend", "equipment", "desk", "chair", "monitor", "hardware", "refresh",
      "office", "home", "workstation", "grant", "1250", "400", "300", "interns",
      "contractors", "ergonomic", "setup",
    ],
  },
  {
    dim: 7,
    terms: [
      "sabbatical", "pto", "vacation", "leave", "time", "off", "tenure", "years",
      "sre", "rapid", "response", "rotation", "november", "february", "freeze",
      "form", "file", "submit", "90", "weeks", "accrue", "rollover",
    ],
  },
  {
    dim: 8,
    terms: [
      "travel", "expense", "expenses", "meal", "meals", "receipt", "receipts",
      "reimbursement", "reimbursable", "dinner", "forfeited", "deadline", "45",
      "85", "115", "25", "ledgerflow", "alcoholic",
    ],
  },
  {
    dim: 9,
    terms: [
      "hybrid", "attendance", "anchor", "tuesday", "thursday", "core", "hours",
      "austin", "seattle", "relocate", "remote", "miles", "35", "compensation",
    ],
  },
  {
    dim: 10,
    terms: [
      "intellectual", "property", "ip", "deliverables", "custom", "ownership",
      "owns", "assigns", "scripts", "integration", "platform", "algorithms",
      "invoices", "paid", "sow", "statement",
    ],
  },
  {
    dim: 11,
    terms: [
      "liability", "cap", "maximum", "super-cap", "excluded", "exceptions",
      "indemnification", "negligence", "misconduct", "twelve", "12", "3x",
      "damages", "fees", "aggregate", "cumulative",
    ],
  },
  {
    dim: 12,
    terms: [
      "confidential", "confidentiality", "information", "secret", "non-public",
      "audit", "pricing", "survival", "five", "5", "protect", "personal", "data",
    ],
  },
  {
    dim: 13,
    terms: [
      "terminate", "termination", "breach", "cure", "period", "notice", "convenience",
      "early", "fee", "twenty-five", "25", "thirty", "30", "fifteen", "15", "term",
      "twenty-four", "24", "material",
    ],
  },
  {
    dim: 14,
    terms: [
      "adoption", "parental", "singapore", "iguana", "pet", "zurich", "mortgage",
      "dental", "tuition", "visa", "relocation-bonus",
    ],
  },
  {
    dim: 15,
    terms: [
      "rover", "mars", "solaris", "spacecraft", "jezero", "crater", "martian",
      "mission", "control",
    ],
  },
];

function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedTextLocal(text: string): number[] {
  const vec = new Float64Array(DEMO_DIMENSIONS);
  const lowered = text.toLowerCase();
  const words: string[] = lowered.match(/[a-z0-9]+/g) ?? [];

  // 1. Semantic concept subspace (dims 0..15)
  for (const cluster of CONCEPT_CLUSTERS) {
    let hits = 0;
    for (const term of cluster.terms) {
      if (words.includes(term) || (term.length >= 4 && lowered.includes(term))) {
        hits += 1;
      }
    }
    if (hits > 0) {
      vec[cluster.dim] += Math.log1p(hits) * 2.4;
    }
  }

  // 2. Word & character 3-gram hashed subspace (dims 16..63)
  const lexicalTokens = tokenizeForBm25(text);
  for (const tok of lexicalTokens) {
    // Opaque ID codes get lighter weight in dense local embedding so BM25 contrast is authentic
    const isCode = /^[a-z]{2,4}-[a-z0-9]+-[a-z0-9]+$/i.test(tok);
    const weight = isCode ? 0.35 : 0.75;
    const h1 = fnv1aHash(tok);
    const dim = 16 + (h1 % (DEMO_DIMENSIONS - 16));
    const sign = (h1 & 1) === 0 ? 1 : -1;
    vec[dim] += sign * weight;

    // Character trigrams for morphological similarity
    if (!isCode && tok.length >= 4) {
      for (let i = 0; i <= tok.length - 3; i++) {
        const tri = tok.slice(i, i + 3);
        const ht = fnv1aHash(`tri:${tri}`);
        const tDim = 16 + (ht % (DEMO_DIMENSIONS - 16));
        const tSign = (ht & 1) === 0 ? 1 : -1;
        vec[tDim] += tSign * 0.16;
      }
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < DEMO_DIMENSIONS; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  const out: number[] = new Array(DEMO_DIMENSIONS);
  for (let i = 0; i < DEMO_DIMENSIONS; i++) {
    out[i] = norm > 1e-9 ? Number((vec[i] / norm).toFixed(5)) : 0;
  }
  return out;
}

export function embedBatchLocal(texts: string[]): number[][] {
  return texts.map((t) => embedTextLocal(t));
}

export function rewriteQueryLocal(query: string, mode: "hyde" | "expand"): string {
  const q = query.toLowerCase();

  if (mode === "hyde") {
    if (q.includes("cool") || q.includes("hot") || q.includes("computer")) {
      return "When internal avionics processor temperatures climb above nominal operating thresholds, the spacecraft thermal control subsystem vents excess waste heat using radiative dissipation louver vanes and actuates a secondary phase-change heatsink reservoir.";
    }
    if (q.includes("sabbatical") || q.includes("sre")) {
      return "Eligible full-time employees who meet consecutive tenure requirements qualify for a paid sabbatical, while Rapid Response SRE rotation staff must book during the designated low-traffic freeze window and submit the required HR sabbatical approval form ahead of departure.";
    }
    if (q.includes("liability") || q.includes("cap")) {
      return "Aggregate cumulative liability under the agreement is capped at twelve months of subscription fees paid, except for confidentiality breaches, third-party IP indemnification, gross negligence, and heightened personal data super-caps.";
    }
    return `Technical and policy documentation passage directly addressing "${query}": specifies exact numeric thresholds, eligibility criteria, formal procedure codes, and governing exceptions.`;
  }

  // Expand mode
  const expansions: string[] = [];
  if (q.includes("cool") || q.includes("hot")) {
    expansions.push("thermal dissipation radiative louver vanes waste heat avionics temperature");
  }
  if (q.includes("computer")) {
    expansions.push("avionics bus flight computer silicon junction");
  }
  if (q.includes("sabbatical")) {
    expansions.push("paid leave tenure freeze window Form HR-SAB-19 SRE rotation");
  }
  if (q.includes("cap") || q.includes("liability")) {
    expansions.push("limitation of liability super-cap exceptions indemnification 12 months");
  }
  return expansions.length > 0
    ? `${query} — related terms: ${expansions.join("; ")}`
    : `${query} (synonyms: policy rules, thresholds, exceptions, technical procedures)`;
}

export function rerankCandidatesLocal(
  query: string,
  candidates: { id: number; text: string }[]
): { id: number; score: number; reason: string }[] {
  const qVec = embedTextLocal(query);
  const qTokens = tokenizeForBm25(query);
  const qCodes = qTokens.filter((t) => t.includes("-"));

  return candidates.map((c) => {
    const cVec = embedTextLocal(c.text);
    let dot = 0;
    for (let i = 0; i < qVec.length; i++) dot += qVec[i] * cVec[i];

    const cLower = c.text.toLowerCase();
    const matchedTerms = qTokens.filter((t) => cLower.includes(t));
    const exactCodeMatch = qCodes.some((code) => cLower.includes(code));

    let rawScore = Math.max(0, dot) * 7.2 + Math.min(2.8, (matchedTerms.length / Math.max(1, qTokens.length)) * 3.2);
    if (exactCodeMatch) rawScore = Math.min(9.9, rawScore + 2.8);
    // Penalize ultra-short fragmented chunks (< 120 chars) that likely cut off facts
    if (c.text.length < 120) rawScore *= 0.72;

    const score = Number(Math.max(0.4, Math.min(9.9, rawScore)).toFixed(1));
    let reason = "Partial topical overlap with the query.";
    if (exactCodeMatch) {
      reason = `Contains the exact identifier (${qCodes.join(", ")}) and directly specifies the associated procedure.`;
    } else if (score >= 7.5) {
      reason = "Directly addresses the core concepts and specific conditions asked in the query.";
    } else if (score >= 4.5) {
      reason = "Related section in the document, but lacks complete details for the specific question.";
    } else {
      reason = "Covers a different policy or subsystem unrelated to the user's question.";
    }

    return { id: c.id, score, reason };
  });
}

export function generateAnswerLocal(
  query: string,
  retrievedChunks: DocumentChunk[],
  compareNoRag: boolean
): { ragAnswer: string; noRagAnswer: string | null } {
  const qLower = query.toLowerCase();
  const qTokens = tokenizeForBm25(query);
  const qVec = embedTextLocal(query);

  // Check if retrieved chunks actually support the query
  let bestRelevance = 0;
  const scoredSentences: { chunkId: number; sentence: string; score: number }[] = [];

  for (const chunk of retrievedChunks) {
    const cVec = embedTextLocal(chunk.text);
    let dot = 0;
    for (let i = 0; i < qVec.length; i++) dot += qVec[i] * cVec[i];
    if (dot > bestRelevance) bestRelevance = dot;

    const sentences = chunk.text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    for (const sent of sentences) {
      const sVec = embedTextLocal(sent);
      let sDot = 0;
      for (let i = 0; i < qVec.length; i++) sDot += qVec[i] * sVec[i];
      const sLower = sent.toLowerCase();
      const termHits = qTokens.filter((t) => sLower.includes(t)).length;
      const codeHit = qTokens.some((t) => t.includes("-") && sLower.includes(t)) ? 0.6 : 0;
      const combined = sDot * 0.7 + (termHits / Math.max(1, qTokens.length)) * 0.5 + codeHit;
      scoredSentences.push({ chunkId: chunk.id, sentence: sent, score: combined });
    }
  }

  // Detect out-of-scope / unanswerable query
  const isOutOfScope =
    retrievedChunks.length === 0 ||
    bestRelevance < 0.22 ||
    (qLower.includes("singapore") && !retrievedChunks.some((c) => c.text.toLowerCase().includes("singapore"))) ||
    (qLower.includes("adoption") && !retrievedChunks.some((c) => c.text.toLowerCase().includes("adoption")));

  let ragAnswer = "";
  if (isOutOfScope) {
    ragAnswer =
      retrievedChunks.length === 0
        ? "I cannot answer this question because no document chunks passed the retrieval similarity threshold. The provided knowledge base does not contain verified evidence for this topic."
        : `I cannot answer this question from the provided context. Although ${retrievedChunks.map((c) => `[Chunk ${c.id}]`).join(", ")} were retrieved, none of them contain information addressing "${query}".`;
  } else {
    scoredSentences.sort((a, b) => b.score - a.score);
    const topSents = scoredSentences.slice(0, 3);
    if (topSents.length === 0) {
      const first = retrievedChunks[0];
      ragAnswer = `Based on the retrieved excerpt: "${first.text.slice(0, 220)}" [Chunk ${first.id}]. Note: because this chunk is very short, surrounding conditions or exceptions may have been cut off during chunking.`;
    } else {
      const parts = topSents.map((item) => `${item.sentence} [Chunk ${item.chunkId}]`);
      ragAnswer = `Based strictly on the retrieved document context: ${parts.join(" ")}`;
    }
  }

  let noRagAnswer: string | null = null;
  if (compareNoRag) {
    if (qLower.includes("adoption") || qLower.includes("singapore")) {
      noRagAnswer =
        "Typically, global technology companies like NovaTech offer an international adoption reimbursement benefit of around $10,000 to $15,000 USD per child (or SGD 15,000 in Singapore) covering agency and legal fees, alongside 12 to 16 weeks of paid parental leave. (Notice: without RAG, a standard LLM guesses plausible corporate norms instead of knowing your document says nothing about this!)";
    } else if (qLower.includes("sabbatical") || qLower.includes("sre")) {
      noRagAnswer =
        "At most software companies, employees become eligible for a 4-week paid sabbatical after 5 years of service, scheduled flexibly with manager approval via the standard HR workday portal. (Notice: without RAG, the model misses NovaTech's 4-year / 6-week rule, the Nov 15–Feb 28 SRE window, and Form HR-SAB-19.)";
    } else if (qLower.includes("err-77x-therm") || qLower.includes("cool")) {
      noRagAnswer =
        "Mars rovers generally rely on passive thermal insulation blankets, louvre radiators, and software duty-cycling to manage avionics temperatures during daytime peaks, entering safe mode if an internal thermal fault code triggers. (Notice: without RAG, the model cannot know the exact +52°C / +64°C thresholds, paraffin heatsink, 60% throttle, or 45-minute mast camera hibernation.)";
    } else {
      noRagAnswer =
        "Without access to your private document, a standard LLM can only offer general industry conventions and plausible estimates rather than the exact clauses, figures, or policy identifiers inside your knowledge base.";
    }
  }

  return { ragAnswer, noRagAnswer };
}

export function evaluateFaithfulnessLocal(
  answer: string,
  chunks: DocumentChunk[]
): FaithfulnessReport {
  const lower = answer.toLowerCase();
  const isRefusal =
    lower.includes("cannot answer") ||
    lower.includes("does not contain") ||
    lower.includes("not provided in the context") ||
    lower.includes("no document chunks");

  if (isRefusal) {
    return {
      overallScore: 100,
      verdict: "safe_refusal",
      summary:
        "The model correctly recognized that the retrieved chunks lacked evidence and safely refused to speculate or hallucinate.",
      claims: [
        {
          claim: "Refused to answer due to insufficient supporting context.",
          status: "refusal",
          citedChunkIds: [],
          explanation: "Matches strict RAG grounding rules—zero unsupported facts introduced.",
        },
      ],
    };
  }

  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)
    .slice(0, 4);

  const claims: FaithfulnessClaim[] = sentences.map((sent) => {
    const citationMatches = Array.from(sent.matchAll(/\[Chunk\s+(\d+)\]/gi)).map((m) =>
      Number(m[1])
    );
    const uniqueCites = Array.from(new Set(citationMatches));
    const citedChunks =
      uniqueCites.length > 0
        ? chunks.filter((c) => uniqueCites.includes(c.id))
        : chunks;

    const sentTokens = tokenizeForBm25(sent.replace(/\[Chunk\s+\d+\]/gi, ""));
    const combinedChunkText = citedChunks.map((c) => c.text.toLowerCase()).join(" ");
    const overlapCount = sentTokens.filter((t) => combinedChunkText.includes(t)).length;
    const ratio = sentTokens.length > 0 ? overlapCount / sentTokens.length : 0;

    if (ratio >= 0.55 && uniqueCites.length > 0) {
      return {
        claim: sent,
        status: "supported",
        citedChunkIds: uniqueCites,
        explanation: `Directly verified against ${uniqueCites.map((id) => `[Chunk ${id}]`).join(", ")} (${Math.round(ratio * 100)}% lexical term alignment).`,
      };
    }
    if (ratio >= 0.3) {
      return {
        claim: sent,
        status: "partial",
        citedChunkIds: uniqueCites,
        explanation: "Partially aligns with retrieved context, though some phrasing or boundary detail may be inferred.",
      };
    }
    return {
      claim: sent,
      status: "unsupported",
      citedChunkIds: uniqueCites,
      explanation: "Key facts in this sentence could not be traced back to the retrieved chunks.",
    };
  });

  const supportedWeight = claims.reduce((sum, c) => {
    if (c.status === "supported" || c.status === "refusal") return sum + 1;
    if (c.status === "partial") return sum + 0.5;
    return sum;
  }, 0);

  const overallScore =
    claims.length > 0 ? Math.round((supportedWeight / claims.length) * 100) : 0;
  const verdict =
    overallScore >= 85
      ? "grounded"
      : overallScore >= 50
      ? "partially_grounded"
      : "hallucinated";

  return {
    overallScore,
    verdict,
    summary:
      verdict === "grounded"
        ? "All extracted claims trace directly back to the cited chunks in the retrieved context."
        : verdict === "partially_grounded"
        ? "Some claims are supported by retrieved chunks, while others are incomplete—often caused by fragmented chunking."
        : "Significant mismatch detected between the generated response and the retrieved evidence.",
    claims,
  };
}
