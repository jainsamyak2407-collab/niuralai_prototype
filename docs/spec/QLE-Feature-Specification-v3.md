<!-- Plain-text extract of QLE-Feature-Specification-v3.docx (tables are flattened, one cell per line). The .docx is the source of truth. -->

# QLE Workflow Feature Specification

Samyak Jain

Niural AI product manager case study

Version 3 • 28 September 2026 • Final specification aligned with GPT.md

I am building a QLE workflow service for payroll and HR platforms that already manage benefits. It helps an employee report a life event, helps HR make the right decision, and tracks the change through the carrier and payroll systems until the records agree.

The main outcome is simple: the right people have the right coverage, from the right date, with the right deduction. An HR approval or a successful file transfer is only a step toward that outcome.

This is the final product specification to use with GPT.md, the live-build instructions. It replaces earlier drafts. It defines working application behavior around simulated external systems, not a production release or legal sign-off. All people, evidence, policies, rates, and external responses are synthetic. DESIGN.md remains the visual authority. Requirements and tests below are commitments to implement and verify, not claims that the application already passes them.


## 1 Product decision

The product owns the QLE case from the employee’s request through the confirmed benefit change and payroll update. The existing HR platform remains the source for employment, plans, and payroll. The carrier remains the authority for its coverage record. The COBRA administrator owns continuation coverage administration after an acknowledged handoff.

I will demonstrate three complete workflows on one shared case engine: birth of a child, final divorce removing a covered spouse with a COBRA handoff, and qualifying loss of outside coverage. Adoption and placement for adoption reuse the addition engine with their own dates and evidence. Legal separation is assessed separately and goes to review when eligibility is unclear. Other events remain visible through honest guided intake or assisted review, not a fake completion screen.

The strongest demonstration is a case that does not go smoothly. I want to show an incorrect carrier effective date being caught, only the affected record being corrected, the employee receiving a clear update, and payroll being reconciled without repeating completed work.


### What makes the product useful

One case follows the request across employee, HR, broker, carrier, and payroll. Every pending action has an owner and a due date.

Each benefit has its own outcome. Medical can be confirmed while dental is still being corrected.

Emma explains the next step using the employer’s approved documents. Rules and calculations come from code, with human review where judgment is required.

A case closes on evidence that the approved change was applied correctly. Silence, an email being sent, or an AI confidence score cannot close it.


### How to read this document

Sections 2–6 explain the problem, evidence, assumptions, scope, and event structure. Sections 7–12 define the users, screens, shared workflow, delivery, reconciliation, and compliance handoffs. Sections 13–15 define the three complete prototype flows. Sections 16–20 cover AI, regulation, architecture, acceptance tests, and metrics. Sections 21–23 cover rollout, decisions to validate, and sources.


### The decisions I am protecting

The service is standalone for the platform customer, but the employee experience is embedded in the existing HR product. A separate QLE portal would be quicker to launch but adds another place to find, sign in, and track work. The demo shows the embedded direction; it does not claim that a real partner integration exists.

I am investing in one shared workflow and three meaningfully different events, rather than a separate engine for every tile. I am also choosing verified carrier and payroll outcomes over stopping at HR approval. That costs more integration work, but addresses the failure the employee actually experiences.

AI prepares and explains; code enforces approved rules; people resolve uncertainty. Nightly EDI is the main simulated route, with API and manual adapters behind the same contract. This keeps the product useful across carrier capabilities without pretending every carrier has an instant API.


## 2 Problem and goals


### The problem

The case study describes employers and employees handling life events through emails, spreadsheets, and carrier paperwork. An employee can submit a request on time and still have no clear answer about whether their family member is covered. HR has to reconstruct the event, check documents, contact the broker or carrier, and remember to update payroll.

The hardest part is the gap between systems. A request can look finished in the HR platform while the carrier has the wrong person, plan, or effective date. Payroll can then deduct too much, too little, or nothing. The employee discovers the mistake when they need care or see their payslip.


### Who buys and who benefits

The buyer is a payroll or HR platform that wants QLE handling without building benefits operations from scratch. Its employer clients configure plans and review cases. Employees use the embedded journey. Brokers and COBRA administrators participate only when their work is needed.


### Goals

Make a valid request easy to submit on time, including when a document is not yet available under an approved evidence process.

Reduce HR re-entry and follow-up work while keeping decisions explainable.

Detect a coverage or deduction mismatch before the case is marked complete.

Give the employee a clear answer to three questions: what changed, when does it apply, and what happens to my pay?

Give the platform partner a reusable service with a clear integration and responsibility boundary.


### Non goals

The prototype will not price real insurance, adjudicate claims, guarantee a provider is in network, file ACA forms, collect COBRA premiums, or connect to a real carrier. It will not build a full HRIS, payroll engine, or every benefits election rule. FSA, HSA, life insurance, disability, and state continuation workflows are later work or assisted review.


## 3 Research that informs the choices

The sources support the workflow decisions below. They do not establish exact QLE frequency or an 85 percent broker usage rate for a 120-person employer.

Finding

Product implication

Limit of the evidence

KFF’s 2025 survey reports that 89 percent of firms with 50–199 workers offer health benefits to at least some workers. [S1]

A benefits-offering employer with 120 employees is a reasonable demo customer.

This is not the percentage using a broker or the percentage of all employees covered.

KFF reports that 27 percent of covered workers at firms with 10–199 workers are in self-funded plans. [S1]

Funding type must be an employer setting. I choose a fully insured plan for this demo to keep one operating model.

The denominator is covered workers, not firms. This does not prove how a specific Nexa plan is funded.

LIMRA reports that four in ten employers say they would change carriers if products could not connect to their benefits platform. [S2]

Integration and reliable operations matter to the buyer, alongside the employee experience.

This is stated willingness, not observed churn or a result specific to 120-person companies.

Employee Navigator describes broker involvement, carrier testing, and comparing enrollment data with carrier records. [S3]

Priya needs assigned correction tasks and evidence of completion. A feed needs reconciliation and onboarding.

This is an established vendor’s operating guidance, not a market share estimate.

Employee Navigator documents multiple integration types. CMS identifies 834 as the enrollment and disenrollment standard. [S4, S5]

Use one internal change record with different delivery adapters. Start the demo with a simulated nightly 834 route and a broker fallback.

Neither source establishes a universal weekly schedule or that every carrier supports a public API.


### Claims I will not use in the interview

I will not repeat the suggested broker, PEO, or direct-purchase percentages without a reliable study with the right sample and denominator. Those categories may also overlap. I will not claim direct purchasing always costs the same, that an API call instantly activates coverage, or that EDI is only for large employers. The route depends on the carrier, group, platform, and contract.

Birth, divorce removal, and loss of outside coverage are chosen because they exercise different product risks, not because I have established that they are the three most frequent QLEs. Birth tests event-date enrollment, multiple dependents, and retroactive payroll. Divorce tests removal, privacy, COBRA, and retroactive correction. Loss of coverage tests eligibility, continuity, and different legal clocks. Pilot event-volume data will decide subsequent investment.


## 4 Assumptions for this build

These are explicit demo assumptions and product decisions. A cited rule explains a constraint; it does not turn an invented Nexa policy into a verified fact.

A01 Geography and employer. Nexa is a private US employer with 120 full-time employees, with that workforce throughout the previous year. It is assumed to be an ACA applicable large employer and subject to federal COBRA and ERISA. Headcount today alone would not establish all of this. [S6, S10]

A02 Platform boundary. The host platform supplies employment, available plans, existing elections, and payroll records. Our service owns the QLE case and its audit trail. The role selector stands in for partner SSO during the demo.

A03 Benefits. Nexa has a calendar-year, fully insured medical plan with two illustrative Aetna-labeled options, plus fictional Nexa Dental and Nexa Vision plans. These are not verified Aetna products or contract terms. One execution engine handles each benefit independently. The synthetic dental and vision rules explicitly permit the modeled changes and mirror their selected dates; this is a demo policy, not a claim that excepted benefits follow the same federal enrollment rules as medical.

A04 Rules and state boundary. Implement the federal baseline and Nexa’s synthetic written Section 125 and benefits-plan rules. No approved New York or other state rule pack is implemented. Capture jurisdiction facts and route an unreviewed or conflicting state situation to a named reviewer before automated execution. Federal-only logic is not a claim of nationwide compliance. The prepared demo profiles have an explicit jurisdiction-suitability assumption, not legal clearance. [S7–S9]

A05 Enrollment timing. Nexa’s demo uses 30 calendar days for ordinary special-enrollment requests and 60 for Medicaid/CHIP eligibility loss or premium assistance. Federal ordinary rules generally require at least 30 days. Divorce removal has a separate 30-day Nexa reporting target, not a HIPAA addition deadline or a replacement for COBRA notice rules. The service is assumed to be an authorized intake channel. [S7, S8]

A06 Broker and carrier route. Priya is Nexa’s broker and can handle assigned carrier corrections. Medical changes use a simulated nightly 834 batch. Portal submission is the configured fallback. This is a practical scenario supported by observed workflows, not a claim about broker prevalence. [S3–S5]

A07 Payroll. Nexa pays twice monthly. Rates, cutoffs, proration, and any catch-up schedule are approved synthetic employer settings. The demo has actual and projected payroll records, so an estimate cannot be mistaken for a posted payslip.

A08 Human accountability. Daniel approves the proposed benefit change. An authorized payroll administrator approves unusual adjustments. AI can prepare work and identify issues but cannot silently deny a request, terminate coverage, or authorize payroll changes.

A09 COBRA. A third-party administrator handles notices, elections, premiums, and ongoing continuation coverage. Our service tracks the handoff, receipt, and agreed status updates. Death of a dependent does not create continuation coverage for the deceased person. [S10, S11]

A10 Privacy. All prototype data is synthetic. Production would require a role-specific legal assessment, appropriate agreements, and security review across hosting, storage, OCR, AI, logs, and integrations. A model API key does not establish HIPAA readiness. [S12–S15]

A11 Open enrollment. Nexa’s synthetic open enrollment runs November 1–15, 2026 for coverage starting January 1, 2027. These are configuration values. Do not also show the older May 2027 example.

A12 Service targets. The demo gives HR one business day for an initial review, with escalation when overdue or close to a deadline. These are operating targets, not legal extensions or promised carrier turnaround times.

A13 Evidence correction. The demo stores a valid request timestamp separately from evidence completion. It uses a five-day correction period only as an approved synthetic Nexa policy. Federal law does not create a universal five-day cure period. Missing the correction target creates an HR decision task, not an automatic denial.

A14 Dependent pricing. The demo uses explicit composite tiers: Employee only, Employee + Spouse, Employee + Children, and Family. Rates are specified in section 11. Per-dependent pricing and ACA small-group age rating are later extension points, not a second implemented rating engine. Do not infer the rating method from employer size.

A15 Age-off scope. Proactive age-26 monitoring and a full disability-extension workflow are P1, after the three core journeys. Until implemented, show an assisted-review route, not an automated removal. Any 90-, 60-, and 30-day reminders are proposed service settings, not universal law. Continued dependent coverage requires the relevant plan and state review.

A16 Scenario isolation. Birth, divorce, and outside-coverage loss are three separate synthetic snapshots selected from a demo scenario switcher. They use the same Maya persona and shared product architecture, but they are not sequential events in one household record. This prevents a birth scenario with employee-only coverage from conflicting with a divorce scenario where Arjun is already enrolled.

A17 Data and truth. Keep proposed elections, approved elections, independent carrier observations, and posted payroll results separate. Real application persistence and calculations are required. External transport, email delivery, identity-provider behavior, payroll runs, and COBRA responses are visibly simulated; none is a real integration claim.


### Concrete demo settings

For ordinary loss, the base demo starts coverage on the first day of the month after the valid request. Birth, adoption, and placement for adoption use the applicable event date. The outside-loss fixture also has an explicit synthetic policy allowing a documented advance request on October 31 for November 1 coverage. The same-day advance rule is not presented as a federal requirement. [S7]

For a Day 30 request, the server receipt remains the controlling demo timestamp even if HR reviews it later. Request completeness and evidence sufficiency are evaluated separately. A saved draft, blank request or unrelated upload does not receive a fabricated timely status. If an otherwise valid request needs corrected evidence, the case enters Evidence correction required under Nexa’s configured process.

Minimum intake means a signed-in employee, event and affected people, material event facts, requested election or clear review request, and attestation. Store reportedAt and enrollmentRequestedAt separately when needed. A request for HR advice does not by itself prove that an election was completed. Evidence may remain pending only under the configured process. Use date-only calendar arithmetic, UTC receipt timestamps, and America/New_York for demo display; that timezone does not restrict the legal scope to New York.


## 5 Scope and delivery priorities


### Live prototype

The feature set below is the build target, not a claim that a certified carrier, payroll, or COBRA integration already exists. The prototype implements three event configurations on one reusable workflow instead of three separate applications.

All three flows reach an observable end state across employee intake, HR decision, carrier delivery, coverage reconciliation, and payroll. Divorce also creates a restricted COBRA handoff. The live walkthrough should show one happy path and at least one failure that the product detects and repairs. Other catalogue events either reuse an approved configuration or enter assisted review; they never lead to a fake success screen.

Priority

Build commitment

Evidence in the demo

P0

Shared employee, HR, carrier, payroll, task, and audit model

A case keeps one identity and history across every role and survives refresh.

P0

Birth of a child, with adoption and placement variants

Event-date coverage, one or several children, evidence, plan choice, carrier confirmation, and payroll reconciliation.

P0

Final divorce removal; legal separation assessed separately

Direction question, former-spouse removal, plan-specific end date, carrier confirmation, payroll change, and restricted COBRA referral.

P0

Loss of other health coverage

Reason and end-date checks, household eligibility, plan choice, carrier addition, payroll change, and gap-aware tracking.

P0

HR review and missing-information loop

Material edits invalidate the affected approval; late and conflicting cases route to accountable review.

P0

Simulated nightly 834 delivery and carrier operator

Transport, file, member, coverage, and mismatch states stay separate.

P0

Reconciliation and recovery

A wrong date or partial failure keeps only the affected person or benefit open and produces a targeted correction.

P0

Emma and bounded AI assistance

Source-grounded explanations and proposed extracted facts never replace rules, authorization, or carrier evidence.

P0

Lightweight restricted broker view and manual carrier route

Priya can complete only assigned corrections and cannot see unrelated employee records.

P0

Jurisdiction capture and state-rule review fallback

Unknown or changed jurisdiction preserves the request but blocks automated execution pending authorized review.

P1

Proactive age-26 case and disability-extension review

Advance reminders, plan-specific end date, minimum-data evidence path, and continuation handoff.

Later

Certified integrations, real SSO, production notices, broad state rules, FSA and HSA workflows

Requires partner contracts, legal validation, security approval, and measured pilot results.

If time tightens, protect the shared case state, all three event decisions, the HR approval, and the reconciliation loop. Remove decorative landing content, animation, and secondary dashboards before removing a rule check or showing coverage as confirmed without evidence.


### What is real and what is simulated

Real within the prototype: saved case state, input validation, approved synthetic rules, document storage, calculations, role-specific views, an audit timeline, and a model call if available. Simulated: identity provider, carrier transport and replies, posted payroll responses, email delivery, and COBRA administrator responses. Each simulation is labeled in the operator controls. The employee screens remain coherent and truthful about the demo.


## 6 How life events are organized

Employees choose what happened in their lives. They do not choose a legal framework. The product maps the answer to the applicable enrollment, election, removal, or continuation rules.


### Employee event menu

The first life-event screen uses the six professional tiles below. A tile opens a compact choice list or one question at a time. Group or search longer lists instead of showing another wall of cards. Store a canonical event code so aliases reach the same rule. The employee never has to choose a law.

Tile

Employee-facing description

Examples routed from the tile

Family changes

Marriage, a new child, separation, or family loss

Marriage; birth; adoption; placement for adoption; divorce; legal separation; covered family member death

Other health coverage

You or a family member gained or lost another health plan

Employment or hours loss; divorce-related outside loss; policyholder death; age-off; contribution loss; COBRA exhaustion

