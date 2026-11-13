## PILOT PLAN & AI TECH STACK

### Pilot Design: "Think Big, Start Small, Scale Fast"

#### Phase 1 — MVP Pilot (Months 1–3)

**Scope:** First-time homebuyers in 3 metro markets (Raleigh-Durham, Austin, Denver)
**Target:** 500–1,000 customers opted into Haven beta
**Investment:** $150K–$300K build + $5K–$15K/month operations (with 50% contingency buffer: $225K–$450K effective build cost)
**Framework:** LangGraph — recommended for Haven's stateful, multi-step planning workflows. Daily running cost: $12–$18/day in production (~$400–$550/month).

**Core features in MVP:**
1. Life-event onboarding questionnaire (5 minutes, conversational)
2. Room-by-room plan generation with budget allocation (Good/Better/Best tiers)
3. Dimensional awareness — room measurements checked against product dimensions before recommendation
4. Basic delivery coordination with CastleGate logistics
5. Persistent memory across sessions (minimum 90-day retention, extensible)
6. RAG pipeline grounding all recommendations in real product data — no hallucinated products or prices
7. Single-tier human handoff to Wayfair Professional (Tier 4)
8. Return-risk scoring at pre-checkout — flagging items with >25% predicted return probability

**Multi-agent architecture for MVP (2–3 specialized agents):**
- **Orchestrator agent:** Routes queries, manages conversation state, handles life-event classification
- **Room planner agent:** Generates room-by-room plans with product selection, budget allocation, and style coherence scoring
- **Budget optimizer agent:** Constraint-satisfaction solver that allocates budget across rooms, generates Good/Better/Best tiers, and phases purchases over timeline

**What's NOT in MVP:** AR/3D visualization, background price monitoring, military PCS module, full 4-tier handoff, cross-event lifecycle planning, agentic commerce API

#### Phase 2 — Validated Scale (Months 4–6)

**Trigger:** Pilot metrics meet success criteria (>25% revenue lift, >15% return reduction, NPS >50)
**Expansion:** Add nursery/new baby segment; expand to 10 metro markets
**Investment:** Additional $200K–$500K + $15K–$30K/month

**New capabilities in Phase 2:**
- 3D/AR room visualization integration (reduces returns by additional 25–40%)
- Logistics coordination agent (delivery scheduling, assembly service booking, multi-item coordination)
- Notification/monitoring agent (price drops, restocks, life-event milestone reminders)
- Full 4-tier handoff system: AI self-service → AI-assisted visualization → live design consultant → Wayfair Professional
- Expanded RAG corpus to include customer interaction history for improved personalization

#### Phase 3 — Platform (Months 7–12)

**Trigger:** Two segments validated with metrics above targets
**Expansion:** All life-stage segments (divorce/downsizing, military PCS, general movers), nationwide rollout

