import type { GuidedLab, SampleDataset, StageExplainer } from "../types/rag";

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "novatech-handbook",
    title: "NovaTech Employee Handbook",
    shortLabel: "NovaTech Handbook",
    category: "Corporate Policy",
    description:
      "Specific numbers, tenure thresholds, policy IDs, and sharp exceptions—ideal for testing chunk boundaries and hallucination refusal.",
    defaultQuery:
      "When can a Rapid Response SRE employee take a paid sabbatical, and what form must they file?",
    suggestedQueries: [
      "When can a Rapid Response SRE employee take a paid sabbatical, and what form must they file?",
      "How much is the home office stipend for interns versus full-time employees?",
      "What happens if I submit travel meal receipts 50 days after my trip?",
      "What is NovaTech's international adoption reimbursement cap for employees in Singapore?",
    ],
    content: `NOVATECH SYSTEMS INC. — EMPLOYEE HANDBOOK (2026 EDITION)

Section 1. Home Office & Equipment Stipend (Policy ID: POL-218-A)
All full-time salaried employees receive an initial $1,250 home office setup stipend upon their start date, followed by a $400 hardware refresh allowance every 24 months of continuous employment. Eligible purchases include ergonomic chairs, standing desks, external monitors, and lighting. However, temporary contractors and summer interns are excluded from the $1,250 tier and instead receive a one-time $300 remote workstation grant that does not renew.

Section 2. Paid Time Off & Tenure Sabbaticals (Policy ID: POL-409-B)
Full-time staff accrue 22 days of Paid Time Off (PTO) per calendar year, credited at 1.83 days on the first business day of each month. Unused PTO up to 10 days rolls over into the next year on January 1. After completing 4 consecutive years of employment, any full-time employee qualifies for a 6-week fully paid sabbatical at 100% base salary. Exception for Infrastructure Operations: employees assigned to the Rapid Response SRE rotation may only schedule sabbaticals during the low-traffic freeze window between November 15 and February 28, and must submit Form HR-SAB-19 to their Vice President at least 90 calendar days prior to departure.

Section 3. Business Travel & Expense Reimbursement (Policy ID: POL-704-C)
Employees traveling on approved company business may expense daily meals up to $85 per day within the United States and up to $115 per day for international destinations. Itemized receipts are mandatory for any single line-item expense exceeding $25. Alcoholic beverages are reimbursable only during client-hosted dinners pre-approved by a Director. All expense reports must be filed in the LedgerFlow portal within 45 calendar days of the trip return date; any receipts submitted after the 45-day deadline are automatically forfeited without exception.

Section 4. Core Hours & Hybrid Attendance (Policy ID: POL-512-D)
NovaTech operates on a Tuesday-through-Thursday anchor schedule for employees living within 35 miles of the Austin or Seattle hubs. Core collaboration hours are 10:00 AM to 3:00 PM local hub time. Employees who relocate more than 35 miles away must obtain written Remote Designation Approval (Form HR-REM-04) 30 days before moving, which adjusts base compensation according to regional market tiers.`,
  },
  {
    id: "solaris-rover",
    title: "Solaris-9 Mars Rover Technical Manual",
    shortLabel: "Solaris-9 Manual",
    category: "Aerospace Engineering",
    description:
      "Jargon-dense subsystem manual with obscure fault codes—built for comparing Semantic Vector Search against BM25 keyword matching.",
    defaultQuery:
      "How does the rover cool down its onboard computer when it gets too hot?",
    suggestedQueries: [
      "How does the rover cool down its onboard computer when it gets too hot?",
      "What procedure does fault code ERR-77X-THERM trigger?",
      "At what slope angle and wheel slippage does ERR-14M-BOGIE activate?",
      "How fast can the high-gain dish transmit data to the orbiter?",
    ],
    content: `SOLARIS-9 AUTONOMOUS MARS ROVER — FLIGHT OPERATIONS MANUAL (REV 4.2)

Chapter 1. Thermal Control & Radiative Dissipation Subsystem
During Jezero Crater perihelion noon cycles, external ambient temperatures reach +18°C while the dual-core radiation-hardened avionics bus generates 145W of continuous waste heat. To prevent silicon junction degradation when internal avionics temperatures exceed +52°C, the flight computer opens the gold-plated radiative louver vanes along the aft chassis deck, venting surplus thermal energy directly into the thin Martian atmosphere. If junction sensors still climb past +64°C, fault code ERR-77X-THERM fires immediately: the rover actuates its secondary phase-change paraffin heatsink reservoir, throttles scientific spectrometer clocks by 60%, and places the mast panoramic camera into low-power hibernation for exactly 45 minutes.

Chapter 2. Rocker-Bogie Mobility & Regolith Traction Control
The Solaris-9 chassis rides on six machined titanium wheels driven by independent brushless DC hub actuators rated at 38W peak load per axle. An inertial measurement unit continuously monitors pitch, roll, and visual odometry drift against commanded wheel rotations. Whenever measured wheel-slip exceeds 32% on unconsolidated dust slopes steeper than 19 degrees, the traction controller raises fault code ERR-14M-BOGIE. Upon triggering ERR-14M-BOGIE, the rover halts forward propulsion within 0.4 seconds, executes a 15-degree reverse crab-steer maneuver, and requests a revised terrain path from Mission Control.

Chapter 3. Deep Space Relay & Ka-Band Telemetry (Unit COM-X9-KA)
Primary science payloads downlink through the 0.8-meter steerable Ka-band parabolic dish operating at 32.4 GHz. Rather than transmitting directly to Earth at low bitrates, Solaris-9 schedules burst relays through the Mars Reconnaissance Orbiter overhead pass window occurring every 11.4 hours. Sustained relay throughput peaks at 2.4 Mbps for 14 minutes per pass. If the parabolic gimbal encoder reports fault ERR-91C-GIMBAL, the spacecraft automatically falls back to its omnidirectional X-band helical antenna at a reduced emergency rate of 16 kbps.

Chapter 4. Multi-Mission Power Bus & Night Survival
Electrical power originates from a Multi-Mission Radioisotope Thermoelectric Generator (MMRTG) supplying a steady 110W baseline augmented by two lithium-ion buffer packs totaling 42 Ah. During Martian nights when ambient temperatures plunge to -92°C, waste thermal output from the MMRTG is circulated through CFC-11 fluid loops around the battery enclosure to keep cell temperatures strictly above -20°C.`,
  },
  {
    id: "legal-contract",
    title: "Tiny Legal Contract Excerpt",
    shortLabel: "SaaS Legal Excerpt",
    category: "Commercial Law",
    description:
      "Dense clauses with cross-references and liability exceptions—ideal for seeing why Sentence-Aware chunking and Overlap matter.",
    defaultQuery:
      "What is the maximum liability cap, and which claims are excluded from that cap?",
    suggestedQueries: [
      "What is the maximum liability cap, and which claims are excluded from that cap?",
      "How much notice and fee are required if the Customer terminates early for convenience?",
      "How long does a party have to fix a material breach after receiving written notice?",
      "Who owns Custom Deliverables once all invoices are paid?",
    ],
    content: `MASTER SOFTWARE SUBSCRIPTION AGREEMENT — SELECTED CLAUSES

Section 3.1 Intellectual Property and Deliverables.
(a) Provider retains all right, title, and interest in and to the Cloud Platform, underlying algorithms, telemetry schemas, and all improvements thereto, whether or not suggested by Customer.
(b) Subject to Section 3.1(a) and conditional upon Customer's full payment of all undisputed fees set forth in the applicable Order Form, Provider hereby assigns to Customer all intellectual property rights in any bespoke integration scripts explicitly designated as "Custom Deliverables" in a signed Statement of Work.

Section 4.2 Limitation of Liability and Super-Cap Exceptions.
(a) Except as expressly provided in Section 4.2(b), in no event shall either party's aggregate cumulative liability arising out of or related to this Agreement, whether in contract, tort, or strict liability, exceed the total subscription fees actually paid or payable by Customer to Provider during the twelve (12) months immediately preceding the first event giving rise to such liability.
(b) Notwithstanding Section 4.2(a), the foregoing liability cap shall NOT apply to: (i) a party's breach of its confidentiality obligations under Section 5; (ii) Provider's third-party intellectual property indemnification duties; or (iii) damages resulting from gross negligence, willful misconduct, or unauthorized commercial resale of the Platform. For breaches of Section 5 involving personal data, a heightened super-cap equal to three times (3x) the twelve-month fee amount shall apply.

Section 5. Confidentiality Obligations.
"Confidential Information" means any non-public technical architecture, pricing schedule, customer dataset, or security audit report disclosed by one party to the other. The receiving party shall protect Confidential Information using at least the same degree of care it uses for its own sensitive records, and never less than reasonable care, for a survival period of five (5) years following expiration or termination of this Agreement.

Section 6. Term, Cure Period, and Early Termination.
This Agreement commences on the Effective Date for an initial term of twenty-four (24) months. Either party may terminate for cause if the other party commits a material breach and fails to cure such breach within thirty (30) calendar days after receiving detailed written notice specifying the breach. Customer may alternatively terminate for convenience prior to the end of the initial term upon delivering at least fifteen (15) days prior written notice and paying an early termination fee equal to twenty-five percent (25%) of the remaining unbilled subscription fees for the balance of the term.`,
  },
];