Work and leave

A change in employment, hours, or leave affected benefits

Start or end of employment; hours change; leave or return; worksite or status change

Dependent eligibility

A dependent’s eligibility, custody, or legal coverage changed

Age or dependency loss; qualified medical child-support order; guardianship; disability-extension review

Plan and cost changes

A plan option, coverage level, or employee cost changed

Significant plan or cost change; another employer’s enrollment period; permitted Marketplace transition

Government coverage

Medicaid, CHIP, Medicare, or Marketplace coverage changed

Medicaid or CHIP loss; Medicaid or CHIP premium assistance; Medicare or other public-coverage review

Below the tiles, show “Not sure which applies? Ask Emma” and “Ask HR for help.” Emma can propose the next question or a configured route, but it cannot declare eligibility. Human help must not require chatting with AI first.


### Rule families behind the employee language

“QLE” is a useful employee label but not one universal legal list. The product evaluates four rule families separately because the same event can have different consequences.

Rule family

What it decides

Product treatment

HIPAA special enrollment

Whether an otherwise eligible employee or dependent has a federal right to enroll after specified events

Deterministic event, prior-coverage, timing, affected-person, and effective-date rules [S7, S8]

Section 125 cafeteria plan

Whether the employer’s written plan permits a midyear pretax election change consistent with the event

Versioned employer configuration plus human review for ambiguity [S9]

COBRA continuation

Whether a person losing applicable group coverage must receive a continuation pathway

Restricted linked case with separate notice, election, payment, and activation states [S10, S11]

Plan, carrier, and state rules

Evidence, exact eligibility, end dates, benefit-specific treatment, and more generous protections

Approved configuration; conflicts go to the plan administrator or counsel


### Family changes

Employee choice

What the product checks

Prototype treatment

I got married

Eligible spouse and any related enrollment rights; permitted election change. [S7, S9]

Visible in the wider catalogue; guided or assisted route after core flows.

I got divorced or legally separated

Was the spouse on Nexa’s plan, or did Maya lose the spouse’s outside coverage? Does separation actually end eligibility under this plan? [S8–S11]

Direction choice. Nexa removal can create a COBRA task; external loss uses the loss flow.

I had a baby

Birth date, eligible people and options, request timing. [S7]

Main end-to-end addition flow.

I adopted a child

Adoption date and current coverage, including any earlier placement. [S7]

Variant of addition. Do not create a duplicate enrollment after placement.

A child was placed with me for adoption

Placement date and legal responsibility, separate from final adoption. [S7]

Variant of addition. Do not wait for a final adoption decree by default.

A covered family member passed away

Which person died and which benefits must end; plan-specific end date and election change. [S9]

Wider-scope assisted route. Preserve surviving family members and use sensitive copy.

My child no longer meets dependent rules

Actual eligibility loss, permitted change, possible continuation rights. [S9–S11]

Assisted review; often initiated by the host platform’s eligibility process.

Guardianship or foster placement changed

Plan dependency rules and applicable law; not automatically the same as placement for adoption.

Assisted review. Do not promise a universal special-enrollment right.

Death of Nexa’s covered employee is a different, employer-initiated workflow: survivors may need COBRA and cannot be expected to use the employee’s login. Death of an outside policyholder that causes Maya to lose coverage belongs in the loss group. These are later or assisted paths, not aliases for dependent removal.


### Loss of other coverage

Ask “Who lost coverage?”, “What coverage ended?”, “When did it end?”, and “Why did it end?” A job ending and health coverage ending may have different dates. Ordinary special enrollment also requires the relevant eligibility and prior-coverage conditions; an event label alone is not enough. [S7, S8]

Reason shown to the employee

Why it matters

Handling

A job ended or hours were reduced

Can cause loss of eligibility for job-based coverage.

Core loss variant; use the actual coverage end date.

Divorce or separation ended my coverage

Employee may join Nexa after losing a spouse’s plan.

Core loss variant; old-plan COBRA may also be available.

The person whose plan covered me died

Survivors may lose the outside plan’s coverage.

Loss variant or assisted review; not dependent removal at Nexa.

I aged out or no longer qualify as a dependent

Loss of dependent eligibility can trigger enrollment rights.

Validate the former plan’s actual end date.

My employer stopped contributing to the other plan

An employer contribution ending can create rights even without the same type of eligibility loss.

Assisted review of contribution end and prior coverage.

My COBRA coverage was exhausted

Reaching the maximum available continuation period differs from voluntarily stopping it.

Validate exhaustion; do not equate nonpayment with exhaustion.

I lost Medicaid or CHIP eligibility

A different special-enrollment clock applies.

60-day rule variant; keep distinct from ordinary loss.

Other involuntary loss

Examples include a plan ending or moving outside a service area with no available coverage option.

Ask what actually changed and route uncertainty to HR.

These categories summarize the employer-plan loss rules and examples in [S7, S8]. The demo does not assert that every cancellation is a qualifying loss.


### Other recognized changes

These belong in the wider product catalogue, but not every item is a HIPAA special-enrollment event or a self-service prototype flow.

Group

Examples

Rule route and scope

Public coverage changes

Eligibility for Medicaid or CHIP premium assistance; becoming entitled to Medicare or Medicaid

Premium assistance has a 60-day special-enrollment route. Other election changes require their own plan review. [S8, S9]

Employment or leave changes

Starting or ending employment, leave or return, employment status or worksite changes affecting eligibility

Usually begins with the host HR system; apply plan and election rules. [S9]

Changes to other available coverage

Significant cost or coverage changes; another employer’s different enrollment period; certain Marketplace transitions

Conditional Section 125 paths. Written-plan permission and the conditions matter. [S9, S16, S17]

Court or legal requirements

Qualified child-support orders; divorce orders affecting coverage responsibilities; annulment

Human review before any removal or addition that conflicts with an order. [S9]

Residence or eligibility changes

A move that changes plan eligibility; dependent status changes

A move alone does not automatically open employer-plan enrollment. [S7, S9]

Continuation events

Employee death, qualifying job termination or reduction in hours, divorce and loss of dependent status causing coverage loss

COBRA is a separate continuation track, not an automatic reason to enroll everyone in a new plan. [S10, S11]

This is a practical catalogue for employer medical QLE handling. It is not an exhaustive list of every state mandate, every tax election rule, or every benefit product. Rule availability is configured per employer and benefit.


### Events that do not automatically qualify

Situation

Employee explanation

Product response

I changed my mind or prefer another plan

A preference alone usually does not open midyear enrollment.

Show next open enrollment and offer review if something else changed.

I became ill or need an expensive procedure

A medical need alone is not a listed employer-plan special-enrollment trigger.

Explain current benefits; offer urgent benefits support without promising a new election.

I am pregnant but the child has not been born

Pregnancy alone is not the federal employer-plan birth enrollment event.

Save preparation steps and explain the birth reporting process; consider applicable state rules.

I canceled other coverage voluntarily or stopped paying

This generally is not qualifying loss under the ordinary loss-of-coverage rule. [S7]

Ask whether another qualifying change happened; send disputed cases to HR.

I moved, but nothing changed about plan eligibility

An address change by itself may be a profile update.

Update through the host platform; ask if available coverage changed.

I divorced, but no affected person had this coverage

There may be no Nexa benefit change to process.

Update the appropriate records; ask whether outside coverage was lost.

I reported a valid event late

The event may qualify, but the standard request window may have passed.

Preserve the request and route extension, error, or exception review. Do not label the event itself invalid.


## 7 Users and their journeys


### Primary user Maya Shah the employee

Maya is a senior product designer at Nexa. She wants to change benefits on time, understand the cost, and know whether her family’s coverage is actually confirmed. She should not have to understand EDI, Section 125, or COBRA terminology to begin.

Her journey: open Benefits → choose Report a life event → explain what happened and who is affected → see the relevant timing guidance → supply evidence or explain what is missing → review the permitted changes and cost → submit → respond to a specific follow-up if needed → track confirmation and payroll → see the final result and any remaining action.

For a death, the journey skips plan-shopping unless a separate permitted choice is relevant. It focuses on removing the correct person, confirming who stays covered, and explaining whether the cost changes. For birth or adoption, it focuses on adding the child and reviewing eligible options. For loss, it first establishes what coverage ended and why.


### Primary user Daniel Brooks the HR and payroll administrator

Daniel manages benefit changes and coordinates payroll for Nexa. He needs a clear queue of decisions and exceptions, not another inbox of documents.

His journey: receive the request → review the evidence, applicable rules, and proposed change together → request only missing information or approve → monitor delivery and carrier processing → resolve mismatches with Priya or the carrier → approve the payroll adjustment if needed → confirm the case is complete and review the audit record.

Daniel can handle both roles in the demo. A real employer may separate benefits and payroll permissions. Payroll users need deduction instructions, not unrestricted access to birth certificates or divorce documents.


### Secondary user Priya Patel the broker

Priya helps Nexa get the intended change accepted by the carrier. Her involvement is a case assumption; some employers or platform operations teams perform these tasks themselves.

Her journey: receive an assigned task → open the minimum required data and approved packet → submit or correct the change through the agreed carrier route → record the submission reference → follow up for a decision → attach a carrier result or request specific missing information → return the task for reconciliation.

She cannot mark a case covered solely because she entered it into a portal. “Submitted” and “carrier record verified” are different actions with different evidence.


### Secondary participant carrier enrollment operations

Carrier staff work in their own systems. They do not need a new account in our product for the initial model. Their journey is receive the change → validate and process it → ask for corrections or publish a result → expose the updated coverage record through the agreed channel. Our adapter or assigned operator turns that result into a case update.

The demo uses a separate operator panel to simulate carrier events. It must be visually distinct from a real carrier connection.


### Secondary user the COBRA administrator

Their journey: receive an eligible-event referral → confirm receipt and beneficiary details → issue required notices → track the beneficiary’s election and premiums → arrange continuation with the carrier → provide agreed status updates.

Our product shows the handoff owner, timestamps, and next obligation. It does not assume that sending a referral fulfills the administrator’s responsibilities. A beneficiary’s election and payment journey remains outside the live prototype.


## 8 Employee experience requirements


### Screen and route contract

Claude Code should treat these screens as one connected product. Every action reads and writes the same case records; no screen uses an isolated mock object after submission.

Screen or route

Main input

Required output and interaction

Demo entry /

Role and scenario selection

Employee and HR entry plus Integration demo. Only predefined synthetic identities; scenario selection never silently resets records.

Employee benefits /employee/benefits

Current elections, plans, rates, open-enrollment dates

Medical, dental, and vision cards; covered people; contribution; plan documents; Report a life event; Emma.

Event router /employee/life-events/new

Six tiles, plain-language description, event date, affected people

Event code, route, early timing result, relevant next question, or assisted review.

Event intake /employee/life-events/[caseId]/details

Event-specific facts and household snapshot

Saved draft, confirmed facts, contradictions, and minimum-intake status.

Evidence /employee/life-events/[caseId]/evidence

Private uploads and employee confirmations

Document status, proposed extracted facts with source, missing items, and secure pending-evidence path.

Options /employee/life-events/[caseId]/options

Eligible people, approved plan rules, rates, preferences

Only permitted choices, coverage or end date, plan comparison, recurring deduction, and estimated adjustment.

Review /employee/life-events/[caseId]/review

Before and after election, documents, acknowledgments

Idempotent submit, immutable receipt, case number, and actual submitted version.

Employee tracker /employee/cases/[caseId]

Case, tasks, delivery, coverage, payroll, and handoff views

Plain milestones, current owner, next employee action, confirmed dates, and unresolved mismatch.

HR queue /admin/qle

Role-scoped open cases and tasks

Queues for action, approaching deadline, carrier wait, payroll mismatch, and COBRA handoff; sort by risk and due date.

HR case /admin/qle/[caseId]

Case snapshot, rules, evidence, elections, tasks, and audit

Request exact information, approve a version, record a reasoned decision, inspect delivery and reconcile results.

Broker task /broker/tasks/[taskId]

Assigned carrier exception only

Minimum necessary fields, required correction, due date, permitted evidence, submission reference, and response.

External simulator /demo/integrations

Authorized simulation controls

Carrier payload and staged results; manual/broker tasks; independent payroll and COBRA responses; email outbox; scenario clock and failure controls.

Employee pay /employee/pay

Historical ledger, proposed and approved instructions

Before/after deductions, separate catch-up, scheduled run and immutable posted payslip.

Documents /employee/documents

Authorized plans, receipts and evidence

Working private downloads from the same source data used in the UI.

HR payroll /admin/payroll

Authorized instructions, deadlines and posted results

Approve unusual adjustments, inspect mismatches, and verify the posted result.

Fixture library /demo/fixtures

Scenario and test fixture selection

Download synthetic proof and plan documents; show what each fixture tests.


### F01 Entry and benefits overview

User story. As Maya, I want to understand my current benefits and find the right starting point without searching across HR pages.

The entry page shows Employee, HR administrator, and Integration demo. Use “Continue as Maya” and “Continue as Daniel” with a visible synthetic-demo label. It is a compact product entry, not a marketing site. Apply DESIGN.md and app screenshots: calm enterprise layout, restrained purple accents, readable data, and accessible controls. Do not turn marketing-video gradients into the dashboard or claim an unverified exact font.

Employee navigation contains Benefits, Life events, Pay, and Documents. Benefits shows separate medical, dental, and vision cards with covered people, actual confirmed dates, employee cost per paycheck, and sample document downloads. Show November 1–15 open enrollment below and a prominent Report a life event action. Proposed elections remain a pending comparison; selecting a plan never replaces current coverage. Emma opens in a contextual side panel and is optional.

Pay separates the latest posted payslip from an upcoming deduction preview. The preview compares current and proposed benefit deductions; it does not invent an exact future net paycheck or represent an estimate as an issued payslip.

Acceptance criteria

F01a  each card uses the stored election for that benefit.

F01b  every download opens a clearly labeled synthetic document.

F01c  projected and posted deductions have different labels.

F01d  role switching does not expose another employee’s case through an unprotected endpoint.


### F02 Event selection and early timing check

User story. As Maya, I want the form to ask questions that fit my situation and tell me early if my request needs extra review.

Start with the grouped event choices in section 6. Use plain questions, including “Are you removing someone from Nexa’s plan, or joining after losing their coverage?” for divorce. Ask the event date, affected person, and relevant coverage end date before requesting a long document upload.

The timing service returns status, rule version, deadline, and explanation. Within window: “You can submit this request by {date}.” On the final day: “Today is the last day in Nexa’s standard request window. Submit today and tell us if a document is pending.” Late: “Nexa’s standard {N}-day request window ended on {date}. Your request needs HR review. You can explain what happened and submit it for review.” Offer Explain with Emma, Send to HR for review, and Save draft. Never say the employee is legally ineligible solely because the standard period passed.

The final submitted request time is stored by the server in UTC, alongside the employer timezone used to display deadlines. Under the demo’s configured counting rule, event date plus 30 calendar days is the deadline, with submission allowed through the end of that date. Validate actual counting, holiday treatment, extensions, and notice requirements before a pilot.


### Input and recovery messages

Future birth: “You can prepare now, but submit the birth request after your child is born.” Invalid date: “Enter a valid date.” Unknown outside end date: “Use the date health coverage ends, which may differ from the last day worked. Ask HR to help verify it if you are unsure.”

A conflict shows both values: “The document shows {value}; your form shows {value}. Please confirm which is correct.” A failed save says: “We could not save this change. Your answers are still here. Try again.” Preserve entered information, show field errors, and do not replace the whole page with an error.

Acceptance criteria

F02a  day 30 is accepted under the 30-day demo rule; day 31 goes to review.

F02b  a Medicaid or CHIP loss uses 60 days, not 30.

F02c  HR opening a timely case the next day does not change its submission timestamp.

F02d  a future birth date cannot create completed birth enrollment.

F02e  the death-removal route does not incorrectly apply the HIPAA birth deadline.


### F03 Intake and evidence

User story. As Maya, I want to provide the information needed for my event without uploading unrelated private information.