**New capabilities in Phase 3:**
- **Agentic commerce API layer** — Haven's intelligence exposed via ACP (OpenAI) and UCP (Google) protocols so third-party AI agents can query life-transition recommendations
- Visa Intelligent Commerce integration for automated, tokenized AI agent transactions
- Shopify-compatible agentic commerce endpoint (1M+ merchants already auto-enrolled in Shopify's agentic framework)
- Full behavioral training data flywheel: every Haven interaction improves recommendations for all customers
- Cross-event lifecycle planning (baby → toddler → school-age transitions; first apartment → first home → upgrade)
- Background monitoring at scale (proactive re-engagement based on life-event timeline)

#### Total Year 1 Investment: Under $2M (with contingency: $2.5M–$3M)

Wayfair context: Q3 2026 revenue = $3.4B. Year 1 Haven investment = <0.06% of annual revenue. Average sunk cost of a failed AI project = $2.1M — Haven's phased approach mitigates this by validating at each stage.

---

### AI TECH STACK — Four-Layer Architecture

#### LAYER 1: DATA SOURCING & INGESTION

**Purpose:** Collect, clean, and pipe all data Haven needs into the system.

| Component | Function | Generic Tools/Services |
|---|---|---|
| Customer Data Pipeline | Ingests purchase history, browsing behavior, style preferences, room dimensions | Apache Kafka, AWS Kinesis, Fivetran |
| Product Catalog Sync | Real-time sync with Wayfair's 40M+ SKU database (11M+ specs validated via OpenAI) | Debezium (CDC), REST APIs, GraphQL |
| External Data APIs | Housing market data, demographic trends, seasonal patterns | Zillow API, Census API, weather APIs |
| User Input Capture | Onboarding questionnaire responses, room photos, budget inputs | Custom forms, image upload pipeline |
| Data Quality Layer | Validation, deduplication, schema enforcement | Great Expectations, dbt, Apache Airflow |
| Life-Event Signal Extraction | Infer or capture life-transition triggers from browsing/purchase patterns | Custom ML classifier + explicit user input |
| Return-Reason Taxonomy | Structure historical return data by specific reason (size/color/style/damage) | Custom ETL + dbt transformation |

**Key design decisions:**
- Use Change Data Capture (CDC) for product catalog to ensure Haven always has real-time inventory and pricing — not a stale daily snapshot.
- Prioritize embedding generation for high-volume categories first (living room, bedroom, nursery). 11M of 40M specs validated = 27.5% coverage; target 60%+ within 6 months.
- Build life-event signal extraction into the data layer from Day 1 — this is Haven's data moat.

#### LAYER 2: INFRASTRUCTURE & PLATFORM

**Purpose:** Store, process, and serve data and models at scale.

| Component | Function | Generic Tools/Services |
|---|---|---|
| Cloud Compute | Auto-scaling serverless functions for API endpoints | AWS Lambda, Google Cloud Functions |
| Vector Database | Semantic search across products and customer embeddings | Pinecone, Weaviate, pgvector |
| Relational Database | Customer profiles, plans, transactions, structured data | PostgreSQL, Amazon RDS |
| Memory Store | Session persistence, conversation history, real-time cache — Haven's persistent memory | Redis, Amazon ElastiCache, DynamoDB |
| Object Storage | Room photos, plan exports, asset files | Amazon S3, Google Cloud Storage |
| API Gateway | Rate limiting, auth, routing for internal + external + agentic commerce APIs | AWS API Gateway, Kong |
| Multi-Agent Orchestration | Hierarchical agent coordination, state management, tool routing | LangGraph (recommended: $12–$18/day) |
| Background Job Queue | Proactive monitoring tasks, scheduled alerts, life-event milestone notifications | AWS SQS + Lambda, Celery, Bull |
| Monitoring & Logging | System health, latency tracking, error alerting, agent performance metrics | Datadog, CloudWatch, Sentry |
| Agentic Commerce Endpoints (Phase 3) | ACP/UCP-compatible APIs for third-party agent access | Custom API layer, OAuth 2.0, rate limiting |

**Key design decisions:**
- Separate vector DB (semantic product search) from relational DB (structured customer data) — each scales independently.
- RAG is the dominant enterprise AI pattern (Databricks, Gartner 2025–2026). Haven's RAG pipeline eliminates product hallucination by grounding every recommendation in real catalog data.
- LangGraph selected for orchestration: lowest daily cost ($12–$18 vs. CrewAI $18–$28 vs. AutoGen $25–$40), best fit for stateful multi-step workflows.
- ⚠️ TCO warning: Infrastructure costs are typically underestimated by 40–60%. Budget includes 50% contingency.

#### LAYER 3: ML MODEL LAYER

**Purpose:** The intelligence that powers Haven's planning, recommendation, and prediction capabilities.

| Component | Function | Generic Tools/Services |
|---|---|---|
| Foundation LLM | Conversational planning, style advice, natural language understanding | Claude (Anthropic), GPT-4 (OpenAI), Gemini (Google) |
| RAG Pipeline | Retrieval-Augmented Generation for product knowledge and company policies | LangChain, LlamaIndex, custom embedding pipeline |
| Recommendation Engine | Product matching based on style, budget, room, and life-event context | Hybrid collaborative + content-based filtering |
| Return-Risk Model | Predicts return probability before checkout; flags high-risk items | XGBoost / LightGBM trained on Wayfair return data |
| Budget Optimizer | Allocates total budget across rooms using category benchmarks | Constraint-satisfaction solver (OR-Tools, PuLP) |
| Computer Vision (Phase 2+) | Room scanning, dimension extraction from photos | YOLO, Segment Anything (SAM), custom fine-tune |
| Embedding Model | Converts products and preferences into vector representations | Sentence-BERT, OpenAI Embeddings, Cohere |
| Style Coherence Scorer | Ensures cross-room style consistency across whole-home plans | Custom model trained on designer-curated room sets |

**Key design decisions:**
- Use **deterministic tools** (not the LLM) for all calculations — budget math, dimension checks, delivery scheduling. LLMs hallucinate on arithmetic; deterministic tools don't.
- **Hierarchical multi-agent architecture** (F1=0.921) validated as best-performing topology. Performance gains emerge at 30+ tool integrations — Haven's 4-layer stack provides this.
- ⚠️ Multi-agent caveat: -3.5% average performance degradation vs. single-agent (σ=45.2%) in academic benchmarks. Haven's hierarchical design and phased rollout mitigates this risk through validation at each stage.

#### LAYER 4: APPLICATION LAYER

**Purpose:** The customer-facing interfaces, integrations, and agentic commerce endpoints.

| Component | Function | Generic Tools/Services |
|---|---|---|
| Conversational UI | Natural language chat embedded in Wayfair app/website | Custom React component, WebSocket/SSE streaming |
| Planning Dashboard | Visual room-by-room plan with product cards and budget tracker | React, D3.js, custom UI |
| Notification Engine | Price drop alerts, restock notifications, milestone reminders | Firebase Cloud Messaging, AWS SNS |
| Handoff System | 4-tier escalation: AI → visualization → designer → Wayfair Professional | Custom routing engine + Wayfair Professional CRM |
| Analytics Dashboard | Real-time KPIs: revenue lift, return reduction, plan completion, EBIT impact | Looker, Tableau, custom dashboards |
| A/B Testing Framework | Compare Haven customers vs. control group | LaunchDarkly, Optimizely, custom |
| Agentic Commerce API (Phase 3) | ACP/UCP-compatible endpoint for third-party AI agents | REST/GraphQL API, OAuth 2.0, rate limiting |
| Dual-Mode Interface | Consumer-facing chat + agent-facing API serving same intelligence | Shared recommendation engine, differentiated UX |

**Key design decisions:**
- Embed Haven directly in Wayfair's existing app/website — not as a separate destination. Customers should encounter Haven naturally during their shopping flow.
- Build the agentic commerce API as a separate endpoint sharing Haven's core intelligence — this is how Wayfair stays visible to ChatGPT (900M WAU, 50M shopping queries/day), Google AI Mode, and Alexa+.
- Perplexity AI reports 10.5% conversion from AI-generated shopping recommendations — 5–10x higher than display ads. Haven's agent-facing API captures this traffic.

---

### Architecture Precedents

Haven's architecture draws on validated patterns from three production systems:

1. **Cleo AI** (financial planning companion)
   - $250M ARR, 6M+ users
   - RAG memory pipeline achieving 81% accuracy on financial benchmarks
   - Deterministic tools for calculations + background monitoring
   - Validates: persistent AI companion with domain expertise can reach massive scale

2. **Updater** (moving services platform)
   - Serves 25%+ of US household moves
   - Commerce API integrations for service coordination
   - ~$9,000 average mover spending window captured
   - Validates: life-event-triggered commerce platform can capture high-value wallet

3. **Headspace Ebb** (mental health AI + therapist handoff)
   - 2M+ messages processed
   - 62% of enterprise members use 2+ care modalities
   - Stratified AI → human escalation model
   - Validates: tiered AI-to-human handoff works at scale and increases engagement

### Cost Model

| Item | MVP (Mo 1–3) | Scale (Mo 4–6) | Platform (Mo 7–12) |
|---|---|---|---|
| Engineering (build) | $150K–$300K | $200K–$500K | $500K–$1M |
| LLM API costs | $3K–$10K/mo | $10K–$25K/mo | $25K–$50K/mo |
| Infrastructure | $2K–$5K/mo | $5K–$15K/mo | $15K–$30K/mo |
| Multi-agent orchestration | $400–$550/mo (LangGraph) | $1K–$2K/mo | $3K–$5K/mo |
| Data pipeline | Included | $3K–$8K/mo | $8K–$15K/mo |
| **Year 1 Total** | | | **$1.2M–$2M** |

**With 50% contingency buffer (accounting for 40–60% TCO underestimation):** $1.8M–$3M Year 1 total
**Wayfair annual revenue context:** ~$13.6B → Haven = 0.01–0.02% of revenue

### Agentic Commerce Integration Requirements (Phase 3)

Haven's Phase 3 must ensure compatibility with the emerging agentic commerce ecosystem:

| Protocol/Platform | Integration Requirement | Business Value |
|---|---|---|
| OpenAI ACP | REST API endpoint accepting ACP-formatted product queries; return structured product recommendations with life-event context | Access to 50M+ daily shopping queries via ChatGPT |
| Google UCP | UCP-compatible product feed with semantic metadata; integration with Google AI Mode | Visibility in Google's AI shopping results |
| Meta Muse | Continued partnership API; Haven recommendations surfaced in Muse suggestions | Access to 11M+ Muse users; 25% conversion rate |
| Visa Intelligent Commerce | Tokenized payment flow for AI agent-initiated transactions | Secure, automated purchasing by AI agents |
| Shopify Ecosystem | API compatibility with Shopify's agentic commerce framework | Interoperability with 1M+ auto-enrolled merchants |
| Perplexity / AI Search | Structured product data optimized for AI search retrieval | 10.5% conversion from AI search recommendations |

**Strategic imperative:** If Haven's intelligence is not accessible via these protocols, Wayfair becomes invisible to the fastest-growing commerce channel. AI-referred traffic is already up 393% YoY. By 2028, Bain estimates AI agents will influence 15–25% of all e-commerce transactions.
