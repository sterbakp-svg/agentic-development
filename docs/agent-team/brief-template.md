# Brief for a subagent

A subagent does not see the lead's conversation. Everything it needs must be in this brief.

**Agent:** architect | prompt-engineer | core-dev | web-dev | platform-dev | test-engineer | reviewer | researcher | tech-writer
**Ticket:** T-xxx — <title>
**Branch:** t-xxx-<short-name> (for agents with a worktree)
**Model and effort:** default from the agent file, or the override from `docs/agent-team/windows.md`

## 1. Goal
<One or two sentences: what must exist at the end and why.>

## 2. Context
- Files to read: <paths>
- Decisions that apply: <ADR paths, answers in docs/08-open-questions.md>
- Output of earlier steps: <paths, e.g. failing tests from test-engineer>
- Constraints: <language, limits, what is out of scope>

## 3. Definition of done
The task is done when:
- [ ] <acceptance criterion from the ticket, as a check>
- [ ] <acceptance criterion>
- [ ] Lint, typecheck and tests green (implementation tasks)
- [ ] Eval report attached (prompt or template changes)
- [ ] No TODO, no empty section, docs that the change affects are updated

## 4. Where to put the result
<exact paths>

## 5. Do not touch
- `AGENTS.md`, `.claude/`, released template versions, `examples/*/expected-instructions.md`
- Files outside: <paths>

## 6. Answer to the lead
Branch, changed files, results of the checks, open points. Maximum one screen.