Use existing employee and dependent details where possible. Ask Maya to confirm them. Only collect a Social Security number if required for the selected enrollment route; mask it outside the authorized view. A missing newborn SSN is a tracked follow-up under an approved carrier procedure, not a fabricated value.

Event

Questions and fields

Example evidence to request

Birth

Child’s name, date of birth, relationship, address if different, requested benefits, existing family coverage

Birth record, hospital evidence, or certificate if accepted by Nexa and the carrier

Adoption or placement

Adoption versus placement, relevant date, child details, previous enrollment or placement

Accepted adoption or placement document; avoid requesting the entire court file

Dependent death

Which covered person, date of death, benefits affected, safe contact preference

Proof or attestation required by the approved plan process; certificate only if required

Loss of other coverage

People losing coverage, previous plan, actual end date, reason, prior enrollment or waiver context

Accepted loss notice showing the people and coverage end date; issuer or employer evidence according to requirements

Divorce related loss or removal

Direction of change, final event date, affected spouse, coverage impact, relevant court restrictions

Required portions of decree or separation evidence and, for external loss, coverage-end evidence

These are configurable evidence examples, not a federal document checklist. Do not assert that all employers’ letters are invalid or that every carrier requires a certificate. An uploaded document can support a fact; OCR cannot certify authenticity. Requirements come from the approved plan and carrier process.

Accept PDF, JPEG, and PNG with a visible 10 MB demo limit. Validate size, actual file type, and ownership server-side; reject executable or active HTML/SVG content. Files stay private. Show Uploading, Reading, Needs confirmation, Accepted for review, Unreadable, or File rejected. Do not show “virus scanned” unless scanning is actually implemented. Read file bytes, not filenames. Emma proposes facts with page/span references; Maya or HR confirms them. If extraction is unavailable, label manual review or hash-matched synthetic-fixture parsing honestly.

If evidence is unavailable, preserve the entered information and offer the approved pending-evidence route. Clearly distinguish a saved draft from a submitted enrollment request. The prototype assumes its defined minimum request can be submitted before evidence is complete; counsel and the plan administrator must validate that process before real use.

Acceptance criteria

F03a  selecting a different event changes the required questions without erasing shared fields.

F03b  an unreadable file creates a specific follow-up, not a fraud accusation.

F03c  a wrong extracted date never overwrites a confirmed value silently.

F03d  missing proof does not delete the request or backdate its receipt.

F03e  the birth flow can track a genuinely pending SSN without inventing one.


### F04 Eligible options and cost comparison

User story. As Maya, I want to see the changes available to me and understand the tradeoffs before I choose.

The rules engine determines which people and benefit packages can be elected. Emma explains these results. It cannot broaden eligibility or hide a permitted option. Where special-enrollment rights apply, the configuration must respect the available options for similarly situated people. [S7]

Use a short optional preference step: “What matters most to you?” with lower paycheck cost, lower costs when using care, or keeping a provider; and “Would you like help comparing the eligible plans?” Do not ask for diagnoses, genetic information, or detailed family medical history. Network results require an approved directory or a clear instruction to verify with the carrier.

Plan cards show the employee contribution, deductible, out-of-pocket limit, network type, important limitations, and the source document. Emma can say why a plan matches a stated preference. It must not claim to know the lowest total cost without assumptions, clinical facts, and reliable pricing data.

For removal, show the person being removed, the people staying covered, the requested end date, and any resulting tier or rate change. A death may leave the family tier unchanged. Do not force the employee through irrelevant plan shopping.

Acceptance criteria

F04a  only eligible options can be submitted.

F04b  displayed contribution comes from the employer rate table, not the model.

F04c  removing one child cannot remove a sibling.

F04d  unchanged pricing displays “No change to your regular deduction.”

F04e  a plan switch does not promise transfer of deductible or out-of-pocket accumulators without confirmation.


### F05 Review submit and track

User story. As Maya, I want a clear record of what I requested and what still needs to happen.

The review page shows people before and after, each benefit change, requested effective or end date, recurring deduction, any estimated catch-up or refund, evidence status, and acknowledgments. Acknowledging the estimate is not the same as confirming carrier coverage or posting payroll.

Submission creates one case number and an immutable receipt; repeated clicks return the same result. Birth: “Congratulations on your new arrival. Your request {caseNumber} has been received.” Adoption: “Your request to add your child has been received.” Divorce: “We will help update your benefits and keep you informed.” Loss: “We are checking the change and requested start date.” Bereavement: “We are sorry for your loss. We will help with the benefits update.” Suppress congratulations for a child who later died or an explicitly sensitive case. None of this copy claims coverage is already confirmed.

Employee milestones are Request received, HR review, Sent to insurance provider, Coverage result confirmed, Pay updated, and Complete. Use “End date confirmed” for removal and “Confirmed from {future date}” before a future start. Show time, owner, next action, and a safe explanation. Carrier uncertainty is an operational status, not a decision that a timely employee has no legal coverage entitlement.

Notifications contain a case reference and secure link, not certificates, SSNs, diagnoses, or sensitive event details in the subject. The demo records notifications in an outbox rather than emailing real people.

Acceptance criteria

F05a  submission survives a refresh and provides a receipt.

F05b  resubmission does not duplicate the case.

F05c  Maya can upload a requested correction without repeating unrelated steps.

F05d  an error preserves her valid answers.

F05e  employee tracking omits internal notes and other employees’ data.


### F05 notification contract

Each material transition adds a case-timeline event and a deduplicated notification: submission, requested information, employee reply, review/decision, provider submission, issue needing action, coverage confirmation, payroll scheduled or posted, completion/reopening, and important continuation handoff status. Employees and HR receive different role-appropriate messages. Raw acknowledgments and technical retries remain internal audit events, not employee spam.

Default email delivery is a rendered simulated inbox showing recipient, safe subject, case reference, next action, secure link, creation time and delivery state. Never say a real email was sent. A real provider is optional only with explicit approval and a synthetic-recipient allowlist. Sensitive evidence, SSNs, protected addresses and diagnoses never go into ordinary notification content.


### F05 synthetic downloads and fixtures

Create working downloads during the live build: Nexa benefits guide, election rules, rates and payroll policy; both illustrative medical summaries plus dental/vision; Maya’s current election per scenario; submitted receipt and approved change; illustrative EDI/decoded summary; carrier observation; pay-change statement and simulated payslips; minimal COBRA referral.

Evidence fixtures include birth/hospital summary, twins with same and different dates, wrong-date and unreadable examples, adoption/placement summary, divorce fact summary and late variant, loss notice with October 31 end date plus missing-name/wrong-date variants, and Medicaid/CHIP and COBRA-exhaustion examples. Link each fixture to what it tests.

Mark files “SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT.” Use fictional issuer details and no official seals, forged signatures, usable ID cards or purported court decrees. Professional layout is welcome; impersonating real documents is not. Arbitrary supported uploads still need real extraction or an honest manual-review fallback.


## 9 HR review and case ownership


### F06 Review the proposed change

User story. As Daniel, I want to see what changed, which checks passed, and what needs my judgment before I approve.

The HR home shows cases needing action, approaching deadlines, awaiting carrier confirmation, and carrying payroll mismatches. Sort by risk and due date, not just newest first. Each case has one current owner and a named backup. An employer that does not respond must not leave the employee’s request invisible.

The case page contains five areas: employee and event summary, before-and-after elections, rule checks, evidence, and the action timeline. A check has a result of Passed, Needs information, Needs review, or Not applicable. It also has a reason and source. Keep “document date read successfully” separate from “enrollment request is timely” and “carrier coverage confirmed.”

Do not display an invented “97 percent compliant” score. If extraction confidence is available, use it only to decide which field needs confirmation. The useful HR summary is specific: “Two checks need review: the loss letter has no dependent names, and the carrier end date differs from the employee’s date.”

Daniel can request exact missing information, approve the proposed version, send for specialist review, or record an authorized adverse decision with reason, source, and review route. Legal uncertainty, disputed timing, and rule conflicts require accountable review. A generic override cannot erase unresolved legal requirements; the decision needs its applicable authority and evidence. AI cannot decide that all rights are exhausted.

Approval freezes the intended change, rule version, evidence references, and authorized actor. A later change to a material field creates a new version and requires approval again. Do not let an old approval authorize a different plan, person, date, or amount.

Information requests identify the missing field or document, why it is needed, owner, due date, and employee-safe message. Maya replies in the same case and Daniel sees the persisted reply. A nonmaterial clarification may preserve an approval when allowed. A changed person, plan, date, or amount requires a new version and approval before execution. Internal notes never leak into the employee view.

Acceptance criteria

F06a  a missing item produces an assigned task with a reason.

F06b  unresolved mandatory checks block ordinary approval but leave a documented exception route.

F06c  a material edit invalidates the applicable approval.

F06d  HR cannot see another employer’s case by changing an identifier.

F06e  a denial records the person, reason, source, and next review step.


### F07 Reminders and escalation

User story. As Daniel, I want the product to surface stalled cases before an employee misses a deadline or payroll is wrong.

Use an event-specific legal clock and separate operating clocks. Reminders do not extend legal deadlines. Under the demo policy, remind the owner after one business day without action and escalate to the backup after two. Shorten this interval for an imminent deadline, a known coverage problem, or an urgent need for care. Do not wait a fixed three days in every case.

The worker records reminder attempts and delivery status, suppresses duplicates, and stops obsolete reminders after the action is completed. The employee sees “Waiting for HR” or “Waiting for the insurance provider,” not an instruction to keep resubmitting. A missing employer response escalates to the partner’s operations queue; it never becomes automatic approval or rejection.

Acceptance criteria

F07a  advancing the demo clock creates the expected reminder once.

F07b  completed tasks stop generating reminders.

F07c  a case due today is escalated before the ordinary two-day interval.

F07d  a bounced message creates an alternate-contact task without exposing sensitive details.


## 10 Carrier delivery and broker work


### F08 Prepare and send the approved change

User story. As Daniel, I want the approved change packaged for the correct carrier route without retyping it or sending unnecessary evidence.

Prepare a structured enrollment change from approved facts: employer and group identifiers, employee and dependent identifiers, plan and benefit codes, relationship, coverage tier, action, dates, and any carrier-required fields. Required evidence is referenced separately. Do not merge every document into one file and call it an 834.

CMS identifies 834 as the enrollment and disenrollment standard and 835 as a claims payment and remittance standard. The 835 is not the enrollment confirmation format. A 999 acknowledgment addresses implementation-level validation, not proof of active coverage. [S5, S18]

Production needs the applicable licensed standard, carrier companion guide, tested group mapping, and trading-partner agreement. The demo generates a downloadable illustrative .edi and readable summary from one deterministic ChangeOrder. Validate the subset actually implemented, including control references, member/coverage actions and dates, and counts. Label it “Illustrative 834 — not carrier-certified.” Do not invent a real Aetna endpoint, companion-guide field, or certification.

The carrier simulator has its own persistent coverage store seeded from the starting household. It changes only when the operator publishes an observed result. It must not copy our approved election into an “actual” roster automatically, because that would make reconciliation meaningless. Supporting PDFs remain separate restricted attachments, not embedded inside the 834.


### Nightly route selected for the demo

1.HR approves a case version. The server saves the version and creates a delivery job in the same reliable workflow.

2.The batch worker collects approved unsent changes for one configured carrier and group. The demo cutoff is 9:45 p.m. Eastern, with a 10 p.m. batch. These times are chosen settings, not an Aetna promise.

3.Deterministic mapping and validation check required values. Any invalid record becomes a correction task; valid records proceed according to the configured batch policy.

4.The batch records a unique identifier, member-change identifiers, payload hash, rule version, and record count. Supporting files stay in protected storage and follow the agreed separate evidence channel if needed.

5.The demo simulates encrypted SFTP delivery. Production would use the carrier-approved secure transport, credentials, and retention policy. No ordinary email attachment contains the enrollment feed.

6.A transport receipt updates delivery status only. A file acknowledgment updates file status only. Business acceptance and the carrier’s coverage record arrive as separate evidence where the carrier supports them.

7.The adapter links responses to the exact case and version. Reconciliation checks the actual result before payroll completion and case closure.

“Run next batch” advances to the next configured batch in the selected scenario and calls the normal server worker. It cannot directly set coverage, payroll, or case completion. A 202-style API receipt similarly records receipt only. Internal idempotency does not guarantee a real external carrier deduplicates; unknown delivery requires investigation before resend or switching routes.


### Other routes share the same case

Route

What our product does

What proves the next stage

API

Send a validated request to an authorized carrier endpoint; save its transaction reference

A success response may only mean received. Check business status and coverage evidence separately.

Carrier portal

Give the assigned operator approved fields, permitted evidence, and submission instructions

Operator records the portal receipt, then the actual coverage result.

Broker or manual form

Assign Priya a task and generate the required approved form or checklist

Submission reference followed by verified carrier data; a checked task alone is insufficient.

Nightly 834

Send the validated batch and track file and individual-record outcomes

Carrier processing result and a matching coverage record for the affected person and benefit.

Routes are configured per carrier, group, and benefit. Do not switch an uncertain API transaction to manual submission without checking whether the first attempt was processed. That can create duplicate or conflicting changes.

Acceptance criteria

F08a  only the approved version enters a batch.

F08b  a sent job is not sent again on a repeated click.

F08c  transport success does not confirm coverage.

F08d  a rejected member record does not undo unrelated successful records.

F08e  a delivery timeout creates an unknown-delivery investigation rather than an unconditional resend.


### F08 operator screen: external systems simulator

Build /demo/integrations as a lightweight but functional third-party screen with an “External systems simulator — synthetic” banner. All controls use persisted domain events, role checks, and the same ingestion/reconciliation services as adapters. Explain disabled actions; an unsent transaction cannot be confirmed through the ordinary operator path.

Tab

Operator action

Required outcome

Carrier inbox

Open received batch; inspect/download EDI and decoded members. Acknowledge transport, validate/reject file, accept/reject selected records, or request information.

Each action changes only its own stage. File acceptance and member acceptance do not confirm coverage or post payroll.

Coverage observation

Publish actual person, benefit, plan, tier, start/end date, source reference, and observation time; allow a deliberately wrong value.

Update the independent carrier record, run reconciliation, and create or resolve a specific mismatch.

Broker/manual

Open assigned packet/checklist. Record portal submission reference; separately record verified carrier result and source.

Submission remains pending until coverage evidence is verified. More-information requests use the ordinary HR/employee loop.

Payroll

Inspect authorized instructions; accept or reject an instruction; post a run; publish an incorrect result for testing.

Instruction acceptance is not posting. Posted results are independently compared with the authorized amounts.

COBRA

Receive minimal referral; acknowledge receipt; request missing data; record notice reference/status.

Advance the restricted handoff state only. Do not simulate election or payment as a consequence of receipt.

Outbox and controls

Read role-specific simulated emails; advance clock; run due jobs; trigger failures; confirm reset of one scenario.

No real recipient contacted. Switching scenarios preserves data; reset deletes only that selected synthetic scenario after confirmation.

Use one adapter contract for EDI, a small simulated API route, and manual/portal tasks. Never automate a real carrier login, bypass MFA, or send real enrollment data during this build. A manual result must record verifier, source, time, and observed values; an AI summary is not external proof.


### F09 Handle corrections with Priya

User story. As Priya, I want the exact correction task and enough context to solve it without access to unrelated employee records.

An assigned task shows the requested change, the carrier’s issue, required action, due date, and permitted documents. If more employee information is needed, Priya requests it through the case. Maya receives a plain-language request approved by HR or permitted by the configured process.

Carrier requirements do not automatically become new legal rules. If a carrier asks for something that conflicts with enrollment rights or the approved plan, pause the disputed action and escalate to the plan administrator or counsel. Do not silently move a timely birth election to next month to satisfy a bad response.

Priya records the submission reference and attaches or records the carrier’s response. A human-entered result records who verified it, when, and from which source. An AI-generated summary alone cannot establish that the carrier updated its record.

Acceptance criteria

