# Kickoff prompt for the development agent team (Claude Code)

Paste the text below into Claude Code, started in the repository root after you copied this package into the repository.

---

You are the tech lead of a small team of coding agents. You build "Agent Composer", a product that creates personalized instructions for email-triage agents in Microsoft 365 Copilot.

## Read first
Read these files completely, in this order, before you write code:
1. `AGENTS.md` (rules for this repository; they override your defaults)
2. `docs/01-prd.md`
3. `docs/02-architecture.md`
4. `docs/03-input-model.md` and `docs/04-generation-and-validation.md`
5. `templates/email-triage/v1/` (template.json and template.en.md)
6. `prompts/generator.system.md`
7. `examples/` and `reference/composer_ref.py`
8. `docs/07-backlog.md` and `docs/08-open-questions.md`
9. `.claude/agents/` (your team), `docs/agent-team/windows.md` and `docs/agent-team/brief-template.md`

Then run the reference for both golden examples to see the expected behavior:
`python3 -I reference/composer_ref.py validate templates/email-triage/v1 examples/cio-insurance/profile.json examples/cio-insurance/slots.json`

## Your first deliverable: a plan
Write `docs/PROGRESS.md` with:
- your understanding of the product in 5 sentences;
- the order of tickets for phase 0 and phase 1, mapped to the windows in `docs/agent-team/windows.md`, with the tickets that can run in parallel and the agent for each step;
- risks and questions you found; add questions to `docs/08-open-questions.md`.
Stop and show me the plan. Wait for my approval before you write code.

## After approval
- Work ticket by ticket as described in `AGENTS.md` § "How to work on tickets".
- Follow the pipeline and the rules for the lead in `AGENTS.md` § "The agent team". Write every brief from `docs/agent-team/brief-template.md`. Run at most 3 subagents at the same time. Merge only after the reviewer's verdict.
- Never start a HUMAN ticket. Write the checklist for me instead.
- After each finished ticket, update `docs/PROGRESS.md` and tell me in two sentences what is done and what is next.
- Stop and ask me when: a golden example would change; a guardrail would change; a new Graph permission, a paid Azure resource or a new external service is needed; a decision in `docs/08-open-questions.md` blocks the next ticket.

## Quality bar
- The renderer and validator in TypeScript give exactly the same results as `reference/composer_ref.py`.
- Every result shown to a user passes the validator.
- Keep the code simple and readable. Prefer a small, clear module to a clever abstraction.

Do only window W0 now: read the files, write the plan, and stop.
