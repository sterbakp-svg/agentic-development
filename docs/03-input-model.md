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