F09a  Priya sees only assigned cases and necessary fields.

F09b  a correction preserves the original request receipt and case history.

F09c  resending a corrected record uses a new version linked to the original.

F09d  the employee is asked only for the information still missing.


## 11 Coverage and payroll reconciliation


### F10 Compare intent with the actual result

User story. As Daniel, I want the product to catch the difference between what we approved and what the carrier and payroll actually applied.

Reconciliation happens at person, benefit, and coverage-period level. Compare the approved election with the carrier record, then compare the approved payroll instruction with the payroll result. Store the source timestamp and the period covered by each result. An old or incomplete roster must not be treated as proof that someone was removed.

For an addition, check the person, plan, tier, effective date, and relevant end date if any. For a removal, check the correct end date and confirm that the remaining people are unchanged. For payroll, check the recurring contribution and the adjustment separately. The total carrier premium is not automatically the employee’s contribution.

A mismatch creates a specific issue: “Child effective date differs: requested September 1, carrier shows October 1.” Assign it to Daniel or Priya, keep the relevant benefit unresolved, and show Maya that confirmation is being corrected. Preserve other completed benefits.


### Use separate states

Record

Example states

What it prevents

Request

draft; submitted; needs_information; under_review; approved; declined; withdrawn

Employee request and authorized decision

Delivery

queued; sent; receipt_unknown; acknowledged; file_rejected; record_rejected

Transport and processing, not coverage

Coverage line

awaiting_confirmation; confirmed_future; confirmed_current; end_confirmed; mismatch

Person/benefit/date result from independent evidence

Payroll

preview; blocked; approval_needed; scheduled; instruction_accepted; posted; mismatch; verified_no_change

Estimate, instruction and actual collection remain distinct

COBRA

not_applicable; review_needed; referral_ready; sent; received; notice_tracked; exception

Restricted handoff and notice progress, not automatic election

For an approved change, derive completion only when every affected benefit/person line has a verified correct outcome, payroll is correctly posted or explicitly verified unchanged, and no blocking issue or required handoff remains unresolved. Assigning an issue an owner is not resolving it. Scheduled payroll means “Coverage confirmed; pay update scheduled,” not Complete. Declined and withdrawn requests have separate terminal outcomes and are not successful fulfillment.

For a COBRA-related removal, the benefit-change case can finish after the removal and payroll are verified and the administrator has acknowledged the handoff, while a linked continuation workflow stays open. The UI must show that boundary. Do not claim that the beneficiary has elected or paid merely because the benefit-change case closed.

Subscriber tiers and dependent membership can depend on each other. Validate the household as well as individual lines. Preserve a successful child or benefit, but flag an impossible partial result such as a dependent added without the required subscriber tier. Absence from an old or incomplete roster is not proof of termination. Store observedAt, source, version, and roster scope; later conflicting evidence reopens an issue without erasing history.

Acceptance criteria

F10a  a wrong effective date prevents completion.

F10b  a future confirmed date is not labeled active before that date.

F10c  a death removal confirms surviving family coverage as well as the ended record.

F10d  a later conflicting carrier record reopens an issue with history intact.

F10e  a stale response cannot overwrite a newer approved correction.


### F11 Calculate and apply the pay change

User story. As Maya, I want to know how my regular deduction and any one-time adjustment will change, and which paycheck will reflect it.

Calculate in integer cents using approved rates and payroll rules. Inputs include coverage period, benefit tier, employee contribution, pay schedule, cutoff, deductions already posted, and any authorized adjustment policy. Keep coverage-effective dates, rate-effective dates, and paycheck dates separate.

The demo waits for matching carrier evidence and an authorized payroll instruction before changing actual deductions. It shows estimates and exposure while waiting and escalates urgent coverage concerns. This is our operating choice, not a universal federal rule or a reason to change an employee’s lawful coverage date. Payroll authorization and carrier confirmation remain separate checks.

Birth example. Ava is born September 1; Maya requests medical coverage September 27; Daniel approves September 28; the carrier confirms October 2 with a September 1 start. Medical changes from $150 to $250 per semimonthly paycheck. On September 27 only September 15’s $150 has posted; September 30’s $150 is still scheduled. Once that run posts, September’s $500 obligation minus $300 collected produces $200 catch-up. Before then, $200 is a forecast conditional on the scheduled old deduction posting. Recalculate from actual posted history before authorization. October 15 medical is $250 recurring + $200 adjustment = $450; unchanged dental $12 and vision $4 make $466 total. The next regular benefit deduction is $266.

Death example. If one of two covered children dies and the family rate stays the same, there is no recurring deduction change simply because a dependent was removed. If a tier changes, calculate using the confirmed end date and the plan’s premium policy. Do not assume a same-day refund. A retroactive termination, already-paid claim, or prior tax-year adjustment requires review.

If payroll has closed, schedule an approved correction for the next permitted run and show the date. Do not rewrite a posted payslip. Leave, insufficient wages, or a large catch-up can require an approved installment or alternate payment arrangement.


### One source of truth for synthetic plan costs

Generate UI cards, downloadable summaries, rate calculations, and Emma’s knowledge from these same structured records. Every figure is illustrative, not verified Aetna pricing. Amounts in the tables are dollars per semimonthly paycheck, with 24 deductions per year; store integer cents. Employer contribution equals total premium minus employee contribution.

Plan / employee contribution

Employee only

+ Spouse

+ Children

Family

Aetna Standard — illustrative

$150

$300

$250

$400

Aetna Plus — illustrative

$200

$375

$325

$475

Nexa Dental — illustrative

$12

$24

$26

$38

Nexa Vision — illustrative

$4

$8

$8

$12

Total illustrative premium

Employee only

+ Spouse

+ Children

Family

Aetna Standard

$450

$800

$750

$1,100

Aetna Plus

$600

$1,000

$900

$1,350

Nexa Dental

$30

$60

$65

$95

Nexa Vision

$10

$20

$20

$30

Sample benefit

Standard medical

Plus medical

Deductible: individual / family

$1,500 / $3,000

$750 / $1,500

Out-of-pocket maximum: individual / family

$5,000 / $10,000

$3,500 / $7,000

Primary care / specialist copay

$25 / $50

$20 / $40

Illustrative in-network preventive care / modeled coinsurance

$0 / 20% after applicable deductible

$0 / 10% after applicable deductible

Dental sample: $50 individual / $150 family deductible; $1,500 annual covered-service maximum per person; preventive 100%, basic 80% after deductible, major 50% after deductible; no orthodontia. Vision sample: $10 exam copay every 12 months; $150 frame allowance every 24 months or $150 elective contact allowance instead of frames every 12 months. These are illustrative in-network terms, not provider promises. A dental benefit maximum is not a medical out-of-pocket maximum.


### Payroll calculation and display contract

Paydays are the 15th and last business day of the month, using an explicit demo calendar and cutoff record. Full-month obligation is twice the per-paycheck employee contribution. For a midmonth change, the synthetic Nexa policy prorates over actual calendar days in the month. Keep intermediate precision, round the final monthly obligation once to cents, and allocate any cent residual consistently.

Calculate obligations by benefit and coverage period, then subtract actual posted deductions allocated to that period. Keep already-scheduled corrections visible so they are not scheduled twice. The carrier premium, employer share, recurring employee contribution, one-time arrears, and refund proposal are separate values. No catch-up is required when the tier/rate is unchanged or the correct amount was already collected.

Pay has four states: immutable historical payslip; proposed comparison while choosing; authorized scheduled change after required checks; posted simulated payslip after the payroll run. Show prior amount, new recurring amount, adjustment, total benefit deduction, applicable period, and target paycheck. A posted mismatch stays unresolved while correct carrier coverage remains confirmed.

Historical payslips can contain realistic earnings, retirement contributions and withholding, but withholding is a labeled synthetic payroll fixture, not a live federal/state tax calculation. Totals must add up. Do not promise exact future net pay, add FSA/HSA or imputed-income engines, or deduct the full carrier premium. Unknown tax treatment, insufficient wages, refunds and prior-year corrections go to payroll review.

Acceptance criteria

F11a  the example above calculates $200, not a second full premium.

F11b  unchanged tier and rate produce zero adjustment.

F11c  a repeated carrier response cannot create a duplicate deduction.

F11d  a payroll rejection stays open and retains coverage confirmation.

F11e  a posted result must be compared with the instruction before payroll is marked complete.


## 12 COBRA and ACA boundaries


### F12 Continuation handoff

User story. As Daniel, I want a possible continuation event routed to the right administrator without delaying required notices or exposing the wrong person’s private information.

Divorce that ends Arjun’s coverage under Maya’s Nexa plan can create a COBRA responsibility. Maya losing coverage under Arjun’s outside employer plan can create special-enrollment rights at Nexa and possible COBRA rights through the old plan. These rights are not mutually exclusive. A deceased dependent is not offered COBRA; death of the covered employee is a different event that may create rights for survivors. [S10, S11]

Start a potential COBRA task when the relevant event and coverage impact are identified. Do not wait for the new enrollment or payroll workflow to finish. Send the necessary event, beneficiary, coverage, address, and notice information through the agreed secure route. Confirm receipt and monitor the applicable notice obligation. Notification periods vary by event and administrator arrangement; configure the approved rules rather than applying one generic deadline.

The affected former spouse may need a separate verified address and secure communication. Their notices and choices must not depend on logging in as Maya or on Maya forwarding an email. The prototype represents this through a restricted handoff record, not a full beneficiary portal.

Keep four clocks separate: Nexa’s administrative reporting target, beneficiary event notification, the administrator’s election notice, and beneficiary election. For divorce-related federal COBRA notice, the plan procedure generally must allow at least the applicable 60-day period; it is not the demo’s 30-day reporting target. Store event, loss, notice-procedure and administrator-receipt facts. Missing trigger facts display “Deadline needs verification,” not a guessed due date. The simulator demonstrates referral receipt and notice status; it does not build beneficiary premium billing. [S10, S11, S26]

Acceptance criteria

F12a  a qualifying divorce-removal case creates a linked task before carrier completion.

F12b  dependent death does not generate a notice for the deceased person.

F12c  a failed referral remains assigned and escalates.

F12d  administrator receipt is distinguished from notice sent, election made, and payment received.


### F13 Supply history to the ACA reporting system

User story. As the platform’s compliance team, I want benefit changes recorded with dates and corrections so the existing reporting system has usable history.

Nexa is assumed to meet the prior-year ALE test. ACA employer responsibilities and reporting are broader than QLE handling; our service does not determine the employer’s complete compliance position. [S6]

Keep dated enrollment changes, applicable offer and contribution references from the host, and correction history. Export them through the partner’s agreed contract. The host reporting engine determines reportable codes and forms. A family contribution change is not automatically a change to the employee-only affordability figure. For this fully insured scenario, do not build self-insured dependent reporting into Form 1095-C Part III by default. [S19]

Acceptance criteria

F13a  a retroactive correction preserves both the prior record and the corrected dates.

F13b  exporting the same version twice does not create two compliance events.

F13c  the interface says “History ready for reporting,” not “ACA compliant” or “IRS filed.”


## 13 Deep prototype flow one: birth of a child

Starting snapshot: September 27, 2026. Maya has Employee only coverage in medical, dental, and vision; Arjun is not enrolled in these Nexa elections. Ava was born September 1. The main path adds Ava to medical only, leaving Maya’s dental and vision unchanged. Daniel approves September 28; the carrier result can be delayed until October 2. Section 11 defines the exact payroll timeline and totals. Other benefit selections reuse the same separate-line engine.


### Happy path

Maya is enrolled in Nexa’s Aetna medical plan. She selects Report a life event → Birth of a child, enters the birth date, adds the child, and uploads the evidence accepted by the configured Nexa plan. Emma can extract proposed facts, but Maya confirms them. The rules service applies the birth rule, returns the eligible election choices, and shows the coverage start, regular deduction, and any catch-up separately. Maya submits and receives a timestamped receipt.

Daniel sees the event, rule result, evidence, requested election, affected people, and payroll impact in one case. After approval, the service creates the carrier transaction for the next simulated nightly 834 batch. Transport receipt means delivered, not covered. The carrier response is compared with the approved child, plan, tier, and birth-date effective date. Payroll is instructed only after the approved result is known. The case closes when carrier coverage and the posted payroll result both match, or payroll is explicitly confirmed as unchanged. [S7]


### Screen sequence and outputs

1.Choose event. Maya selects Family changes → I welcomed a child → Birth. Adoption and placement use the same shell with a different event date and evidence configuration.

2.Add people. Ask for the child’s name, birth date, sex only if required by the plan or carrier, relationship, address if different, and whether another child was born in the same event. Each child becomes a separate person record inside one case.

3.Provide evidence. Upload the plan-approved hospital record, birth record, or later certificate. Show proposed extracted names and dates beside the source. A missing SSN remains a restricted pending item when the carrier permits later completion.

4.Evaluate rules. Deterministic code checks employee and dependent eligibility, event timing, plan options, event-date coverage, current household elections, and allowed Section 125 changes. It returns explicit rule results and the configuration version.

5.Choose coverage. Show only permitted plans and people, the requested start date, new tier, employee cost per pay period, and any expected catch-up. Emma may explain the approved options from source documents.

6.Review and submit. Show the before-and-after household, benefits, dates, costs, documents, and pending items. Submission creates one immutable receipt and HR task.

7.Review and deliver. Daniel approves the exact version. The carrier adapter creates separate member additions, sends them through the simulated nightly batch, and tracks each person and benefit independently.

8.Reconcile and pay. Compare the carrier’s person, plan, tier, and effective date with the approved intent. Compare the payroll result with the recurring instruction and one-time adjustment separately.

9.Complete. Maya sees confirmed coverage, the date it applies, the pay impact, and any remaining action. A mismatch stays visible with an owner and does not become a success message.


### One case can contain several children

Twins, triplets, and other multiple births are one employee-facing life-event case with a separate dependent record for every child. Each child has an identity, date of birth, evidence status, coverage result, and correction history. This prevents repeated forms while allowing one child to succeed and another to fail at the carrier.

Twins across midnight retain each child’s actual date of birth, timing evaluation, and coverage start. Do not display the second child as covered before birth. The demo uses composite Employee + Children pricing, which can cover several children at one configured rate; an existing child tier can therefore have no additional regular deduction. Per-dependent and ACA small-group rating are later work. The federal small-group under-21 child-count provision is not a universal payroll rule and is not implemented by this demo. [S21]


### Birth scenario matrix

These matrices define the material scenarios and their required response. Core exceptions must reach the specified correction or accountable-review path; that does not require automating every legal decision. Rows explicitly marked P1 or Later are not promised live-build capabilities. Implementation and test status must be reported separately.


### Event shape and request timing

Scenario

Product behavior

Decision or control

B01 One child; complete request

Show the eligible election, birth-date start, price change, receipt, and live case timeline.

Deterministic rules; HR approval

B02 Twins with the same birth date

Create one case and two child records; accept separate documents or one document listing both.

Repeating dependent form; duplicate check does not merge twins

B03 Twins born on different dates

Store each date and effective date separately; present one household election and reconcile both records.

Rules service and HR review

B04 Triplets or more

Repeat dependent records without forcing separate life-event cases.

Plan-configured pricing and carrier capacity validation

B05 Birth is expected but has not happened

Allow a draft and plan comparison; do not submit enrollment or claim a coverage start.

Future-event guard

B06 Complete request submitted on day 30

Preserve the employee’s submission timestamp; later HR review or batch timing does not replace it.

Authorized intake timestamp; F02

B07 Timely request but proof needs correction

Keep request receipt and evidence status separate. Use Nexa’s configured five-day correction window only as a demo policy; route expiration to HR review.

No universal federal cure-period claim

B08 Day 30 draft, blank form, or unrelated upload

Do not manufacture a timely request. Explain what was and was not submitted and route disputes for review.

Minimum-intake rule approved by plan counsel

B09 Request arrives after the configured period

Accept the case into review, show the rule and dates, and check plan extensions or administrative error.

No automatic AI denial


### Evidence and enrollment choices

Scenario

Product behavior

