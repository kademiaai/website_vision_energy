# ba-skills

> A collection of Claude Code SKILL.md files for Business Analysis workflows.
> Designed to turn vague feature ideas into structured, logic-verified specs — ready for AI coding agents to implement.

---

## Skills

| Skill | Trigger | What it does |
|---|---|---|
| [srs-agent](./skills/srs-agent/SKILL.md) | "spec cho...", "mình cần feature...", "đặc tả..." | Interview → Use Case doc + Mermaid diagram + task breakdown |
| [brd-agent](./skills/brd-agent/SKILL.md) | "viết BRD", "phân tích yêu cầu", "stakeholder muốn..." | Elicit requirements → BRD + gap analysis AS-IS/TO-BE |

---

## How to install

**Option 1 — Project-level (recommended)**

Drop the skill file into your Claude Code project:

```bash
# Clone this repo
git clone https://github.com/phong-baruby/ba-skills.git

# Copy the skill(s) you want into your project
cp ba-skills/skills/srs-agent/SKILL.md your-project/.claude/skills/srs-agent/SKILL.md
```

Then in your `CLAUDE.md` (or `claude.md`), add:

```markdown
## Skills
- .claude/skills/srs-agent/SKILL.md — BA spec workflow
- .claude/skills/brd-agent/SKILL.md — BRD workflow
```

**Option 2 — Global (applies to all projects)**

```bash
cp ba-skills/skills/srs-agent/SKILL.md ~/.claude/skills/srs-agent/SKILL.md
```

---

## How to use

### SRS Agent — Use Case spec

Trigger bằng cách nói tự nhiên với Claude Code:

```
"mình cần tính năng cho phép khách đổi hàng sau khi nhận"
"spec cho flow thanh toán COD"
"feature này làm gì: user tạo trade-in request..."
```

Claude sẽ tự động:
1. **Interview** — hỏi làm rõ yêu cầu (WHO, WHAT, FLOW, EDGE CASES) theo từng round, không dump câu hỏi
2. **Structure** — điền vào Use Case template chuẩn (Actors, Pre/Postconditions, Main Flow, Alternate Flows, Exception Flows, Business Rules)
3. **Verify** — tự rà logic: precondition có được enforce không, exception có handle đủ business rule không, state machine có orphan state không
4. **Output** — tạo 3 files:
   - `UC-XXX-feature-name.md` — Use Case document
   - `UC-XXX-feature-name.mermaid` — Sequence diagram + State machine
   - `UC-XXX-feature-name-tasks.md` — Task breakdown cho AI coding agent

**Sample output structure:**

```
docs/specs/
├── UC-001-return-request.md
├── UC-001-return-request.mermaid
└── UC-001-return-request-tasks.md
```

---

### BRD Agent — Business Requirements Document

Trigger:

```
"viết BRD cho dự án X"
"phân tích yêu cầu từ stakeholder"
"cần tài liệu cho management review"
```

Claude sẽ:
1. **Elicit** — phỏng vấn Socratic để lộ requirements ẩn
2. **AS-IS / TO-BE analysis** — gap analysis trạng thái hiện tại vs mục tiêu
3. **Output** — BRD chuẩn Markdown + Mermaid diagram

---

## Why SKILL.md instead of a plain prompt?

Plain prompts chạy một lần rồi thôi. SKILL.md được Claude Code load vào context của từng session, hoạt động như một persistent workflow — Claude biết khi nào trigger, chạy phases theo thứ tự, và nhớ format output chuẩn mà không cần nhắc lại mỗi lần.

---

## Philosophy

> **Yêu cầu sai shipped đúng = bug đắt nhất.**

Các skill trong repo này được thiết kế để bắt lỗi nghiệp vụ ở giai đoạn spec — trước khi chúng trở thành PR, review, và regressions trong production.

Core ideas:
- **Interview trước, viết sau** — không cấu trúc hóa ý tưởng chưa đủ chín
- **Explicit Scope OUT** — quan trọng ngang Scope IN
- **Auto-verify logic** — trace PRE↔FLOW, BR↔EX, state orphan detection
- **AI-ready output** — task breakdown reference về spec section để coding agent trace ngược được

---

## Contributing

Có skill BA workflow nào khác muốn thêm vào? Open a PR hoặc issue với:
- Mô tả skill làm gì
- Trigger phrase
- Use case thực tế đã dùng

---

## License

MIT
