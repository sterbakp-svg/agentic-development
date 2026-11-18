# Input model

The formal definition is `schemas/agent-profile.schema.json`. This page explains where each input comes from and why the generator needs it.

| Group | Fields | Source | Why the generator needs it |
|---|---|---|---|
| User | display name, job title, department, organization name and type, industry, seniority, has team, delegation roles | Graph prefill (name, job title, department), then the user | Role line, ownership rule, delegation wording, tone default |
| Role | free-text description, responsibilities, ongoing topics, tools, regulations | User; extraction from a pasted job description (FR-2); role preset | Responsibilities line, search signals, impact areas, risks hidden in FYI mail |
| Stakeholders | name, role or group, relation, priority | User; org context; preset | Stakeholder line, sender rule |
| Priorities | high-impact areas, extra urgency signals, low-priority senders, confidential topics | User; preset | Impact and urgency lines, discretion rule |
| Languages | working languages, overview language, instruction language | User; Graph preferred language | Keyword packs, labels, language of description and starters |
| Style | draft tone, signature | User | Draft style, signature |
| Agent | name, time window, top N | Defaults (Inbox Triage, 7, 10) | Fixed numbers in the frame |
| Org context (2b) | organization description, common stakeholders, mandatory rule | Tenant admin | Shared context; one mandatory rule line |

## Role presets (FR-12)

`presets/<id>.json` proposes typical values for one role: executive, it-manager, finance, risk-compliance, data-analyst, project-manager, sales, hr. The format is `schemas/preset.schema.json`. Its `profile` part is a subset of the profile schema and has the same limits.
- A preset sets only `user.seniority`, `user.has_team`, `user.delegation_roles`, `role.responsibilities`, `role.tools`, `role.regulations`, `stakeholders` (groups only, never names), `priorities` and `style.draft_tone`.
- A preset never sets identity fields, `role.description`, ongoing topics, languages, agent settings or org context.
- Two caps apply to presets only. A preset has at most 8 responsibilities, because the responsibilities slot takes 4-8. A preset has at most 12 stakeholders, so the user can still add named people within the profile limit of 20.
- All preset values are English ASCII text. They pass the same content checks as slots (reference `FORBIDDEN_IN_SLOTS` plus the stricter Q-13 rules).

Merge rule (the wizard and the pilot apply a preset this way):
1. Apply the preset once, to the raw user input, before `prepareProfile` adds schema defaults. After the defaults, a `has_team` the user did not answer would already be `false`.
2. The preset fills only fields the user did not answer: missing, empty text or an empty list. Any value the user set wins, also an explicit `has_team: false`. Lists are taken whole, never joined.
3. `user.delegation_roles` is filled only when the merged `has_team` is `true`. The generator suggests no delegation when `has_team` is `false`.

Labels and eval cases:
- Labels and descriptions come from `apps/web/messages/{en,sk}.json` (`presets.<id>.label`, `presets.<id>.description`).
- Eval cases PR-01 to PR-08 in `evals/cases.md` cover each preset.

## Interview design (wizard and pilot agent)

| Step | Questions (short, with examples) | Minimum to continue |
|---|---|---|
| 1. Role | Name in the agent; job title and department; organization type; seniority; team to delegate to? Or paste a job description. | Job title and 1-2 sentences about the role |
| 2. Work content | 4-8 responsibilities; 2-5 current topics; tools; regulations | 3 responsibilities |
| 3. People and priorities | Manager; key people and groups (internal and external); highest-impact topics; usual FYI senders; confidential topics | Manager or 3 groups |
| 4. Language and style | Working languages; overview language; draft tone; signature; time window and top N | Defaults allowed |
| 5. Confirm | Summary of all answers | User confirms |

Rules for the interview:
- Ask at most four questions per step. Show examples from the selected role preset.
- Everything is optional except the minimum. Missing facts become placeholders and questions.
- Never ask for email addresses, phone numbers or mailbox content.