Decision or control

B10 Official certificate is not yet available

Accept the plan-approved hospital or provisional evidence when configured and create a later evidence task.

Plan evidence matrix

B11 Evidence is unreadable or incomplete

Identify the exact missing fact and preserve the rest of the request.

Human-confirmed extraction; no fraud label

B12 Form and evidence disagree

Show both values, block silent overwrite, and request confirmation or corrected evidence.

Daniel resolves material conflict

B13 Newborn has no SSN yet

Track SSN as pending when the carrier and plan permit it; never invent or place it in email.

Restricted follow-up task

B14 Child has a temporary name or name later changes

Submit only through the permitted carrier convention and send a versioned correction later.

Carrier-specific mapping

B15 Maya was enrolled employee-only

Offer only valid tiers and plans that can add the child; calculate contribution and deduction from rate tables.

Rules service

B16 Maya was eligible but not enrolled

Present only the enrollment choices the approved birth rule and plan allow; do not infer eligibility from the event alone.

Plan eligibility plus HIPAA enrollment check

B17 Spouse or another eligible dependent may also enroll

Show only the people and changes permitted by the applicable birth rule and plan.

Consistency and eligibility checks


### Pricing and overlapping changes

Scenario

Product behavior

Decision or control

B18 Maya already has one covered child

Add the newborn; if the composite tier and rate are unchanged, say “No change to your regular deduction.”

Never assume no change without rate lookup

B19 Composite family-tier pricing

Apply one configured tier transition, even for twins, and show the household covered under that tier.

Nexa demo model

B20 Per-dependent pricing

Later extension. Keep the rating strategy configurable; an unconfigured per-dependent plan goes to review rather than using composite rates.

Later, not a second demo pricing engine

B21 Available plan or rate changes while the case is open

Preserve the quoted decision version and require a reviewed recalculation before submission.

Versioned configuration

B22 Another QLE or open-enrollment change is already pending

Build a combined current-state view; sequence or merge changes without overwriting either request.

Case conflict task


### Carrier, payroll, and recovery

Scenario

Product behavior

Decision or control

B23 Carrier returns next-month coverage instead of birth-date coverage

Keep the case unresolved, create an effective-date correction, and show Maya that no action is required unless that changes.

Reconciliation blocker

B24 One twin is accepted and the other is rejected

Preserve the accepted child, repair only the failed record, and keep the family case open.

Member-level carrier outcomes

B25 Medical succeeds but dental fails

Complete medical while repairing dental; never roll back the successful benefit.

Benefit-level outcomes; dental rules may differ

B26 Carrier reports a duplicate child

Compare identity and prior enrollment; correct the duplicate without deleting the valid child.

Human review for ambiguous identity

B27 Batch receipt is missing or delivery times out

Mark delivery unknown, query before retrying, and use the same idempotency key.

No blind resend

B28 Callback is duplicated or arrives out of order

Record it but do not repeat or reverse a newer business action.

Case version and transaction ID

B29 Payroll cutoff has passed

Show regular deduction and catch-up separately; schedule the approved later adjustment.

Payroll calendar and posted-history check


#### Carrier, payroll, and recovery — continued

Scenario

Product behavior

Decision or control

B30 Catch-up is large, wages are insufficient, or Maya is on leave

Require an approved collection arrangement; never force a negative paycheck.

Payroll administrator approval

B31 Material fact changes after approval

Invalidate only the affected approval, keep history, and issue a versioned correction.

Audit trail and reapproval

B32 Child dies shortly after birth

Complete the valid birth-period coverage, open a sensitive linked removal workflow, and never erase the child’s history.

Specialist review; no celebratory copy

B33 Maya needs care for the child while carrier confirmation is pending

Provide the receipt and urgent support route; seek carrier verification without promising claim payment.

Human escalation


### Day 30 and evidence correction

The prototype stores four separate facts: request received, minimum intake met, evidence verified, and case approved. A complete request received on day 30 stays recorded as received on day 30 even if Daniel opens it later. The product must not claim that any upload automatically “stops the clock.” What constitutes a sufficient request and how later evidence may be cured must come from the written plan and validated administration policy. Nexa’s five-day evidence-correction window is a stated prototype assumption, not a universal IRS, HIPAA, or ERISA rule. Missing that window creates an HR decision task with a reason and audit trail; it does not let AI auto-deny the request. [S7, S9]


### Birth acceptance criteria

B-A01: one birth case can contain one or several distinct children. B-A02: a timely approved birth election uses the applicable birth-date start and a carrier mismatch prevents completion. B-A03: adoption and placement keep their own event dates and do not create duplicate enrollment. B-A04: missing provisional evidence or SSN follows an approved pending-item route without inventing data. B-A05: plan options and deductions come from versioned rules and rates, not the model. B-A06: one rejected child or benefit does not roll back a successful person or benefit. B-A07: recurring payroll and catch-up remain separate and are compared with the posted result. B-A08: Maya never sees coverage described as active before carrier confirmation and the applicable date.


## 14 Deep prototype flow two: divorce or legal separation


### Scenario and direction choice

This scenario is an isolated demo snapshot. Maya and Arjun’s divorce is final on 15 September 2026. Arjun is covered as Maya’s spouse under Nexa’s synthetic Aetna medical plan and the configured dental and vision plans. Nexa’s approved demo rule ends former-spouse coverage on 30 September. That date is a synthetic plan rule, not a universal federal rule.

Maya selects Family changes → My relationship ended. The first decision is direction:

Remove my former spouse from my Nexa plan.

I lost coverage under my former spouse’s plan.

Both situations apply.

I am not sure.

The deep flow uses the first answer. The second answer redirects to the outside-coverage loss flow. “Both” creates two linked cases with separate plan authorities, dates, and continuation responsibilities. A filed or pending divorce remains a draft unless the plan recognizes another completed event; it does not automatically terminate coverage.

The divorce fixture starts September 28 with Maya, Arjun and Leela on Family coverage for all three benefits: medical $400 + dental $38 + vision $12 = $450 per paycheck. Remove only Arjun effective after September 30; Maya and Leela move to Employee + Children from October 1: $250 + $26 + $8 = $284, a $166 decrease. There is no September refund in this standard fixture. Legal separation must not silently inherit this final-divorce policy.


### Employee happy path

1.Preload Arjun from Maya’s current covered household and ask Maya to confirm the affected benefits.

2.Collect the final divorce or qualifying separation date, the requested change, Arjun’s secure contact path if known, and whether an order affects any child’s coverage.

3.Request only the decree pages or approved evidence needed to establish names, final date, and relevant health-coverage orders.

4.The evidence assistant proposes the document type, people, date, relevant page, and any conflict. Maya confirms material facts.

5.Deterministic rules verify that Arjun is currently covered, the event is final, the change is permitted and consistent under Nexa’s written plan, the configured end date, any child-order constraint, and a possible continuation duty.

6.Show Arjun’s proposed end date, everyone remaining covered, the before-and-after tier, recurring deduction, estimated one-time adjustment, and the separate COBRA handoff message.

7.Maya submits one versioned request and receives a case number, receipt time, and tracker. Employee copy says that Arjun may receive separate continuation information and that his choices and payments remain private.


### HR, carrier, COBRA, and payroll execution

Daniel reviews the event, affected person, evidence facts, rule source, before-and-after election, proposed end date, pay impact, continuation flag, and open questions. Approval freezes the version and creates three linked tasks: carrier termination, COBRA referral, and payroll change. The tasks progress independently; a failure in one does not erase success in another.

The carrier adapter creates a termination transaction for the correct subscriber, dependent, benefits, action, and approved end date. The decree remains in protected storage and is transferred separately only when the approved carrier process requires it. The nightly batch records the case version, member transaction, idempotency key, and payload hash. Transport and syntax acknowledgments do not prove coverage ended. Reconciliation requires a matching carrier record for Arjun and confirmation that Maya’s remaining household coverage stayed correct. [S5, S18]

The restricted COBRA referral includes only the needed beneficiary, event, coverage, end-date, contact, plan, and notice metadata. The administrator’s states are referral received, election notice status, beneficiary election, initial payment, and continuation activation. Maya can see that the referral was sent and received. She cannot see Arjun’s private address, election, payments, or communications. Arjun receives his information directly. Divorce or legal separation can create continuation rights when it causes covered spouse or dependent coverage to end; the exact notice clocks follow federal rules and the plan’s procedure. [S10, S11]

Payroll calculates recurring deductions and one-time corrections separately. A scheduled instruction is not a posted result. Close the QLE only after the carrier confirms Arjun’s correct end date and remaining household coverage, payroll matches or is verified unchanged, the COBRA administrator acknowledges the referral, and no blocking issue remains. The linked continuation workflow stays open while the administrator handles notices and Arjun’s election or payment.


### Divorce and separation scenario matrix

Scenario

Product behavior

Decision or control

D01 Final divorce; spouse covered by Nexa

Remove only the former spouse, calculate the plan-specific end date, start carrier, payroll, and COBRA work.

Standard divorce-removal path

D02 Maya lost coverage under Arjun’s outside plan

Redirect to loss of other coverage; do not create a Nexa termination or Nexa COBRA referral.

Direction-of-coverage check

D03 Both spouses lose coverage in different plans

Create linked removal and enrollment cases with separate authorities, dates, and statuses.

No merged legal decision

D04 Divorce filed but not final

Save a draft and explain what event or plan rule is still needed.

Future or incomplete event guard

D05 Legal separation does not end eligibility under Nexa’s plan

Route to plan review and keep current coverage until an authorized decision.

Plan-specific eligibility

D06 Arjun was never covered under Nexa

Update household records if needed; create no carrier, payroll, or COBRA transaction.

Coverage-impact check

D07 Decree requires a child to stay covered

Preserve the child and remove only the person the plan permits.

Court-order review

D08 Maya’s date conflicts with the decree

Show both values, retain the source page, and request confirmation.

No silent overwrite

D09 Evidence is missing, incomplete, or unreadable

Preserve the request and ask only for the missing fact under the approved process.

Evidence and timeliness remain separate

D10 Request arrives on the final configured day

Preserve the server receipt; later HR review or batch timing does not replace it.

Authorized intake timestamp

D11 Request arrives late

Open specialist review; AI cannot deny, backdate, or promise an exception.

Plan, notice, administrative-error, and counsel review

D12 Arjun’s current address is unknown

Create a restricted contact-verification task and follow the approved notice process.

Maya is not the delivery channel

D13 Protective order or safety concern

Hide contact fields from unauthorized roles and use the approved protected communication route.

Case-level access restriction

D14 Medical ends but dental or vision remains

Preserve the successful benefit and correct only the failed or separately governed benefit.

Benefit-level outcomes

D15 Carrier returns the wrong end date

Keep the case open, create a versioned correction, and block stale results from closing it.

Reconciliation blocker

D16 Carrier delivery is unknown or a response is duplicated

Investigate before replay; idempotency and version checks prevent duplicate or backward changes.

Reliable delivery controls

D17 Claims exist after the proposed retroactive end

Pause automated financial corrections and route to the carrier, plan owner, payroll, and counsel.

No automated claim decision

D18 Payroll changed before carrier confirmation

Keep the systems separate, show the exposure, and correct the side that does not match the approved outcome.

Payroll and coverage are independent states

D19 COBRA administrator does not acknowledge receipt

Escalate to a backup owner and keep the handoff unresolved.

Sending is not completion

D20 Maya withdraws after transmission

Create a new correction version and reconcile carrier, payroll, and notice consequences.

Never erase a sent action


### Six-month-late divorce report

A late report does not create a universal right to six months of premium refunds, and the product must not assume that the carrier will accept a retroactive termination. Record the true event date and current report date, preserve the original coverage history, and create a specialist case that separates carrier premiums, employee deductions, paid claims, and COBRA notices.

Request a versioned retroactive-termination review through the contracted carrier process. If the carrier accepts a revised end date, record any carrier credit, claims handling, payroll correction, ACA history correction, and revised continuation record separately. If the carrier rejects it, preserve the carrier’s actual coverage period, record the contract or state-law reason, show the employer’s exposure, and wait for an authorized payroll decision before promising any employee refund. The plan administrator and counsel must review missed notices, administrative error, inconsistent treatment, prior-tax-year corrections, and any claim impact.


### Divorce acceptance criteria

D-A01: the direction question sends outside-plan loss to the loss workflow. D-A02: the approved removal contains the correct person, benefits, and plan-configured end date. D-A03: carrier receipt alone cannot close coverage. D-A04: remaining family members are reconciled after Arjun’s removal. D-A05: the COBRA referral has a separate restricted record and Maya cannot see Arjun’s election or payments. D-A06: a wrong end date, silent administrator, or benefit-level failure keeps only the affected task open. D-A07: a six-month-late report cannot create an automatic backdate or refund. D-A08: documents, addresses, and private former-spouse communications follow minimum-necessary access.


## 15 Deep prototype flow three: loss of other health coverage


### Happy path

Maya is enrolled alone at Nexa. Arjun’s employment ends on 12 October, but his prior employer’s notice says coverage ends on 31 October. Maya selects Loss of other health coverage, chooses Spouse lost coverage after employment ended, identifies everyone losing coverage, enters the loss date, and uploads the approved notice. The product uses the actual coverage end, not the last workday. It checks that the people were otherwise eligible for Nexa coverage, that the prior coverage and any required prior waiver statement are present, and that the request is timely under the configured plan. It then shows permitted choices and the effective date returned by the ordinary-loss rule. [S7, S8]

Daniel reviews the rule result and approves. The same nightly carrier, acknowledgment, reconciliation, and payroll loop follows. If the expected start could leave a gap, the interface states the dates and routes support; it does not promise gap-free coverage. An offer of COBRA from Arjun’s old plan does not become a Nexa enrollment decision, and this product does not administer that outside COBRA plan.

The loss fixture starts October 31. Nexa explicitly permits this documented advance request while Arjun’s outside coverage remains in force through that day, so the requested start is November 1. Maya elects spouse coverage in all three benefits: medical $150 → $300, dental $12 → $24, vision $4 → $8; total $166 → $332, a $166 increase. Early-November carrier confirmation does not shift the approved start to December. There is no catch-up if the first affected run uses the new amount. A first request on November 2 instead returns December 1 under the base next-month rule, highlights the possible gap, and offers review for an approved earlier-start provision.


### Screen sequence and outputs

1.Choose event. Maya selects Other health coverage → Coverage ended → My spouse → Employment ended. The guided questions keep outside-plan loss separate from removing someone from Nexa.

2.Enter coverage facts. Collect the people losing coverage, prior employer and carrier, last workday, actual coverage end date, reason, remaining coverage, COBRA offer, and relevant prior-enrollment or waiver context. Display last workday and coverage end as different fields.

3.Provide evidence. Upload the plan-approved loss notice or other accepted proof. Extract the affected people, coverage type, end date, and reason for confirmation. No universal carrier-issued letter format is assumed.

4.Evaluate rules. Deterministic code checks Nexa eligibility, actual loss type, prior coverage, any valid prior-waiver condition, request timing, applicable 30- or 60-day rule family, available benefit packages, and the written Section 125 plan.

5.Choose coverage. Show only the people and options permitted by the result. Display the requested Nexa start date, the outside-plan end date, any visible gap or overlap, contribution, and projected payroll effect.

6.Review and submit. Maya confirms the affected people, evidence status, plan election, dates, and cost. The server creates one receipt and case version.

7.HR decision. Daniel sees the loss reason, date evidence, prior-coverage facts, rule result, election, and unresolved questions together. Missing facts create targeted tasks; approval freezes the version.

8.Carrier and payroll execution. The approved addition enters the nightly carrier route. Person- and benefit-level results are reconciled before payroll is marked complete.

9.Track and complete. Maya sees who is acting, whether coverage is awaiting confirmation or active on a future date, which paycheck will change, and any urgent support path. Carrier silence never becomes coverage confirmation.


### Loss reasons supported by the rules model

Loss reason

How the product classifies it

Required check

Employment ends

Potential ordinary loss of eligibility