export const GUIDED_LABS: GuidedLab[] = [
  {
    id: "synonym-trap",
    title: "1. The Synonym Trap",
    subtitle: "BM25 keyword search fails while Dense Vector search understands meaning",
    datasetId: "solaris-rover",
    query: "How does the rover cool down its onboard computer when it gets too hot?",
    strategy: "recursive",
    chunkSize: 480,
    chunkOverlap: 60,
    searchMethod: "bm25",
    topK: 3,
    minThreshold: 0.15,
    enableHyde: false,
    enableRerank: false,
    compareNoRag: false,
    targetStage: 3,
    whatToWatch:
      'The manual never uses the words "cool down", "onboard computer", or "too hot"—it writes "radiative louver vanes", "avionics", and "+52°C". Start in BM25 mode and watch keyword scoring miss or score poorly, then click "Dense Vector / Cosine" to see semantic embeddings locate Chapter 1 immediately.',
    nextStepHint:
      'Switch Search Method from "Sparse Keyword / BM25" to "Dense Vector / Cosine" in Stage 3—or toggle HyDE in Stage 4 to bridge the vocabulary gap.',
  },
  {
    id: "exact-id-lookup",
    title: "2. Exact ID Lookup",
    subtitle: "BM25 nails obscure fault codes where pure vectors blur—Hybrid RRF wins",
    datasetId: "solaris-rover",
    query: "What procedure does fault code ERR-77X-THERM trigger?",
    strategy: "recursive",
    chunkSize: 460,
    chunkOverlap: 60,
    searchMethod: "hybrid",
    topK: 3,
    minThreshold: 0.1,
    enableHyde: false,
    enableRerank: false,
    compareNoRag: false,
    targetStage: 3,
    whatToWatch:
      'Opaque identifiers like "ERR-77X-THERM" rarely carry rich meaning in dense embedding space, so pure cosine similarity can rank neighboring fault chapters close together. Inspect the BM25 IDF math tooltip vs. Dense rank, and see how Hybrid RRF fuses both signals to put the exact chunk at #1.',
    nextStepHint:
      'Toggle between Dense, BM25, and Hybrid RRF in Stage 3 and hover the math tooltip on Chunk 1 to compare exact term IDF against cosine similarity.',
  },
  {
    id: "bad-chunking",
    title: "3. The Bad Chunking Demo",
    subtitle: "Tiny 100-char chunks with 0 overlap slice a critical policy exception in half",
    datasetId: "novatech-handbook",
    query:
      "When can a Rapid Response SRE employee take a paid sabbatical, and what form must they file?",
    strategy: "fixed",
    chunkSize: 100,
    chunkOverlap: 0,
    searchMethod: "dense",
    topK: 2,
    minThreshold: 0.1,
    enableHyde: false,
    enableRerank: false,
    compareNoRag: false,
    targetStage: 1,
    whatToWatch:
      "Look at the highlighted document in Stage 1: a 100-character fixed window with 0 overlap chops right through Section 2's sabbatical window dates and Form HR-SAB-19! Run the pipeline to see the fragmented answer, then raise Chunk Size to 450 and Overlap to 80 to watch the intact context restore accuracy.",
    nextStepHint:
      'Run the full pipeline first to witness the broken retrieval, then drag Chunk Size to ~450 chars and Overlap to ~80 chars in Stage 1 and re-run.',
  },
  {
    id: "hallucination-stress",
    title: "4. Hallucination Stress Test",
    subtitle: "Ask a question absent from the document—compare No-RAG guessing vs. RAG refusal",
    datasetId: "novatech-handbook",
    query:
      "What is NovaTech's 2026 international adoption reimbursement cap for employees based in Singapore?",
    strategy: "recursive",
    chunkSize: 450,
    chunkOverlap: 70,
    searchMethod: "hybrid",
    topK: 3,
    minThreshold: 0.35,
    enableHyde: false,
    enableRerank: false,
    compareNoRag: true,
    targetStage: 6,
    whatToWatch:
      "The NovaTech Handbook says nothing about international adoption or Singapore offices. Watch the Similarity Threshold filter out irrelevant chunks (or pass weak matches), then compare the Standard LLM (left) against the RAG-Grounded Answer (right) and the Faithfulness Meter's Safe Refusal verdict.",
    nextStepHint:
      'Click "Run Full Pipeline" to inspect the side-by-side No-RAG vs. RAG response and claim-level grounding audit in Stage 6.',
  },
];

