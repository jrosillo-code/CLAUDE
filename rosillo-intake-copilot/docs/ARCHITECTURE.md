# Architecture — Rosillo Intake Copilot

## Component architecture

```mermaid
flowchart LR
    subgraph Browser["Navegador (empleado)"]
        UI["React UI (Spanish-first)\nsin claves, sin botón de envío"]
    end

    subgraph Web["apps/web — Next.js (server)"]
        AUTH["lib/auth.ts\ncookie HMAC + RBAC"]
        ACTIONS["Server actions\nanalizar · decidir · asignar\n(rate limit + logging)"]
        PAGES["Server components\ninbox · caso · evaluación · admin"]
        HEALTH["/api/health · /api/ready"]
    end

    subgraph Domain["packages/domain"]
        PIPE["Pipeline (8 etapas)\nvalidación Zod + reparación\ntimeout + estado de error seguro"]
        RULES["Reglas deterministas\nmissing-info (rules-v1)"]
        MATCH["Búsqueda determinista\nde candidatos"]
        CAT["Catálogo de acciones\npor workflow"]
    end

    subgraph AI["packages/ai"]
        MOCK["MockProvider\n(determinista, tests/CI)"]
        ANTH["AnthropicProvider\n(opt-in, server-side)"]
        REG["Prompt registry\n(versionado)"]
        EVAL["Evaluación etiquetada\n+ métricas y puertas"]
        OCR["Seam OCR (ADR-0005)\ninterface + mock adapter"]
    end

    subgraph DB["packages/database — SQLite (Drizzle)"]
        TABLES["cases · communications · attachments\ncustomers · policies · users"]
        RUNS["analysis_runs (inmutables)"]
        AUDIT["audit_events (append-only)"]
    end

    UI -->|"HTTPS (cookie firmada)"| PAGES
    UI --> ACTIONS
    PAGES --> AUTH
    ACTIONS --> AUTH
    ACTIONS --> PIPE
    PIPE --> MOCK
    PIPE -.->|"AI_PROVIDER=anthropic"| ANTH
    ANTH -.->|"solo servidor"| API[("Anthropic API")]
    PIPE --> RULES
    PIPE --> MATCH
    PIPE --> CAT
    ANTH --> REG
    MOCK --> REG
    ACTIONS --> RUNS
    ACTIONS --> AUDIT
    PAGES --> TABLES
    EVAL --> PIPE
```

Package dependency rule: `domain` depends on nothing internal; `ai` and
`database` depend only on `domain`; `apps/web` composes all three. Prompts,
schemas, providers, deterministic rules, and UI never mix (spec §12).

## Data flow — one case, end to end

```mermaid
sequenceDiagram
    actor E as Empleado
    participant W as Next.js (server)
    participant P as Pipeline (domain)
    participant IA as AIProvider (mock/anthropic)
    participant R as Reglas deterministas
    participant D as SQLite

    Note over D: Seed sintético: 19 casos etiquetados,<br/>41 clientes, 77 pólizas
    E->>W: Abrir caso (cookie firmada)
    W->>W: RBAC + canViewCase (servidor)
    W->>D: Leer comunicación + adjuntos
    E->>W: «Analizar caso»
    W->>W: Rate limit (6/min/usuario)
    W->>P: analyseCommunication()
    P->>P: 1. Preprocesado (allowlist MIME, hash de entrada)
    P->>IA: 2. Clasificar + extraer (timeout, Zod + 1 reintento)
    P->>P: 3. Candidatos deterministas (la IA nunca consulta la BD)
    P->>IA: 4. Ranking SOLO de candidatos suministrados
    P->>R: 5. Missing-info determinista (sobrescribe a la IA)
    P->>P: 6. Acción restringida al catálogo del workflow
    P->>IA: 7. Borrador en español (sin afirmar cobertura)
    P->>P: 8. Validación final · external_action_allowed=false
    P-->>W: Resultado OK o estado de error seguro
    W->>D: analysis_run vN (inmutable) + audit_event
    E->>W: Editar campos / borrador → Aprobar·Rechazar·Escalar·Re-analizar
    W->>W: Obligatorios sin resolver ⇒ bloqueo salvo excepción de supervisión
    W->>D: decision + audit_event (append-only)
    Note over W,D: No existe ninguna ruta de envío externo.<br/>La exportación es una vista previa JSON.
```

## Persistence model

- **SQLite via Drizzle** for the prototype (ADR-0002); portable SQL so the
  driver can swap to Postgres. Relative `DATABASE_PATH` resolves against the
  monorepo root so the web app and CLI share one file.
- **Immutability in the engine**: triggers abort `UPDATE` on `analysis_runs`
  and `UPDATE`/`DELETE` on `audit_events`; a CHECK constraint rejects any
  customer row not marked `SYNTHETIC`.
- Evidence and the suggested action live inside `analysis_runs.output_json` —
  the run is the immutable unit of record.

## Operational surfaces

- `/api/health` — liveness (no dependencies).
- `/api/ready` — DB migrated+seeded and provider constructible; reports
  degraded mode when Anthropic is configured without a key.
- Structured JSON logs on stdout (content redacted unless `LOG_CONTENT=1`).
- `npm run evaluate` — labelled evaluation with hard quality gates.