Use actual coverage end. Being fired for cause is not itself the exclusion for plan coverage terminated for fraud or material misrepresentation. [S7]

Work hours are reduced

Potential ordinary loss of eligibility

Confirm it caused coverage to end

Divorce or legal separation

Potential loss for the person who was covered under the former spouse

Confirm whose plan ended and whether the plan actually ends eligibility

Covered employee or policyholder dies

Potential loss for surviving spouse or dependents

Confirm survivor eligibility and separate continuation duties

Dependent status ends, including age limit

Potential ordinary loss of eligibility

Use the plan’s actual end date and state or disability-extension rules

Move outside an HMO service area

Potential loss when no other benefit package is available

Distinguish individual- and group-market service-area conditions; for group coverage, check whether another benefit package remains available. [S7]

Plan stops benefits for a similarly situated class

Potential ordinary loss

Confirm the person is in the affected class

Employer stops contributing to the other coverage

Potential qualifying loss even if the person could pay the full cost

Confirm contribution termination and applicable plan rule

COBRA coverage is exhausted

Potential qualifying loss

Confirm the maximum period or another recognized exhaustion condition; voluntary cancellation is different

Medicaid or CHIP coverage ends

Separate 60-day employer-plan special-enrollment route

Use the dedicated statutory rule, not the ordinary 30-day configuration


### Loss situations that do not automatically qualify

Situation

Product response

Why

Coverage ended for failure to pay premiums

Explain that ordinary HIPAA loss treatment excludes nonpayment and route any other possible plan right for review.

Not an ordinary loss of eligibility under the federal rule [S7]

Coverage was terminated for cause or fraud

Do not present automatic approval; route to the authorized administrator.

Excluded from ordinary loss of eligibility [S7]

Person voluntarily cancelled coverage

Ask why and assess another permitted rule if applicable; do not label it qualifying merely because coverage ended.

Voluntary cancellation is not itself the listed ordinary loss

Person stopped COBRA before exhaustion or stopped paying

Do not treat it as COBRA exhaustion.

Exhaustion and voluntary termination are different [S7]

Premium increased but coverage remained available

Route to a separate Section 125 cost-change review if the written plan permits it.

It is not automatically a HIPAA loss of eligibility [S9]

A preferred doctor left the network

Offer support and check another rule, but do not call this loss of coverage.

Coverage itself did not necessarily end

Marketplace plan change is requested

Keep Marketplace rules separate; eligibility, before/after windows and exceptions depend on the event. Route to the appropriate Marketplace help rather than reusing Nexa’s clock.

This product is administering Nexa’s employer plan [S23]


### Loss of coverage scenario matrix


### Loss reason and future events

Scenario

Product behavior

Decision or control

L01 Spouse loses coverage after job termination

Use the coverage-end date, affected people, prior plan, and accepted proof; present permitted Nexa options.

Ordinary-loss rule

L02 Hours reduction causes coverage to end

Treat as potential eligibility loss after evidence confirms the causal end date.

Rule and evidence check

L03 Divorce removes Maya from Arjun’s outside plan

Let Maya request Nexa enrollment; do not create a Nexa removal or Nexa COBRA case for a plan she never had.

Direction-of-coverage check

L04 Divorce removes Arjun from Maya’s Nexa plan

Route as a Nexa dependent removal with a separate potential COBRA handoff; do not call it Maya’s outside-coverage loss.

Linked but distinct workflow

L05 Policyholder dies

Support the survivors’ loss request with sensitive copy and separate any continuation obligations.

HR review

L06 Child reaches the plan’s dependent age limit

Incoming outside age-off can use the loss flow. Outgoing Nexa age-off is a separate assisted removal/continuation route; proactive monitoring is P1.

P1 monitoring; no automatic removal at 26

L07 Dependent requests continued coverage due to disability

Collect only approved evidence, restrict access, and route to the carrier or administrator; AI cannot decide disability.

Assisted review now; full extension workflow P1

L08 Move outside HMO service area

Confirm a qualifying service-area eligibility loss and the alternatives required for that prior plan type; a move alone is insufficient.

Service-area rule

L09 Other plan ends coverage for an employee class

Confirm the class and end date; avoid interpreting an individual billing error as plan termination.

Administrator evidence

L10 Other employer stops its contribution

Show potential qualification even if full-price coverage could continue, subject to the approved rule.

Contribution-loss rule

L11 COBRA reaches its allowed exhaustion

Confirm the exhaustion notice and date; present Nexa choices if the person is otherwise eligible.

Exhaustion validation

L12 COBRA was cancelled early or unpaid

Do not classify as exhaustion; keep a review route for another applicable right.

No automatic approval

L13 Medicaid or CHIP ends

Apply the separate 60-day request rule and evidence path.

Dedicated rule family


### Timing, evidence, and household decisions

Scenario

Product behavior

Decision or control

L14 Employee knows future coverage will end

Allow advance preparation or a request if the approved plan supports it; do not claim active Nexa coverage early.

Future-loss configuration

L15 Last workday and coverage-end date differ

Use the actual coverage end for the loss rule and display both dates.

Prevents avoidable gaps and wrong dates

L16 Request is submitted on the final configured day

Preserve the receipt; HR processing or nightly transfer can occur later without replacing it.

Authorized intake timestamp


#### Timing, evidence, and household decisions — continued

Scenario

Product behavior

Decision or control

L17 Timely request has missing or rejected proof

Preserve the request and open the configured correction process; distinguish evidence review from timeliness.

Human decision after correction period

L18 Request is late

Accept it into exception review with dates and source; do not let the model deny it.

Plan extension, administrative error, or counsel review

L19 Required prior waiver statement is absent

Check whether the plan validly required and disclosed it before using it; otherwise escalate.

Plan-document validation [S7]

L20 Maya did not actually have the stated prior coverage

Explain the mismatch and route another eligibility path; do not create a false loss.

Prior-coverage fact check

L21 Several household members lose coverage

Use one case with separate affected-person records and individual eligibility outcomes.

Person-level decisions

L22 Only one of several coverages ends

Check whether another active coverage changes the applicable right; do not assume qualification or rejection.

Administrator review for overlapping coverage

L23 One household member remains ineligible for Nexa

Preserve eligible additions and explain the ineligible person separately.

Partial decision; no all-or-nothing case

L24 Exact end date is unknown or documents conflict

Keep the case pending, show the conflicting values, and request targeted evidence.

No guessed effective date


### Carrier, payroll, and rule changes

Scenario

Product behavior

Decision or control

L25 Carrier returns an effective date that conflicts with the approved loss rule

Keep the case open and issue a versioned correction.

Reconciliation blocker

L26 Medical succeeds while another benefit fails

Preserve medical and repair only the failed benefit under its own rules.

Benefit-level result

L27 Carrier or broker is silent

Show owner and elapsed time, send reminders, escalate to backup operations, and never infer active coverage.

F07, F10

L28 Maya needs care during a potential gap

Provide receipt and urgent support, seek verification, and explain known dates without guaranteeing claims.

Human escalation

L29 Payroll already deducted the old amount

Calculate the authorized correction from posted history and show refund or catch-up separately.

Payroll review

L30 Plan, rate, or eligibility configuration changes while open

Freeze the decision version, identify impact, and require recalculation or reapproval.

Versioned rules

L31 State law or the plan is more generous than the federal floor

Apply the approved employer configuration and route unknown conflicts for legal review.

Federal minimum is not the full rule set

L32 Carrier asks for a document the approved policy does not support

Escalate the conflict; do not automatically impose a new employee requirement.

Plan administrator and carrier owner


### P1: proactive age-26 and disability review

After the three core flows, add monitoring of covered-dependent birth dates against approved plan rules. Until then, provide an assisted route or clearly labeled seeded review case. A future implementation creates an advance task, sends configured reminders, shows the expected plan end, and confirms contact details; it does not ask the employee to blindly delete a child on a birthday. Federal law generally requires dependent coverage availability to age 26, not a universal prohibition on coverage afterward. Exact end dates and extensions need plan and state review. [S22]

If continued coverage for a dependent with a disability may apply, the product starts the plan-approved evidence route early. Documents are restricted to the reviewers who need them. Emma may summarize a checklist or extract proposed dates; it cannot diagnose disability or make the eligibility decision. If extension is approved, the age-off transaction is cancelled with history preserved. If it is denied or does not apply, the system sends the configured carrier removal, tracks confirmation, recalculates the household tier, and starts the applicable COBRA or state-continuation handoff. Loss of dependent status can allow up to 36 months of COBRA continuation where federal COBRA applies, but the actual notice and administration remain with the authorized COBRA administrator. [S10, S11, S22]


### Shared execution and safety exceptions

Exception

Required behavior

Owner and control

E01 HR does not respond or is absent

Remind, assign the backup, and escalate to partner operations while preserving the employee receipt.

Operations; F07

E02 Employee does not answer a correction request

Send proportionate reminders, retain history, and obtain an authorized decision; do not silently delete the case.

HR; F07

E03 Full carrier batch is rejected

Retain each record, expose the shared cause, correct it, and send a versioned batch.

Operations; F08

E04 One person or benefit fails

Preserve successful results and retry only the failed transaction.

Operations; F08, F10

E05 Transfer outcome is unknown

Investigate before retry and retain idempotency keys.

Operations; F08

E06 Portal task is marked complete but coverage evidence is absent

Keep status at awaiting carrier confirmation.

Broker; F09, F10

E07 Employee withdraws after carrier submission

Treat it as a versioned correction; confirm carrier and payroll outcomes before showing reversal.

HR and broker

E08 Employment ends while the QLE is pending

Re-evaluate eligibility and continuation without overwriting the original event.

HR and plan administrator

E09 Retroactive correction affects paid claims or a prior tax year

Pause automated finance actions and obtain carrier, payroll, plan, and legal review as needed.

Authorized specialists

E10 Wrong person or employer receives access

Deny access, contain the issue, preserve security evidence, and follow incident response.

Security owner

E11 Emma fails, contradicts a rule, or follows instructions inside evidence

Keep the deterministic flow available; reject document-borne commands and use approved sources.

AI service and HR

E12 Browser or server fails during submission

Preserve valid input and use an idempotent request to return the existing case or safely retry.

Application


### Loss acceptance criteria

L-A01: the actual outside coverage end date drives the loss evaluation; the last workday remains visible but cannot replace it. L-A02: voluntary cancellation, nonpayment, fraud-related termination, and early COBRA cancellation do not receive automatic ordinary-loss approval. L-A03: Medicaid or CHIP uses its separate 60-day route. L-A04: one case can contain several affected people with separate eligibility outcomes. L-A05: a future loss is prepared only when the approved plan supports it and is never called active early. L-A06: HR and carrier delays preserve the original employee receipt. L-A07: a wrong carrier date, silent broker, partial benefit failure, or payroll mismatch keeps the affected task open. L-A08: a six-month-late request enters review without a promised retroactive start, refund, or denial from AI.


## 16 AI behavior and model requirements


### F14 Emma assists within a controlled workflow

User story. As Maya or Daniel, I want help understanding and completing a case without losing control of the underlying decisions.

Use one workflow service with a small set of AI capabilities. There is no need for a swarm of agents reviewing each other. A second model’s agreement is not independent evidence of legal correctness. The trusted checks are approved rules, source records, validation code, and accountable people.

AI capability

Input and output

Boundary

Explain a rule

Retrieve approved employer documents; return a short explanation with document, section, version, and relevant date

If sources are missing or conflict, say so and offer review.

Read evidence

Propose event facts with source page or span and uncertainty

Do not certify authenticity or overwrite confirmed fields.

Compare plans

Use eligible options and voluntary preferences to explain tradeoffs

Do not guarantee medical outcomes, network status, or the cheapest total cost.

Summarize a case

Present confirmed facts, open questions, and proposed next actions

Separate observed facts from inferred explanations.

Prepare a follow-up

Draft a specific information request or summarize a carrier error

No sensitive attachments in ordinary email; send only through an authorized action.

Suggest a correction

Identify a mismatch and propose the permitted next task

Code or an authorized person must validate the action before execution.


### AI workers and triggers

These are bounded workers inside one authorized workflow service. They share the case contract and audit log; they do not run an open-ended multi-agent loop.

Worker

Trigger and data

Output and required control

Emma guide

Employee question plus approved current plan passages

Plain-language answer with source and “cannot confirm” path; no eligibility mutation

Event router

Employee description and selected people

Proposed event code and next question; employee confirms or chooses assisted review

Evidence assistant

One permitted document and its case context

Proposed fields, source page or span, and uncertainty; human confirms material facts

Case readiness assistant

Confirmed facts, deterministic rule results, and open tasks

Short HR summary of passed checks, conflicts, and missing items; no compliance score

Carrier packet assistant

Approved case version and carrier mapping

Validated proposed payload or exact missing field; workflow authorization is required to queue it

Reconciliation monitor

Approved intent plus carrier and payroll observations

Field-level match or mismatch and a proposed correction task; cannot edit external records

Reminder worker

Deterministic task due time, owner, and status

Approved notification or escalation; cannot extend legal time or reveal sensitive event details


### Knowledge and rule setup

Store the approved plan document, relevant amendments, summary plan description, benefit summaries, rate tables, and carrier requirements with owner, employer, benefit, effective period, and version. Retrieval must filter by tenant and applicable date before finding relevant text. Do not retrieve a different employer’s plan because the wording looks similar.

This is grounded retrieval, not “training Emma on the company” in the sense of updating model weights. Plan documents are untrusted input for tool instructions even when they are useful policy evidence. Document text cannot tell the agent to ignore permissions, disclose records, or send a payment.

Do not use raw QLE cases, uploaded evidence, prompts, or model outputs to train a general model. Production evaluation data requires an approved de-identification, retention, access, and vendor process. Store the minimum prompt and response metadata needed for audit and quality review, with sensitive content separated from ordinary application logs.

Legal and plan rules are configured and approved separately from the conversational explanation. If sources disagree, the product records the conflict and routes it for resolution. Do not let an LLM choose which legal authority wins from prose alone.


### Model and execution needs

Use the configured server-side AI provider and a model identifier confirmed to be available in that account. A coding-assistant subscription is not an application API credential. Keep provider and model configurable, validate one synthetic request, and do not invent a “latest” model or “OpenAI 5.5” identifier. An unavailable model must leave manual input, submission, rules, and human review working.

Required capabilities are reliable structured output, document reading or an approved OCR path, source-grounded explanation, and bounded tool calls. Responses follow a schema containing the answer, evidence references, uncertain fields, and proposed actions. Validate that schema and all permissions on the server. Set timeouts, a bounded retry count, output limits, and a per-case cost budget. Do not allow an open-ended self-correction loop to hold submission hostage.

In production, real sensitive data can be processed only through an approved provider and service configuration with the necessary contracts and controls. Verify the complete chain, including OCR and observability vendors. Do not assume consumer chat settings, an ordinary developer account, or a promise not to train is sufficient. [S12–S15]


### Tool permissions and visible AI activity

Emma may read scoped facts, preview a calculation, propose a task, or draft a message. A review request is created only after the user confirms and the ordinary case API authorizes it. Emma cannot approve, decline, terminate, post payroll, change access, contact arbitrary recipients, or mutate external records.

Validate a response schema with answer, sourceRefs, proposedFacts, uncertainFields, and proposedActions. Policy answers identify document title, section/page or record, version, and relevant date. Reuse deterministic numeric output rather than model arithmetic. Missing sources produce “I cannot confirm that from the available documents” with a review action.

The activity panel shows actual work and timestamps: document read, facts proposed, facts confirmed, summary prepared. Call deterministic checks Rule check or Reconciliation check. Do not display fictional background agents, invented confidence percentages, or hidden reasoning. No case document is sent to public web search. Suspected alteration prompts proportionate verification and alternate evidence, not an automatic fraud accusation.


### Acceptance and evaluation

F14a: each policy answer either points to an approved current source or explicitly says the answer cannot be confirmed. F14b: a document instruction to disclose another case is ignored and denied. F14c: a model timeout leaves save, submission, and human review available. F14d: numeric deductions and deadlines come from the rules service. F14e: the model cannot execute unapproved enrollment, termination, payroll, or access changes.