export const STAGE_EXPLAINERS: Record<number, StageExplainer> = {
  1: {
    stage: 1,
    title: "Why do we split documents into overlapping chunks?",
    intuition:
      "LLMs have finite context windows, and embeddings represent an entire text passage as a single point in space. If a chunk is too large, its vector averages too many topics into a blurry midpoint; if it is too small, facts get severed from their conditions or exceptions. Overlap acts as glue so sentences crossing a boundary remain intact in at least one chunk.",
    formulaLabel: "Token & Boundary Geometry",
    formula: "Chunk_i = Doc[ start_i : start_i + size ],  where  start_{i+1} = end_i - overlap",
    failureModes: [
      "Too small + zero overlap: slices numbers or exceptions away from the rule they modify.",
      "Too large: dilutes embedding precision and wastes context tokens on irrelevant paragraphs.",
      "Fixed-character cuts mid-word or mid-clause, hurting both BM25 tokenization and semantics.",
    ],
  },
  2: {
    stage: 2,
    title: "How do embeddings turn text into geometry?",
    intuition:
      "An embedding model maps text into a high-dimensional coordinate vector (hundreds to thousands of numbers) where passages with similar meaning land close together—even if they share zero exact words. Since humans cannot visualize 3,072 dimensions, we use Principal Component Analysis (PCA) to project the vectors onto the 2 directions of maximum variance.",
    formulaLabel: "PCA 2D Projection & Task-Typed Vectors",
    formula: "v = Embed(text, taskType ∈ {RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY})   →   z_2D = [ (v - μ)·u₁ , (v - μ)·u₂ ]",
    failureModes: [
      "Using mismatched embedding models for documents vs. queries breaks the shared vector space.",
      "2D PCA discards lower-variance dimensions—two chunks that look close in 2D may be farther apart in full high-D space (always trust the exact cosine score!).",
      "Re-embedding unchanged chunks on every run wastes API quota; content-hashed caching prevents redundant calls.",
    ],
  },
  3: {
    stage: 3,
    title: "Dense Cosine vs. Sparse BM25 vs. Hybrid RRF",
    intuition:
      "Dense Vector Search measures the angle between embeddings (great for synonyms and paraphrased intent). Sparse BM25 scores exact term frequency weighted by rarity across the corpus (great for product SKUs, legal citations, and error codes). Hybrid Search fuses both ranked lists using Reciprocal Rank Fusion (RRF) so you get semantic recall without losing exact-match precision.",
    formulaLabel: "Cosine Similarity, BM25 & Reciprocal Rank Fusion",
    formula: "cos(q,d) = (q·d)/(‖q‖‖d‖)   |   RRF(d) = 1/(60 + rank_dense(d)) + 1/(60 + rank_bm25(d))",
    failureModes: [
      "Pure BM25 misses paraphrases ('cool down' vs. 'radiative dissipation').",
      "Pure Dense vectors struggle with rare exact IDs ('ERR-77X-THERM' or 'POL-409-B').",
      "Setting Similarity Threshold too low floods the prompt with noise; too high drops the true answer.",
    ],
  },
  4: {
    stage: 4,
    title: "How HyDE and LLM Reranking rescue hard queries",
    intuition:
      "Short user questions look structurally different from long technical answers. HyDE (Hypothetical Document Embeddings) asks an LLM to draft an imaginary answer first, then embeds that passage so it lands closer to real manual text. Reranking takes the fast initial Top-K candidates and reads each (Query, Chunk) pair jointly with an LLM to re-score true relevance on a 0–10 scale.",
    formulaLabel: "Two-Stage Retrieve-then-Rerank",
    formula: "v_query* = Embed( LLM_HyDE(q) )   →   Top-K Candidates   →   Score_rerank(q, c_i) ∈ [0, 10]",
    failureModes: [
      "HyDE can drift if the LLM hallucinates wrong terminology or invents false error codes.",
      "Reranking adds one extra LLM call of latency—production systems apply it only to the top 5–20 candidates, never the whole corpus.",
      "Reranking cannot rescue a relevant chunk that was already dropped in Stage 3 (garbage in, garbage out).",
    ],
  },
  5: {
    stage: 5,
    title: "What does the LLM actually see inside its prompt?",
    intuition:
      "There is no magic database wire plugged into the LLM—RAG literally constructs a plain text prompt containing strict grounding rules (System Instructions), the winning text chunks labeled [Chunk #] (Injected Context), and the user's question. Everything the model knows about your document must fit cleanly inside this single context window.",
    formulaLabel: "Augmented Prompt Assembly",
    formula: "Prompt = SystemRules ⊕ Concat( [Chunk_i] text_i for i ∈ TopK ) ⊕ UserQuery",
    failureModes: [
      "Lost in the Middle: LLMs pay less attention to facts buried in the middle of huge context blocks.",
      "Weak system prompts let the model blend outside pre-training memory into private policy answers.",
      "Omitting explicit [Chunk #] tags makes inline citation verification impossible.",
    ],
  },
  6: {
    stage: 6,
    title: "Grounded generation, inline citations & faithfulness checks",
    intuition:
      "Comparing a standard ungrounded LLM against the RAG-grounded answer proves why retrieval matters: without context, LLMs guess plausibly from pre-training averages. With strict grounding rules and retrieved chunks, the model cites verifiable [Chunk #] evidence—or safely refuses when the document lacks an answer. A Faithfulness Auditor then checks every claim against the cited chunks.",
    formulaLabel: "Faithfulness Score",
    formula: "Faithfulness = (Supported Claims / Total Atomic Claims) × 100%",
    failureModes: [
      "Citation hallucination: citing [Chunk 2] for a number that actually came from pre-training memory.",
      "Over-extrapolation: combining two chunks to imply a rule or date the document never stated.",
      "Under-refusal: answering out-of-scope questions instead of explicitly stating the context lacks the answer.",
    ],
  },
};