Before the demo, use synthetic examples covering a clear document, unreadable document, conflicting date, wrong-employer plan, outdated plan, late request, missing evidence, and malicious embedded instructions. Check field accuracy and source correctness, not whether the answer merely sounds fluent. In a pilot, maintain labeled examples and review all critical errors; no universal “confidence above 90 percent” threshold authorizes a benefit action.


## 17 Regulatory requirements and validation

This section separates the legal baseline I am confident about from product policies that need approval. It is a design risk map, not a claim of legal sign-off.


### HIPAA special enrollment

For applicable employer medical plans, the federal rules provide special-enrollment rights for specified events. Marriage, birth, adoption or placement, and qualifying loss generally have at least a 30-day request opportunity; Medicaid or CHIP loss and premium assistance have a 60-day route. Timely birth, adoption, and placement enrollment has the event-date effective rule. Marriage and ordinary loss have different timing rules, generally no later than the first day of the first calendar month after the completed request is received. [S7, S8]

Product requirement: keep separate rule families, timing fields, and effective-date calculations. Validate a plan’s more generous provisions and applicable state protections. An internal HR delay must not replace the employee’s recorded receipt date. Counsel must confirm the authorized intake, what constitutes a sufficient request, and how missing evidence is handled.


### Section 125 cafeteria plan

Section 125 governs the tax-favored election arrangement; “cafeteria plan” describes that arrangement rather than a separate competing law. Permitted midyear election changes depend on the written plan and the applicable conditions, including consistency between the event and the change. A change affecting one dependent does not justify unrelated cancellation for everyone. [S9]

Product requirement: evaluate enrollment rights and pretax election permission separately. A plan omission or conflict goes to the administrator for resolution rather than silently erasing enrollment rights. FSA and HSA handling needs separate rules and is not automatically copied from medical.


### COBRA

COBRA continuation is a separate obligation when the relevant event causes loss under an applicable group health plan. The plan administrator has notice responsibilities, and qualified beneficiaries may have their own event-notification duties. The timing depends on the event and the administrator arrangement. [S10, S11]

Product requirement: start and track the correct referral without waiting for new enrollment or payroll. Validate the notice rules, beneficiary contact, third-party agreement, and state continuation requirements before a pilot. Employer size assumptions do not replace that review.


### ACA and other plan requirements

ALE status uses the relevant prior-year full-time and full-time-equivalent workforce, subject to applicable rules. Our event history supports the platform’s reporting process; it does not replace offer, affordability, or reporting determinations. [S6, S19]

Dental and vision may be excepted benefits and need not follow the identical HIPAA special-enrollment rules used for medical. They may still have separate plan or continuation obligations. [S20] ERISA plan administration and any applicable denial or appeal process also remain with the authorized administrator. Do not invent a universal appeal period in the UI.


### PHI and PII

HIPAA applies based on the entity, role, and data use; not every HR record is automatically PHI. Treat all QLE evidence as sensitive and determine which flows involve the group health plan or its business associates. Applicable use of cloud services for ePHI requires appropriate arrangements and safeguards, including a BAA where required. [S12–S15]

Product requirement: employer isolation, field-level role access, protected storage, encrypted transport, audited access, short-lived document links, controlled support access, and retention rules. Payroll gets the instruction it needs; the broker gets the assigned enrollment task; the COBRA administrator gets the required beneficiary and event information. Ordinary notifications and analytics should not contain the evidence itself.

Retention is configured with counsel and contractual requirements. “HIPAA requires keeping every uploaded document for six years” is not a safe blanket product rule. Security documentation, benefit records, carrier agreements, and employee evidence may have different requirements. Incident detection, response, and breach analysis need a production owner.


### State-specific cases and changing rules

Current build: federal baseline plus synthetic employer-plan rules. There is no implemented state pack and no list of “excluded states” assumed to remove legal obligations. Capture sponsor and funding type, policy state, employee work and residence states, dependent residence when relevant, benefit, policy, and dates. These facts identify possible state review; they are not a legal conclusion by themselves.

Each seeded scenario states “Jurisdiction suitability assumed for synthetic demonstration.” If that context changes or conflicts with an approved configuration, preserve intake and receipt, create State rule review required, assign a reviewer, and block automated execution until a documented applicable decision exists. Plan service area is a separate check; a New York employer address does not establish that a California employee can use every plan.

Production expansion: counsel validates a small number of supported employer/policy configurations first. A rule-intake process can monitor official publications or available feeds; do not assume every regulator offers webhooks. AI can summarize proposed changes, but a named owner approves the source, interpretation, version, effective date, tests, and affected-case review before release. An update flags impacted cases; it never silently rewrites approved or posted history.


## 18 Technical design for the prototype


### Proposed stack

Use the prepared Claude Code environment with TypeScript and the existing web framework setup, a Next.js application if that is the repository’s configured framework, Supabase for structured records and private files, and Vercel for the preview. Use the existing design system and components. Confirm the repository before changing dependencies; the product requirements do not depend on a framework migration.

Keep the model call server-side. Public client keys must have the intended limited permissions; secret service keys, model keys, and deployment tokens stay server-side. This is an implementation recommendation for synthetic demo data, not a statement that default service tiers are approved for production PHI.


### Implementation contract for Claude Code

Keep the repository’s existing framework and package manager; use Next.js/TypeScript if already prepared. Implement one modular application with shared typed domain contracts, deterministic services, repositories and adapters. Prefer Supabase Postgres and private Storage, with server-side role/tenant checks plus RLS. Confirm connectivity and actual migration access. A project URL and key do not automatically provide SQL migration authority. Do not rebuild the framework or create microservices for this demo.

Create a domain layer for event codes, case and task states, rule results, dates, money in integer cents, and integration contracts. Create a services layer for rules, evidence, workflow transitions, carrier mapping, reconciliation, payroll, COBRA referral, notifications, and audit. Put simulated external responses behind the same adapter interfaces a real connection would use. Every mutation accepts the current case version and an idempotency key.

Use synthetic seeded files and structured facts for the default demonstration. A real model call is optional to case correctness: if it fails, the form, deterministic rules, HR review, and simulation still work. The UI must label simulated carrier, payroll, email, and COBRA results in the operations view.

Fallback: a persistent local server with SQLite and protected files is acceptable if Supabase cannot be used promptly. State the mode and preserve data; local files or memory are not durable storage on Vercel serverless. Do not silently switch stores. Hosted preview should use the configured remote database. Secret Supabase clients can bypass RLS, so server-side scope checks remain mandatory. [S24, S25]

Check secret presence and connectivity without printing values. Use existing authorized credentials; never invent live API keys or put secrets in NEXT_PUBLIC variables, files, fixtures, screenshots, or Git. Previously exposed keys must be rotated before use. .env.example lists names and placeholders only; deployment tokens are not browser or application credentials.


### Logical components

1.Employee and HR interfaces read role-scoped case views.

2.The case API validates inputs, identity, employer, permissions, and case version.

3.The rules service calculates timing, available changes, dates, and deductions from approved configuration.

4.The workflow service records transitions, creates tasks, and schedules approved delivery jobs.

5.Carrier adapters translate the same approved change into the configured API, feed, or manual route.

6.Reconciliation compares carrier and payroll evidence with the approved intent and creates exceptions.

7.The AI service reads only permitted facts and documents, then returns explanations or proposed actions.

8.The notification worker and audit log record who needs to act and what happened.


### Records and source ownership

Record

Source of truth

Important fields

Employee and household

Host platform, with a confirmed case snapshot

Employer, identity, employment status, dependents, existing elections

Plan and rule version

Approved employer configuration

Benefit, period, eligibility, deadline, effective-date policy, rates, evidence rules

QLE case

Our service

Event, affected people, received time, version, decision, owner, linked tasks

Evidence

Protected document store

File identifier, access scope, extracted facts, reviewer, source version

Approved election

Our case record plus host acknowledgment

Person, benefit, before and after, dates, approval actor and time

Carrier change and result

Adapter records; carrier is authoritative for its coverage data

Submission reference, delivery state, member outcome, source and observed time

Payroll instruction and result

Host payroll system for actual posting

Recurring amount, adjustment, pay period, approval, posting or rejection

Audit and notification

Our service

Actor, action, record version, time, reason, recipient role, delivery status

These are build contracts, not schemas claimed to exist before the interview. Records require stable IDs and partner, employer, and scenario scope. Separate personId from subscriberId; benefits from carriers; requested/approved lines from observed carrier lines. The same persisted records serve all roles. Multiple employers under one platform remain isolated.


### Minimum prototype data model

Table or aggregate

Purpose

Required relationships or fields

employers and users

Tenant and role boundary

employer id, role, external subject, active status

people and household snapshots

Employee and dependent facts at a case version

person id, relationship, dates, masked identifiers, source version

plans, rates, and rule versions

Approved configuration used for a decision

benefit, period, eligibility, event rule, evidence rule, rate, owner, effective dates

qle cases and case people

Employee request and affected people

event code, direction, received time, employer timezone, status, version, owner

elections and calculations

Before and after intent

person, benefit, plan, tier, coverage dates, recurring cents, adjustment cents, inputs

evidence and extracted facts

Protected files and reviewed proposals

storage id, access scope, fact, source page, confidence for review, confirmer

approvals, tasks, and decisions

Accountable workflow actions

case version, actor, reason, due time, status, superseded link

carrier transactions and results

Every delivery attempt and observed business outcome

route, batch id, operation key, attempt id, payload hash, member status, observed date

payroll instructions and results

Proposed and posted deductions

pay period, recurring amount, adjustment, approval, external reference, mismatch

cobra referrals

Restricted continuation handoff

beneficiary, event, loss date, administrator status, private contact scope

notifications and audit events

Communications and append-only business history

recipient role, template, delivery status, action, actor, timestamp, version


### Additional shared records and clocks

Persist partner and employer memberships; scenario clocks; plans, rates and versioned policy sources; jurisdiction reviews; household snapshots; proposed and confirmed facts; approvals and issues; carrier transactions, attempts, inbox events and independent observations; payroll obligations, instructions, allocations and posted payslips; restricted continuation events; notification outbox and delivery attempts. Tables may be combined where relationships and audit behavior remain intact.

Birth, Divorce and Loss are separate scenarioIds. Switching preserves each snapshot. An explicit confirmed reset affects only that scenario’s synthetic rows and files. The server owns simulated business time and stores it separately from real ingestion time. Advance-clock runs due jobs through normal transitions; it does not fabricate completion. Use database uniqueness for business operation keys, external event IDs and notification keys.


### API and mutation behavior

POST /api/session/demo creates a signed/provider-managed session for a predefined demo identity. GET /api/employee/benefits and /api/employee/pay return current data separately from proposed and scheduled changes.

POST /api/qle/cases creates a draft idempotently. PATCH /api/qle/cases/:id edits the current draft/revision. POST /evaluate returns checks, allowed choices, dates, missing facts and cost preview.

POST /api/qle/cases/:id/evidence authorizes a private upload and extraction task. POST /submit validates minimum intake, stores receipt/version and creates HR work. POST /respond answers an exact information request in the same case.

POST /api/admin/qle/:id/request-information, /approve, /decision and /escalate execute role-checked transitions. Approval records the version, authorization, audit and outgoing tasks together.

POST /api/demo/batches/run processes due authorized jobs. POST /api/demo/carrier-events ingests operator-authenticated transport, file, member or coverage events through the normal adapter.

POST /api/demo/payroll/run and /api/demo/payroll-events accept instructions, post runs or publish mismatches. POST /api/demo/cobra-events advances only the restricted handoff stage supplied.

POST /api/demo/clock/advance advances the selected business clock and runs due jobs. POST /api/emma retrieves scoped sources and returns validated assistance, not unrestricted mutations.

GET /api/qle/cases/:id, /api/notifications and /api/documents/:id return authorized projections and protected downloads. Employees never receive private former-spouse fields merely hidden by CSS.

Equivalent typed server actions are acceptable. Mutations carry idempotencyKey and expectedVersion. Derive actor, partner and employer from the verified session, not browser claims. Return ID, version, state and created task/event references. Use safe 400/401/403/404/409/422 errors with field details and next action; no raw stack traces or secrets.

Carrier events include eventId, transactionId, caseVersion, personId, benefit, eventType, carrierReference, observedAt and payload. Reject unknown or mismatched references; consume duplicate events once. A stale result remains in history without overwriting a newer approved correction. A concurrent edit returns a 409 with a safe current summary, not last-write-wins behavior.

A simulated host adapter reads employment/plan/payroll snapshots and accepts authorized election/payroll updates with operation keys. Store host acknowledgment separately. Realtime, server events, or short polling with refetch-on-focus updates other role views after persistence. A live carrier or partner integration is not implemented merely because these interfaces exist.


### Reliability and security invariants

Persist the approved case transition and its queued work reliably together. A crash must not approve a case without any delivery job or send a change with no approval record.

Use a stable business operation key and separate delivery-attempt identifiers. Retries can happen more than once; their business effects must not be duplicated.

Version changes and apply concurrency checks. Two HR reviewers must not silently approve conflicting edits.

Authenticate real callbacks, reject replay where applicable, and store response identifiers. Never trust a browser to impersonate a carrier result.

Keep evidence private, enforce access on the server, and use row-level controls as defense in depth. Hiding a button is not authorization.

Record business facts and actions without placing raw sensitive documents or full prompts in general logs. Keep audit evidence append-only for ordinary users.

Use a durable worker or scheduler for real background work. The prototype can run a deterministic simulator; a browser tab is not a production scheduler.


### Demo sessions and access boundaries

Seed Maya (maya@nexa.example), Daniel (daniel@nexa.example), Priya (priya@broker.example), carrier operator (carrier@demo.example), and COBRA administrator (cobra@demo.example). “Continue as” is an intentionally limited demo entry for predefined fictional users; the server creates and verifies the session. If a password UI is used, actual seeded auth must validate it. Do not accept any password or a browser-supplied arbitrary admin role.

Maya sees her own case and permitted household records; Daniel sees Nexa; Priya sees assigned tasks; the carrier operator sees the synthetic group inbox; COBRA sees assigned beneficiaries. Payroll receives instructions, not unrestricted evidence. Test scopes server-side, including direct API requests. Demo identity selection is not a claim of production authentication.

Production embedded integration would verify the host identity and exchange it for a scoped session, while the host remains the data source. A secure SSO redirect is a faster pilot alternative but is not the chosen seamless embedded experience. Real partner SSO and onboarding contracts are launch gates, not assumed to exist in the demo. No public employer signup, fake reset-password, or nonfunctional SSO buttons.


### Nonfunctional acceptance

NF01: refresh preserves every submitted case and decision. NF02: a worker retry does not duplicate a carrier change, notification, or deduction. NF03: cross-employer and unassigned-broker access is denied. NF04: an AI failure does not block the ordinary form or queue. NF05: keyboard navigation, visible focus, labeled fields, and readable status text work on the main journey. NF06: submission and approval errors preserve context and offer a safe retry. NF07: the operator simulator is unavailable as an ordinary employee action.

Target a responsive interface with visible progress for slow uploads or AI calls. Measure actual latency during rehearsal instead of inventing a production SLA from a demo.


## 19 Demo acceptance and test plan


### Global definition of done

A prototype flow is complete only when the employee can submit it, HR can make and explain a decision, the approved version can be delivered through the simulated configured route, the carrier result can be reconciled at person and benefit level, payroll can be compared with the approved instruction, and the employee tracker reflects the real state. Divorce additionally requires a restricted COBRA referral with acknowledged ownership. Refreshing at any point must preserve the case. A screen-only path, a status changed directly in the browser, or a “success” message without persisted evidence does not satisfy this definition.

The earlier feature criteria define expected behavior. The following scenarios are the release gate for the live prototype. A polished screen is not accepted if the underlying state contradicts it.

Test

Expected observable result

Requirement coverage

T01 Birth request through correct carrier and payroll result

Correct child, start date, family election, deduction, and completed case

F02–F06, F08, F10–F11

T02 Birth accepted with the wrong start date

Visible mismatch; case stays open; correction preserves original receipt

F09–F11

T03 Twins with the same date

One employee case, two distinct child records, one valid household election, and correct plan pricing

F03–F05, F10–F11

T04 Twins across midnight; one carrier rejection

Each child keeps the correct birth date; accepted child remains; only failed child is repaired

F08–F10

T05 Existing child means composite tier is unchanged

Newborn is enrolled and payroll explicitly shows no regular deduction change

F04, F10–F11

T06 Day 30 complete request; HR reviews next day

Receipt remains day 30 and is distinct from evidence verification and approval

F02, F05–F06

T07 Day 30 blank or unrelated upload

Product does not invent a timely complete request; HR can review the recorded facts

F02–F03, F05–F06

T08 Missing newborn SSN or provisional evidence

Approved pending-evidence route is visible; no invented value or unsupported denial

F03, F06

T09 Job termination with a later coverage-end date

Actual coverage end drives the loss rule and displayed effective date

F02–F04

T10 Voluntary cancellation, nonpayment, and COBRA exhaustion

First two do not receive automatic ordinary-loss approval; genuine exhaustion follows its configured route

F02, F06

T11 Ordinary loss and Medicaid or CHIP loss on the same interval

Correct configured 30-day versus statutory 60-day treatment

F02

T12 Age-26 proactive case

Advance reminders, plan-specific end date, restricted disability-extension route, and continuation handoff

F02–F03, F07, F12

T13 Several household members lose coverage; one is ineligible

Eligible additions continue and the ineligible person receives a separate explained result

F04, F06, F10

T14 Broker manual task completed without carrier evidence

Delivery can be submitted; coverage remains unconfirmed

F09–F10

T15 Duplicate callback, worker retry, or double submit

One business action; no duplicate case, carrier update, or deduction

F05, F08, F11, NF02

T16 Employer or carrier silence with deadline approaching

Backup or operations escalation; employee sees the actual owner and status

F07, F10

T17 Medical succeeds while dental fails

Medical remains confirmed; only dental gets a correction task

F08, F10

T18 Wrong-tenant request or malicious document instruction

Access denied; AI cannot change permissions or expose another case

F14, NF03

T19 Model unavailable

Deterministic submission and HR review still work

F14, NF04

T20 Final divorce removes a covered spouse

Correct person and plan-specific end date reach carrier, payroll, and restricted COBRA handoff

F02–F12, D-A01–D-A05

T21 Divorce direction is outside-plan loss

Product redirects to loss enrollment and creates no Nexa termination or Nexa COBRA referral

F02, D-A01

T22 Legal separation does not end Nexa eligibility

Coverage remains unchanged while the case routes to plan review

F06, D-A02

T23 Six-month-late divorce report

Specialist case separates coverage, claims, premium, payroll, and notice facts; no automatic refund or backdate

F06–F12, D-A07

T24 COBRA referral sent but not acknowledged

Benefit removal may remain verified, handoff remains escalated, and election is never shown as complete

F07, F12, D-A05–D-A06

T25 Carrier terminates spouse on the wrong date

Case stays open, remaining household is preserved, and only the termination correction is resent

F08–F10, D-A03–D-A04

T26 State context changes or is unreviewed

Request persists; State rule review required blocks automated execution; no New York-pack or nationwide-compliance claim.

A04; section 17

T27 Independent carrier and future payroll

Changing approved intent cannot change carrier actuals; Sep 30 is scheduled before the run, not already collected.

F08; F10–F11

T28 Exact financial fixtures

Birth total $466 then $266; divorce $450 → $284; outside loss $166 → $332. Posted history and catch-up do not duplicate.

Section 11; three flows

T29 Loss reason and request-date distinction

Job-fired-for-cause is not plan-fraud termination. Oct 31 advance request → Nov 1; first Nov 2 request → Dec 1 under configured base rule.

Section 15

T30 Permission, version and source failures

Deny unassigned broker access; refuse stale approval; source conflicts/AI timeout remain reviewable; arbitrary uploads are not parsed by filename.

Sections 16–18

T31 Scenario isolation and state recovery

Role views agree after refresh; switching retains each scenario; reset affects only selected synthetic data after confirmation.

A16; section 18

T32 Closure, linked continuation and notifications

Assigned-but-open mismatch blocks completion; COBRA receipt is not election; employee-safe emails are labeled simulated and deduplicated.

F05; F10; F12

T33 Rule/rate update and partial household dependencies

Reapproval required for material changes; a dependent result cannot hide an inconsistent subscriber tier; correct work survives repair.

F06; F10; section 17

Also exercise day 60/61, an unchanged child tier, placement followed by adoption, one rejected twin, missing newborn SSN, future or unfinalized events, unknown delivery, repeated jobs/callbacks, concurrent HR edits, payroll cutoff and insufficient wages, HR/carrier/COBRA silence, malicious document instructions, and browser/save failure. These map to the preserved B, D, L and E matrices. A supported review path is a valid edge outcome; an unimplemented row must be marked unimplemented, not silently counted as passed.

P1 tests apply when their corresponding feature is implemented. Clearly identify an unimplemented scenario as a design requirement rather than claiming it passed. In particular, the prototype is not certified against a real carrier or tested with real PHI.


### Suggested live build allocation

Follow GPT.md’s phased plan: minutes 0–5 readiness and shared contracts; 5–15 persistence, rules, sessions and shell; 15–35 birth end to end including a correction; 35–55 divorce and outside loss on the same engine; 55–70 Emma, fixtures, notifications and manual-route polish; 70–90 browser tests, fixes and walkthrough. Timings are targets and adapt to interview discussion. Keep a runnable app at every checkpoint. Protect the three working flows and correct state transitions before animation or extra dashboards.


### Build handoff and truthful status

Before START BUILD, only inspect readiness; do not create case-specific screens, schema or fixtures. During the build, preserve existing repository work and use the configured design/verification skills. Write shared contracts before splitting file ownership. Keep GPT.md referenced from the existing repository instructions rather than replacing CLAUDE.md, NIURAL.md or DESIGN.md.

Deliver a working preview, README/run instructions, DEMO_GUIDE.md with identities, starting states, fixture downloads and operator steps, BUILD_STATUS.md separating implemented/tested/simulated/deferred work, actual test results and known limitations. Inspect employee and HR screenshots and run the main browser paths; two focused visual-review rounds are enough. Do not claim a test passed from code inspection alone.


## 20 Success metrics


### North star

North star: the percentage of eligible QLE cases correctly completed within their agreed service target. Completion means the approved people, benefits and dates match independent carrier evidence; payroll is correctly posted or verified unchanged; required handoffs are acknowledged; and no blocking issue remains. A linked COBRA continuation journey has its own definition of completion.

Report both the count and the percentage for a matured cohort: cases whose configured completion target has elapsed. The percentage is correctly completed cases by that target divided by valid submitted cases in that due cohort. Keep unresolved valid cases in the denominator. Report unclassified, disputed, denied, and withdrawn cases separately so a team cannot improve the metric by hiding difficult cases or delaying eligibility decisions.

Set the service target per route and event after measuring pilot performance. Start with a proposed goal of at least 95 percent within those agreed targets, subject to pilot validation. This is a product goal, not an established market benchmark or a demo result.


### Four supporting metrics and guardrails

Metric

Definition

How it informs decisions

Employee journey completion

Submitted eligible journeys ÷ eligible journeys started, by event; inspect abandonment step.

Shows whether reporting and choosing are understandable. Track unknown eligibility separately.

First-pass submission completeness

Requests meeting approved minimum intake without a correction ÷ submitted requests; separate permitted evidence-pending cases.

Shows whether questions and evidence guidance avoid unnecessary back-and-forth.

AI case-preparation accuracy

Independently reviewed AI-prepared cases with no material fact or source error ÷ reviewed AI-prepared cases. Also count critical field errors.

Use labeled synthetic tests, then sampled human review. HR acceptance alone is not proof the AI was right.

First-pass execution success

Approved changes whose carrier result and first due payroll result match without rework ÷ approved changes due for both results.

Tests whether the packet, mapping and deductions work; keep overdue unresolved changes in the denominator.

Safety guardrails

Count false confirmations, wrong-person removals, duplicate deductions, unauthorized data exposure and missed tracked notice duties.

Target zero, investigate every occurrence and pause unsafe automation. Audit actual outcomes, not only UI statuses.

Operational diagnostics support these four measures: active HR handling minutes, time to verified coverage, repair time, overdue owner queues, cost per AI-assisted case, and partner setup effort. Review denied, withdrawn, disputed, reopened and still-unclassified cases to prevent gaming. Track observed administrative coverage gaps and urgent-care complaints separately; the north star is not a guarantee of no gaps.

The prototype demonstrates event instrumentation and expected calculations. It cannot establish real adoption, retention, employee outcomes, or reduced operating cost without a pilot.


## 21 Pilot and expansion plan


### Phase one assisted pilot

Start with one platform partner, a small number of employers, approved medical configurations, and one broker or benefits operations team. Use the shared workflow and secure operator-assisted carrier route while real integrations are being contracted and tested. This tests whether the case record, evidence checklist, and reconciliation reduce work before investing in every carrier adapter.

Begin with the three event types for a small set of legally and operationally approved employer configurations. Validate multiple births, direction-of-coverage, late evidence, failed delivery, carrier mismatch, payroll repair and the restricted continuation handoff. Add proactive age-off and broader events only after the initial journeys work reliably. Measure actual event volume and handling pain before claiming which QLE is most common.

Exit criteria: legal and security readiness approved, roles and responsibilities signed off, carrier and payroll results can be reconciled, critical access and duplicate-action tests pass, and every open case has an accountable owner. Real employee data is not a shortcut for testing an unapproved environment.


### Phase two contracted automation

Certify the selected carrier feed and payroll adapter, automate result ingestion, and keep the manual correction route. Add durable jobs, recovery monitoring, configuration approval, and notification delivery controls. Partner SSO, authorization, security review, legally approved plan/state scope, and actual COBRA responsibilities must be ready before any real-data pilot; they cannot be postponed until after launch. Low-risk automation comes only after measured accuracy and an approved operating policy.

A nightly route remains appropriate where the trading-partner agreement supports it. APIs are added where available and commercially useful, not because an API is assumed to guarantee instant coverage. Compare implementation cost and exception rate by route.


### Phase three broader coverage

Expand validated state packs, carriers, actual dental/vision configurations, additional election rules, age-off/disability workflows, beneficiary self-service, and FSA/HSA support according to demand. Add per-dependent or small-group rating only with the relevant plan/rating requirements. Build rule-change intake with human approval rather than letting web-retrieval AI rewrite policy. Improve forecasting and earlier discrepancy detection once source data is reliable.

The durable advantage would be accurate workflow execution and a reusable history of approved rules, exceptions, and outcomes. A prettier event form or more AI agents alone would be easy to reproduce.


## 22 Decisions to validate before production

Plan administrator and counsel: confirm the plan’s allowed changes, authorized intake, timely-request definition, evidence grace process, date counting, state rules, adverse-decision process, and sensitive removals.

Nexa and platform partner: confirm record ownership, employer and user authority, source-data quality, backup owners, operational targets, and which party follows up with a silent carrier.

Carrier and broker: confirm group-specific fields, accepted evidence, transport, batch schedule, acknowledgment types, result semantics, correction procedure, and what counts as reliable coverage evidence.

Payroll owner: confirm contribution rates, proration, cutoffs, retroactive changes, refunds, collection limits, and who can authorize a catch-up or installment plan.

COBRA administrator: confirm referral triggers, beneficiary contact, acknowledgment, notice tracking, escalation, and the service boundary.

Security and privacy owners: confirm legal roles, contracts and BAAs where required, service configurations, access model, retention, incident response, and approved use of AI and OCR.

I can proceed with the stated synthetic assumptions during the interview. I would not present those assumptions as verified Nexa or Aetna policy in a real launch.


## 23 Sources and evidence notes

Research basis reviewed on 28 September 2026; key federal, privacy and implementation references rechecked for this revision. A retrieved current page is not a legal opinion or proof that every rule applies to this employer. Survey years are publication years. The source list distinguishes federal authority, vendor capability descriptions, and market observations. All Nexa rates, schedules, advance-request and evidence policies remain labeled synthetic assumptions.

[S1] KFF. 2025 Employer Health Benefits Survey. Used for offer rates and the covered-worker funding statistic, not broker usage. Open source

[S2] LIMRA. The Role of Workplace Benefits Brokers Is Changing, 1 April 2025. Used for employers’ stated integration preference, not a 120-employee broker market share. Open source

[S3] Employee Navigator. Carrier Integrations Best Practices. Used as primary evidence of its onboarding, broker, testing, and reconciliation workflow. Open source

[S4] Employee Navigator. Employee Navigator Integrations. Used to show that integration types and capabilities vary. Open source

[S5] CMS. Adopted Standards and Operating Rules. Identifies 834 enrollment and disenrollment and distinguishes 835 payment and remittance. Open source

[S6] IRS. Determining if an Employer Is an Applicable Large Employer. Prior-year full-time and equivalent workforce test. Open source

[S7] eCFR. 29 CFR 2590.701-6, Special enrollment periods. Eligibility, requests, effective dates, and options. Open source

[S8] US Department of Labor. HIPAA Portability of Health Coverage and Nondiscrimination Requirements FAQs. Includes loss examples and Medicaid or CHIP special enrollment. Open source

[S9] eCFR. 26 CFR 1.125-4, Permitted election changes. Written-plan permission, consistency, status, orders, cost and coverage changes, and leave provisions. Open source

[S10] US Department of Labor. An Employer’s Guide to Group Health Continuation Coverage Under COBRA. Employer applicability, events, notices, and administration. Open source

[S11] US Department of Labor. A Worker’s Guide to Health Benefits Under COBRA. Beneficiaries, qualifying events, elections, and continuation. Open source

[S12] HHS. Covered Entities and Business Associates. Determines the entities and roles to which HIPAA applies. Open source

[S13] HHS. Guidance on HIPAA and Cloud Computing. Cloud processing, BAAs, risk analysis, and handling of ePHI. Open source

[S14] HHS. Summary of the HIPAA Security Rule. Administrative, physical, and technical safeguards. Open source

[S15] HHS. Business Associates. Contractual responsibilities for covered functions and services. Open source

[S16] IRS. Notice 2014-55. Additional permitted election changes subject to conditions and plan adoption. Open source

[S17] IRS. Notice 2022-41. Additional permitted changes involving family Marketplace coverage, subject to its conditions. Open source

[S18] X12. Transaction Sets, including Implementation Acknowledgment 999. Acknowledgment purpose and limits. Open source

[S19] IRS. Instructions for Forms 1094-C and 1095-C. Used for the reporting boundary and insured versus self-insured reporting distinction; validate the applicable reporting-year instructions. Open source

[S20] US Department of Labor. Health Coverage Portability HIPAA Compliance FAQs, questions 33 and 34. Excepted-benefit treatment of certain limited-scope dental and vision coverage. Open source

[S21] eCFR. 45 CFR 147.102, Fair health insurance premiums. Used only for the individual and small-group per-member rating rule, including the limit of the three oldest covered children under age 21, not as a universal employer payroll rule. Open source

[S22] US Department of Labor. Loss of Dependent Coverage and Young Adults and the Affordable Care Act. Dependent coverage to age 26, replacement options, and possible continuation coverage; exact plan end dates and disability extensions still require plan and state review. Open source and Open source

[S23] HealthCare.gov. Special enrollment opportunities. Used to keep Marketplace enrollment timing and reasons separate from Nexa’s job-based plan workflow. Open source

[S24] Supabase. API keys. Secret keys use elevated privileges and can bypass row-level security; server authorization remains required. Open source

[S25] Vercel. Is SQLite supported in Vercel? Local SQLite is not durable shared storage for serverless application instances. Open source

[S26] US Department of Labor. COBRA Continuation Health Coverage FAQs for Workers. Separate event-notification, notice and election responsibilities. Open source

