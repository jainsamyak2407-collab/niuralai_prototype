# Niural QLE live build instructions

## 0. Read this first

You are my product designer and full-stack engineering partner for a Niural AI product-manager case interview.

Build a polished, functional QLE application using synthetic data. The interview is a 90-minute live build. The interviewers want to see end-to-end product thinking, working software, and thoughtful handling of failures.

This is the build contract, not a request for another specification.

Before I say START BUILD:
- Read the instructions and attached feature specification.
- Inspect the existing environment.
- Report important blockers.
- Do not build case-specific screens, schemas, fixtures, or application code.

After I say START BUILD:
- Implement, run, inspect, test, and iterate.
- Keep a working preview available.
- Continue through the phases without repeatedly asking me to tell you to make the product better.
- Ask only when a missing decision materially affects safety, correctness, scope, or an irreversible action.

Do not interpret “working product” as permission to connect to a real carrier, process real employee information, or claim production readiness.

Build real application behavior around explicitly simulated external systems.

Every visible action must have:
- A persisted result;
- A meaningful explanation; or
- An actual assigned review task.

A toast saying “done” without the underlying state change is unacceptable.

Read these before implementation:
1. The attached feature specification.
2. CLAUDE.md.
3. NIURAL.md.
4. DESIGN.md.
5. Relevant repository instructions.
6. Installed skills and agent definitions.
7. The actual images in design/reference/.
8. Existing application code and environment-readiness notes.

Do not pretend a missing attachment, skill, image, secret, or integration exists.

Within the product requirements, the latest explicit user decisions and this file resolve older specification inconsistencies. Preserve existing design and security instructions. Flag unresolved legal or destructive conflicts rather than guessing.

Save these instructions as GPT.md if they are not already saved. Keep CLAUDE.md short and add an instruction to read GPT.md before working on this product.

Do not replace CLAUDE.md, NIURAL.md, or DESIGN.md.

GPT.md is a filename, not a model selector. Use the coding model and runtime actually available. Keep the application's AI provider and model separately configurable. Never invent a model identifier.


## 1. What we are building

Our customer is a payroll or HR platform that already administers benefits but has no reliable QLE workflow.

Its employers currently manage life events through:
- Email;
- Spreadsheets;
- Broker follow-ups;
- Carrier portals;
- Manual paperwork.

We are building a standalone QLE service with an embedded employee and HR experience.

The demo uses a Niural-inspired host shell to show that embedded experience. We are not rebuilding Niural, its entire HR system, or a complete payroll platform.

The product promise is:

The right people have the right coverage dates and the right benefit deductions, with clear ownership when something goes wrong.

Own the case from:
Employee intake
→ HR decision
→ Carrier execution
→ Verified coverage outcome
→ Payroll reconciliation
→ Acknowledged COBRA handoff where relevant.

Do not end the workflow at HR approval.

Build three deep, working scenarios:

1. Birth
Add a child. Support multiple children and adoption/placement variants through the same engine.

2. Divorce
Remove a currently covered former spouse, preserve the remaining family, and start a restricted COBRA handoff.

3. Loss of other coverage
Add an eligible person after qualifying outside coverage ends. Use the actual coverage date, not the last workday.

All three need:
- Employee intake;
- Evidence handling;
- A review-and-correction loop;
- HR approval;
- Carrier simulation;
- Reconciliation;
- Payroll;
- Notifications;
- An audit trail.

Other life events must have honest guided intake or assisted review, not fake completion.

The strongest demonstration is a mismatch caught and repaired:
- The carrier returns the wrong effective date or rejects one person.
- The product preserves work that succeeded.
- It asks only for what is missing.
- It reconciles the corrected record before closing.


## 2. Non-negotiable product decisions

1. One shared backend serves every role.

Employee, HR, broker, carrier simulator, payroll simulator, and COBRA simulator cannot have disconnected mock state.

2. Keep different types of truth separate.

Store separately:
- Proposed changes;
- HR-approved changes;
- Actual carrier observations;
- Posted payroll results.

3. Do not collapse the workflow into one success status.

HR approval is not carrier acceptance.
Carrier acceptance is not necessarily a verified coverage record.
Scheduled payroll is not a posted deduction.

4. Distinguish legal entitlement from operational confirmation.

A pending carrier record does not itself decide whether a timely enrollee has a legal right to coverage.

5. Use code for decisions and calculations.

Deterministic code handles:
- Dates;
- Rule checks;
- Money;
- State transitions;
- Reconciliation;
- Reminder scheduling.

AI explains or proposes. It does not silently authorize these actions.

6. Preserve the original request.

Store:
- Original server receipt;
- Material revisions;
- Rule versions;
- Evidence used;
- Approval history.

Do not replace the employee's receipt timestamp when HR responds late.

7. Preserve successful work.

If one child or benefit fails, do not roll back successful siblings or benefits.

8. Give every unresolved action an owner.

Include:
- Reason;
- Next action;
- Owner;
- Due date where known;
- Escalation path.

9. Unknown rules require review.

Do not invent eligibility, deny automatically, or use a generic override to ignore legal conflicts.

10. Use synthetic information only.

Synthetic documents must be visibly labeled and must not look like usable government records or real insurance identification.

11. Simulate external delivery by default.

This includes:
- Carrier submissions;
- Carrier responses;
- Payroll execution;
- COBRA administration;
- Email delivery.

Never contact an actual carrier, employer, broker, or former spouse.


## 3. Build in phases and keep the app runnable

Use elapsed time as guidance, not permission to claim unfinished work is complete.

If I pause for interview discussion, preserve the current checkpoint.

Phase 0 — approximately minutes 0–5
- Inspect the repository and instructions.
- Check design references.
- Check dependencies.
- Verify persistence access.
- Check AI configuration.
- Check preview capability.
- Choose one persistence strategy.
- Write shared domain contracts and an acceptance checklist before delegating files.
- Give me a short readiness summary.

Phase 1 — 
- Implement shared types.
- Create seed configuration.
- Implement sessions and persistence.
- Implement deterministic rules and state transitions.
- Create the reusable application shell.
- Start the preview immediately.
- Deliver working role entry, benefits overview, and HR queue with consistent records.

Phase 2 — 
Complete the birth vertical slice:
- Employee intake;
- Evidence;
- Submission;
- HR review;
- Missing-information round trip;
- Approval;
- Carrier console;
- Coverage reconciliation;
- Payroll posting.

Include the wrong-date carrier response.

Do not leave the backend until the end.

Phase 3 — 
Configure divorce and loss of coverage on the same engine.

Implement:
- Their different event and effective-date rules;
- Household changes;
- COBRA behavior;
- Correction paths;
- Payroll differences.

Verify all three full journeys.

Phase 4 — 
Wire:
- Grounded Emma;
- Actual document reading where available;
- Downloadable fixtures;
- Notification inboxes;
- Broker/manual route;
- AI activity;
- Operator-driven failure controls.

The deterministic fallback must already work.

Phase 5 — 
- Run browser journeys.
- Run rule and calculation tests.
- Inspect screenshots.
- Fix broken states and permission leaks.
- Fix incorrect calculations.
- Fix the largest visual weaknesses.
- Verify the preview URL.
- Produce a demo guide and honest readiness report.

Use the configured niural-ui, niural-backend, and niural-verifier agents if available and permitted by repository instructions.

Assign non-overlapping file ownership after shared contracts exist. The main agent owns integration.

Impeccable leads design, subject to DESIGN.md. Use ui-ux-pro-max only as a supporting reference. Do not install competing design systems during the build.

At every phase update BUILD_STATUS.md with:
- Completed requirements;
- Tests actually run;
- Remaining work;
- Current blockers;
- Next action.

A fresh session must be able to resume.

Do not mark a test passed because the code looks plausible.

If time is short, remove:
- Decorative animation;
- Secondary analytics;
- Public onboarding;
- Extra dashboard sections.

Protect:
- All three shared workflows;
- Persistence;
- Correction loops;
- Role checks;
- Coverage reconciliation;
- Payroll correctness.

Clearly identify anything not implemented.


## 4. Environment and persistence

Keep the repository's working framework and package manager.

If it is a prepared Next.js/TypeScript application, use it. Reuse existing components and validation tools.

Avoid a framework migration or microservices architecture.

Preferred persistence:
- Supabase Postgres for structured records.
- Private Supabase Storage for evidence.
- Existing authorized credentials.

Confirm connectivity and a working migration path. A project URL and API key do not automatically provide SQL migration access.

Do not destroy existing tables or seed over unrelated information.

Fallback:
A persistent local server with SQLite and private local files is acceptable if Supabase cannot be used promptly.

State clearly that this fallback needs a persistent process and is not a durable local-file database on Vercel serverless.

Do not deploy an in-memory or local-file store to Vercel and claim refresh/restart durability.

Never silently switch stores and lose cases.

Use a repository interface so UI components do not depend on the storage implementation.

For a hosted preview, prefer the already-configured remote database.

Put evidence behind authenticated application access.

Show the active storage mode in the operator panel.

Check only whether secrets are present and valid. Never print their values.

Use existing environment names where configured:
- SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY
- ANTHROPIC_API_KEY
- AI_MODEL
- VERCEL_TOKEN

VERCEL_TOKEN is a deployment credential, not an application credential.

Do not fabricate functioning provider keys.

.env.example contains names and placeholders only.

If previously exposed credentials are discovered, ask for rotation without repeating them.

Never put secret values in:
- NEXT_PUBLIC variables;
- Browser bundles;
- Screenshots;
- Fixture downloads;
- Git.

Use Supabase Auth and RLS if already functional.

A server-only secret client can bypass RLS. Explicit server-side identity, employer, and assignment checks remain mandatory.

Do not claim RLS automatically protects service-role queries.


## 5. Assumptions and rule configuration

Nexa is a fictional private US employer with 120 full-time employees throughout the previous year.

Assume its plan is subject to:
- Applicable federal employer-plan rules;
- Federal COBRA;
- ERISA;
- ACA applicable-large-employer reporting obligations.

This is an explicit fixture assumption, not a general employee-size compliance engine.

Nexa has a written Section 125 cafeteria plan permitting the modeled changes.

Medical is fully insured.

Use:
- Fictional Aetna-labeled medical options;
- Fictional dental coverage;
- Fictional vision coverage.

All rates and policy terms are illustrative Nexa configuration, not statements of real Aetna policy.

The same execution engine must process medical, dental, and vision separately.

For this demo, explicit synthetic dental/vision rules permit the modeled changes and mirror the selected event dates.

Do not label that as a federal requirement for excepted dental/vision benefits.

Preserve independent statuses and contributions for each benefit.

Open enrollment:
- November 1–15, 2026.
- Coverage beginning January 1, 2027.
- Store this in configuration.
- Do not also show the earlier May 2027 date.

State scope:
- Implement the federal baseline and approved synthetic employer-plan rules.
- Do not create or claim an approved New York state pack.
- Do not assume federal rules alone establish nationwide compliance.

Store jurisdiction context:
- Sponsor type;
- Funding type;
- Policy state;
- Employee work state;
- Employee residence state;
- Dependent residence where relevant;
- Benefit;
- Policy;
- Applicable dates.

Demo profiles may have an explicit:
“Jurisdiction suitability assumed for synthetic demonstration.”

A new or conflicting jurisdiction creates:
“State rule review required.”

Preserve the request and block automated execution until authorized review is recorded.

Headquarters alone cannot establish jurisdiction. Provider service-area availability is a separate eligibility check.

Every rule needs:
- ID;
- Version;
- Source;
- Effective dates;
- Benefit;
- Conditions;
- Outcome;
- Owner;
- Approval status.

Store the rule snapshot with the decision.

No live-web AI answer may change a rule.

A changed rule or rate flags affected cases for review and reapproval. It cannot silently rewrite an approved decision.

Configured timing:

Birth, adoption, placement for adoption, marriage, and ordinary qualifying outside loss:
- Use a 30-calendar-day request window in this demo.
- Federal special-enrollment rules generally require at least 30 days.
- This synthetic plan chooses 30.

Medicaid/CHIP eligibility loss and premium-assistance eligibility:
- Dedicated 60-day request rules.
- Do not give every loss event 60 days.

Divorce removal:
- Separate Nexa reporting target of 30 days.
- This is not the ordinary HIPAA addition deadline.
- It does not replace COBRA notice rules.
- It does not authorize keeping an ineligible spouse covered merely because reporting is late.

Evidence correction:
- Five calendar days as a synthetic administrative target.
- Not a universal legal cure period.
- Not an automatic legal extension.
- Not a guarantee of eligibility.

Business response:
- Initial HR action within one business day.
- Backup escalation after two.
- Escalate sooner when time-sensitive.
- These are operating targets, not law.

Dates:
- Store timestamps in UTC.
- Display deadlines in employer timezone America/New_York.
- That timezone does not imply New York-only legal scope.
- Use date-only calendar arithmetic for event dates.

For the demo:
deadline = event date + configured number of calendar days.
Allow submission through the end of that local deadline date.

Test day 30/31 and day 60/61.

Keep these separate:
- Event date;
- Coverage-end date;
- Request receipt;
- Evidence verification;
- HR approval;
- Carrier observation;
- Paycheck date.

The service is assumed to be an authorized intake channel.

Minimum submission requires:
- Authenticated employee;
- Event;
- Affected people;
- Material event facts;
- Requested change or clear review request;
- Attestation.

Evidence may remain pending under the explicitly approved synthetic process.

A draft, blank form, or arbitrary uploaded file is not a completed election request.

Preserve reportedAt and enrollmentRequestedAt separately when they differ.

Never manufacture a legal timestamp.


## 6. Roles and sign-in

The entry page is a small, polished product entry, not a long marketing website.

Show:
- Product purpose;
- Employee entry;
- HR administrator entry;
- Integration demo entry;
- Subtle “Synthetic data / Demo environment” label.

Seed these fictional identities:

Maya Shah
Senior Product Designer at Nexa
maya@nexa.example
Role: employee

Daniel Brooks
daniel@nexa.example
Role: HR and payroll administrator

Priya Patel
priya@broker.example
Role: assigned broker tasks only

Carrier operator
carrier@demo.example
Role: simulated carrier inbox only

Continuation administrator
cobra@demo.example
Role: assigned COBRA referrals only

Prefer:
- Continue as Maya;
- Continue as Daniel.

Clearly label these as demo sessions.

If using password sign-in:
- Provision actual synthetic demo accounts through the selected auth adapter.
- Choose a demo-only password.
- Document it in DEMO_GUIDE.md.
- Do not create a form that accepts every password.

Never trust an admin role or employer ID supplied directly by the browser.

The server creates a signed or provider-managed session and determines role and employer.

The demo selector can select only predefined synthetic identities.

Demo access is not production identity security.

Gate operator controls to the operator session. Use separate browser contexts when demonstrating simultaneous roles.

Public employer signup is out of scope.

If an invite-activation screen is included:
- Validate a seeded invitation.
- Do not allow choosing an employer or admin privilege.

Omit decorative signup, password-reset, and SSO buttons unless they have working, honestly labeled demo behavior.

Production integration would exchange verified host identity for a scoped session and render our module inside the host.

For this build, simulate that trusted host boundary.

Keep partnerId and employerId separate because one payroll platform may serve many employers.


## 7. Design and screen contract

DESIGN.md and the actual app screenshots are the visual authority.

Reuse their:
- Tokens;
- Typography;
- Density;
- Purple accents;
- Navigation;
- Tables;
- Inputs;
- Cards;
- Spacing.

Do not invent an exact font if it has not been verified. Keep a documented provisional font if necessary.

Do not copy marketing-video glow, giant gradients, or animated floating cards into the working HR dashboard.

Aim for a calm, compact enterprise product:
- Clear hierarchy;
- Readable forms;
- Restrained color;
- Useful status text;
- Consistent interactions.

Accessibility, keyboard focus, contrast, and error recovery are part of polish.

Desktop is the primary demo surface. Support 1440×900 and a usable narrow layout.

Use consistent:
- Page headers;
- Breadcrumbs;
- Primary action placement;
- Loading states;
- Empty states;
- Preserved form data.

No endless spinners or hidden failures.

Employee navigation:
- Benefits;
- Life events;
- Pay;
- Documents.

Emma opens in a contextual side panel without covering required controls.

Include notifications and account controls in the host header.

HR navigation:
- Overview;
- Life events;
- Payroll changes;
- Integrations;
- Audit.

Employee profile details support the case. Do not build a separate full HRIS.

Required routes, adapted to the existing framework if necessary:

/
Demo entry and scenario selection.

/employee/benefits
Current plans, covered people, contributions, downloads, next open enrollment, Report a life event.

/employee/life-events/new
Event selection.

/employee/life-events/[id]/details
Event-aware questions.

/employee/life-events/[id]/evidence
Evidence upload and confirmation.

/employee/life-events/[id]/options
Permitted benefit changes and cost comparison.

/employee/life-events/[id]/review
Before-and-after review and submission.

/employee/cases/[id]
Tracking and requested actions.

/employee/pay
Historical payslips, upcoming payroll, proposed changes.

/employee/documents
Permitted plans, receipts, and uploaded evidence.

/admin/qle
HR queue.

/admin/qle/[id]
Evidence, checks, decisions, delivery, reconciliation, payroll, history.

/admin/payroll
Approved instructions and posted results.

/broker/tasks/[id]
Restricted task detail.

/demo/integrations
Carrier inbox, manual tasks, payroll, COBRA, email outbox, operator controls.

/demo/fixtures
Downloadable synthetic files and scenario presets.

Current benefits cards must show actual stored elections.

A proposed change appears in a separate pending banner.

Never replace confirmed current coverage merely because Maya clicked a plan.


## 8. Life-event catalogue

Use six primary tiles:

1. Family changes
Marriage, a new child, separation, or the loss of a family member.

2. Other health coverage
Coverage for you or a family member has changed.

3. Work and leave
Employment, working hours, or leave affected benefits.

4. Dependent eligibility
Age, dependency, guardianship, or a legal order changed.

5. Plan and cost changes
Available benefits, contributions, or enrollment options changed.

6. Government coverage
Medicaid, CHIP, Medicare, or related coverage changed.

Below the tiles:
“Not sure which applies? Ask Emma”
and
“Ask HR for help.”

AI must not be the only route.

A tile opens a compact choice list or one question at a time.

Do not open another wall of twenty tiles.

If there are more than four choices, group them or use a searchable list.

Store a canonical event code so different entry routes use the same rules.

Family choices:
- Marriage;
- Welcome a child:
  - Birth;
  - Adoption;
  - Placement for adoption;
- Divorce;
- Legal separation;
- A covered family member passed away.

Use “passed away,” not an abrupt “died” tile.

Final divorce and legal separation remain distinct answers.

Outside-coverage loss reasons:
- Employment ended;
- Hours reduced;
- Divorce/separation;
- Outside policyholder passed away;
- Dependent eligibility ended;
- Employer contribution ended;
- COBRA exhausted;
- Other involuntary loss.

Redirect Medicaid/CHIP answers to their dedicated rule family.

Ask who lost coverage before deciding who may enroll.

Work and leave:
- Joining/leaving employment;
- Status or hours changes;
- Leave;
- Return from leave.

Dependent eligibility:
- Age-off;
- Disability-related continuation review;
- Custody or qualified medical child-support order;
- Guardianship/foster placement.

Plan and cost:
- Significant cost or coverage change;
- Another employer's different enrollment period;
- Permitted Marketplace transition.

Government:
- Medicaid/CHIP loss;
- Premium assistance;
- Medicare/Medicaid entitlement review.

These are intake categories, not promises that every answer grants a federal special-enrollment right.

Marriage and other non-core events may use assisted review.

Guardianship and foster placement are not automatically placement for adoption.

Do not automatically approve a QLE for:
- Changing one's mind;
- Pregnancy before birth under the federal birth rule;
- Illness alone;
- A preferred doctor leaving the network;
- Voluntary cancellation alone;
- Nonpayment alone.

A move matters when it changes eligibility or available coverage.

A late report is not an invalid life event. It is a timing-review case.

Show the reason and an HR review route.


## 9. Employee wizard and exact behavior

Show five understandable stages:

What happened
→ Documents
→ Benefit changes
→ Review
→ Track

Save progress on the server.

Back navigation preserves valid shared fields.

If the event changes, explain which fields and calculations must be refreshed.

Ask dates early.

Show the deadline and source as soon as enough facts are available.

Validate on client and server.

Use these message patterns:

Within window:
“You can submit this request by {date}. We will review your documents and confirm the available changes.”

Last day:
“Today is the last day in Nexa's standard request window. Submit your request today. Tell us if a document is still pending.”

Late:
“Nexa's standard {N}-day request window ended on {date}. Your request needs HR review. You can explain what happened and submit it for review.”

Actions:
- Explain with Emma;
- Send to HR for review;
- Save draft.

Do not say:
“You are legally ineligible.”

Future birth:
“You can prepare now, but submit the birth request after your child is born.”

Allow saving a draft and comparing plans.

Invalid date:
“Enter a valid date.”

A completed birth request cannot use a birth date after the current demo date.

Unknown coverage end:
“Use the date health coverage ends, which may be different from the last day worked. If you do not know it, ask HR to help verify it.”

Document conflict:
“The document shows {value}; your form shows {value}. Please confirm which is correct.”

Keep both values and their sources.

Save failure:
“We could not save this change. Your answers are still here. Try again.”

Do not clear the form.

Evidence:
- Support PDF, JPEG, and PNG.
- Show a configured limit, for example 10 MB.
- Validate MIME/type, size, and ownership server-side.
- Reject executable and active HTML/SVG content.
- Show upload, reading, needs confirmation, accepted-for-review, unreadable, and rejected-file states separately.

If malware scanning is not configured, say so. Do not display “virus scanned.”

Read uploaded bytes, not filenames.

Extract proposed:
- Document type;
- People;
- Event date;
- Coverage dates;
- Source page/span.

Maya confirms important fields.

If actual OCR/model reading is unavailable:
- Label the fallback;
- Allow manual entry and review.

A known-fixture shortcut must be hash-matched and labeled synthetic fixture parsing. It cannot pretend to understand an arbitrary file.

Offer:
“I don't have this document yet.”

Use the approved evidence-pending route and explain the follow-up target.

Missing newborn certificates or SSNs must not produce invented values.

Do not falsely claim every upload preserves legal eligibility.

Options screen:
- Show only people and plans permitted by the rule result.
- Respect appropriate special-enrollment options for similarly situated employees.
- Ask optional preferences:
  - Lower paycheck deduction;
  - Lower cost when using care;
  - Checking provider access.
- Do not require diagnoses or medical history.
- Show two medical options side by side.
- Include contribution per paycheck, deductible, out-of-pocket maximum, copays, network description, and source document.
- Show medical, dental, and vision as separate elections.
- Emma explains the selected options.
- It cannot invent network availability or guarantee the cheapest annual healthcare cost.

For removal:
- Replace plan shopping with who leaves;
- Who remains;
- Coverage-end date;
- Cost impact.

Do not permit unrelated cancellation or plan changes merely because a removal event occurred.

Review screen:
- People before and after;
- Plans before and after;
- Requested dates;
- Regular contribution;
- Estimated adjustment;
- Affected paycheck;
- Evidence status;
- Pending questions.

Acknowledging an estimate is not carrier confirmation or payroll posting.

Submission must be idempotent.

Return:
- Case number;
- Immutable receipt;
- Submitted version.

Use event-sensitive copy:

Birth:
“Congratulations on your new arrival. Your request {caseNumber} has been received. We will keep you updated as the coverage change is confirmed.”

Adoption/placement:
“Your request to add your child has been received. We will guide you through the next steps.”

Divorce:
“Your request {caseNumber} has been received. We will help update your benefits and keep you informed.”

Loss:
“Your request {caseNumber} has been received. We are checking the change and the requested start date.”

Bereavement:
“We are sorry for your loss. Your request has been received, and we will help with the benefits update.”

Suppress celebrations for bereavement, a child who subsequently died, or an explicitly sensitive case.

Confetti is unnecessary.


## 10. Employee tracking and HR review

Employee milestones:
1. Request received;
2. HR review;
3. Sent to insurance provider;
4. Coverage result confirmed;
5. Pay updated;
6. Complete.

For removal, use:
“End date confirmed.”

For future coverage:
“Confirmed from {date}.”

Do not call future coverage active today.

Every milestone includes:
- Time;
- Owner;
- Explanation;
- Required action, if any.

Show the next action prominently.

A technical issue requiring HR action can say:
“We are correcting a provider response. No action is needed from you right now.”

Do not expose raw EDI jargon unnecessarily.

When HR requests information:
- Show the exact missing fact/document;
- Explain why;
- Show the due date;
- Provide a direct reply/upload action;
- Preserve the original case and answers.

After persistence, the employee reply must appear in HR's case.

Track receipt separately from evidence completion.

HR queue tabs:
- Needs my action;
- Waiting for employee;
- Waiting for carrier;
- Payroll issues;
- Continuation handoffs.

Show:
- Risk;
- Case age;
- Owner;
- Next action;
- Deadline;
- Event.

Do not expose documents in the queue list.

Use realistic background cases, clearly separate from the three live scenarios.

HR case layout:

1. Header
Case number, Maya, event, original receipt, owner, deadline.

2. Change summary
Before-and-after people, plans, dates, and money.

3. Checks
Passed / Needs information / Needs review / Not applicable.

Each check has:
- Reason;
- Source;
- Rule version;
- Relevant inputs.

4. Evidence
Authorized preview beside extracted and confirmed facts.

5. Actions
- Request information;
- Approve this version;
- Send for specialist review;
- Record decision.

6. Execution
Delivery, person/benefit outcomes, reconciliation, payroll, COBRA tasks.

7. Timeline
Employee-visible events and separately marked internal notes.

AI summary example:
“Two items need review: the notice omits Arjun's name, and the coverage end date differs from the form.”

Do not invent a compliance percentage or certify authenticity using OCR.

Request-information requires:
- Specific reason;
- Fields/documents needed;
- Owner;
- Due date;
- Safe employee message.

AI drafting is optional and editable.

Nonmaterial evidence clarification may preserve an approved intent where allowed.

Changing person, plan, date, or amount creates a new version and requires reapproval.

Ordinary approval requires complete mandatory checks and the current exact case version.

HR may document an exception for review, but cannot erase a legal conflict through a generic override.

An adverse decision requires:
- Authorized actor;
- Applicable reason;
- Source;
- Configured review route.

Do not invent a universal appeal deadline.

Approval atomically saves the decision, freezes the election snapshot, and queues authorized tasks.

It must not mark the employee covered or alter a posted payslip.


## 11. Three isolated demo scenarios

Provide a scenario selector:
- Birth;
- Divorce;
- Loss of other coverage.

Each scenario has its own scenarioId, household snapshot, case records, and clock.

Switching scenarios must not reset or combine them.

Provide an explicit:
“Reset this scenario.”

Require confirmation and affect only that scenario's synthetic records.

Use a server-owned demo clock, visible in the operator panel.

Advancing the clock runs due jobs through the same workflow functions. It cannot directly complete a case.

Store simulated business time separately from actual audit ingestion time.

BIRTH FIXTURE

- Maya is employee-only in medical, dental, and vision.
- Arjun is not enrolled in these Nexa elections.
- Ava Shah was born September 1, 2026.
- Start the scenario September 27, 2026.
- Maya requests Ava's medical enrollment.
- Keep dental/vision unchanged for the simplest financial example.
- Medical changes from $150 to $250 per paycheck.
- HR approves September 28.
- The September 28 nightly batch is delivered.
- Carrier response may be delayed until October 2.
- Requested coverage starts September 1, not October 1 or HR approval day.

Payroll:
- September 15 medical deduction of $150 is posted.
- September 30 is initially scheduled at $150.
- It becomes posted only when the payroll simulation runs or the clock reaches it.
- At October 2, September collected total is $300.
- Approved September obligation is $500.
- Catch-up is $200.

Before September 30:
- Label $200 as a forecast assuming the scheduled old deduction posts.
- Recalculate from the actual posted ledger before authorization.

DIVORCE FIXTURE

- Maya, Arjun, and child Leela are enrolled in family coverage for all three benefits.
- Divorce finalized September 15, 2026.
- Scenario starts September 28.
- Synthetic Nexa rule ends Arjun's coverage September 30.
- This end date is a demo plan term, not federal law.
- Remove only Arjun.
- Maya and Leela remain.

From October 1:
- Medical changes from family $400 to employee-plus-children $250.
- Dental changes from $38 to $26.
- Vision changes from $12 to $8.
- Total regular benefit deduction changes from $450 to $284.
- No September refund in the standard fixture.

Create potential COBRA work as soon as the coverage-loss issue is identified.

Acknowledge the authorized handoff separately from carrier processing and payroll.

OUTSIDE-LOSS FIXTURE

- Maya is employee-only at Nexa.
- Arjun had outside coverage when Nexa spouse coverage was previously available.
- Seed the relevant waiver context.
- Arjun's employment ends October 12, 2026.
- The notice says health coverage ends October 31.

Start October 31.

Maya submits a documented advance loss request while outside coverage remains in force through that day.

Nexa's synthetic policy explicitly allows this advance request.

Requested Nexa start: November 1.

Do not claim advance-request handling is a universal federal requirement.

If all benefits are elected:
- Medical: $150 to $300;
- Dental: $12 to $24;
- Vision: $4 to $8;
- Total: $166 to $332 per paycheck.

Early-November carrier confirmation does not move the requested start to December.

First correctly posted November payroll uses the approved rates.

Normally there is no catch-up if no affected run was missed.

If Maya first submits November 2:
- Base next-month rule returns December 1.
- Show the possible gap.
- Offer review of any approved earlier-start provision.
- Do not promise continuous coverage.

Outside-plan COBRA may be available.

Do not create a Nexa COBRA removal referral for coverage held through another employer.


## 12. Birth and adoption edge cases

Implement these through shared components, rules, line-level results, and review tasks.

Twins or triplets:
- One case;
- Distinct child records;
- Evidence and outcome per child;
- Do not merge children because surname and DOB match.

Twins across midnight:
- Separate actual DOBs;
- Separate coverage start dates;
- Validate timing per child;
- Do not cover the second child before birth.

Existing child tier:
- Contribution may remain unchanged under composite pricing.
- Still transmit and reconcile the new member.

Maya previously waived:
- Check employee/dependent eligibility and enrollment rights.
- Do not require prior employee enrollment in every birth case.

Spouse/other dependent addition:
- Show only people permitted by the applicable rule.
- Do not automatically enroll the entire household.

Certificate unavailable:
- Accept configured provisional hospital evidence.
- Track later evidence if required.

SSN pending or temporary name:
- Follow the configured carrier procedure.
- Create a follow-up.
- Never fabricate an SSN or invent a naming convention.

Unreadable, unrelated, or conflicting document:
- Request the exact correction.
- Preserve the receipt.
- Do not accuse fraud automatically.

Day 30 submission, later HR review:
- Preserve the original receipt.
- Do not replace it with review time.

Day 31:
- Human timing review.
- Not automatic denial.

Evidence target expires:
- Escalate to HR.
- Do not claim a five-day cure universally guarantees legal eligibility.

Adoption/placement:
- Use the actual relevant event date.
- Use the accepted evidence.
- A later adoption decree must not create duplicate enrollment after placement.

Foster care/guardianship:
- Assisted review unless a specific approved rule applies.
- Not an alias for placement for adoption.

One child rejected or one benefit fails:
- Keep confirmed lines.
- Correct failed lines only.

Wrong carrier start date:
- Create discrepancy and correction.
- Do not silently accept next-month coverage for a timely birth election.

Child dies after birth:
- Preserve valid initial coverage history.
- Create a sensitive linked removal review.
- Suppress congratulations.
- Do not erase the birth.

Urgent care while pending:
- Provide receipt and known dates.
- Create urgent support work.
- Do not guarantee claims or issue a fake real member card.

Overlapping QLE/open enrollment:
- Detect shared people, benefits, and periods.
- Require sequencing or a reviewed combined version.
- Do not use last-write-wins.

Per-dependent and small-group age-rated pricing are extension points, not a second production pricing engine in this build.

Use explicit composite tiers for the demonstration.

Do not repeat unsupported “90% of plans” claims.


## 13. Divorce edge cases and COBRA

First ask:

“Are you removing your former spouse from Nexa's plan, or did you lose coverage under their plan?”

Options:
- Remove from Nexa;
- I lost outside coverage;
- Both;
- Not sure.

Outside loss routes to the loss flow.

Both creates linked cases with independent plan authorities and dates.

Not sure creates review work.

Collect:
- Final event date;
- Currently covered spouse;
- Affected benefits;
- Relevant decree pages;
- Any child-coverage order;
- Safe contact information if known.

Do not collect the entire divorce file when only a few facts are needed.

Divorce not final or future:
- Save preparation.
- Do not automatically terminate coverage.

Legal separation:
- Evaluate separately against plan and applicable rules.
- If unclear, retain the recorded current coverage and route the decision for review.

Former spouse never covered:
- No Nexa termination.
- No deduction change.
- No Nexa COBRA referral.
- Offer profile update or outside-loss routing.

Court order concerning children:
- Protect child coverage.
- Send ambiguity to the authorized reviewer.

Late report, including six months late:
- Record true event and report dates.
- Create a specialist case immediately.
- Flag possible missed notices.
- No automatic backdate.
- No automatic refund.
- No automatic conclusion that COBRA rights were forfeited.

Retroactive correction:
Keep separate:
- Carrier premium credit;
- Employee payroll refund;
- Claims consequences;
- Prior-year tax effects.

A carrier credit does not automatically equal an employee refund.

Carrier refuses retroactive date:
- Retain approved intent and actual carrier record.
- Show discrepancy and reason.
- Obtain a revised authorized decision or specialist resolution.
- Do not overwrite intent to manufacture a match.

Claims after requested end:
- Review with carrier, plan owner, payroll, and counsel.
- No automatic rescission or claim adjudication.

Unchanged tier:
- Show no regular deduction change.
- Still reconcile removal.

Unknown/protected former-spouse address:
- Restricted contact-verification task.
- Maya is not required to forward private notices.

Withdrawal after sending:
- Create a correction.
- Investigate notice and payroll consequences.
- Do not delete the transmitted action.

COBRA is a linked workflow, not a final step after payroll.

1. Detect potential qualifying coverage loss and create a task immediately.
2. Authorized administrator confirms event, beneficiary, and referral fields.
3. Send minimal synthetic referral to the COBRA simulator.
4. Track sent, received, information needed, notice status, and exception separately.
5. Third-party administrator owns notices, elections, premiums, and continuation administration.

Referral fields:
- Employer/group;
- Beneficiary;
- Qualifying event/date;
- Coverage-loss date;
- Covered plans;
- Verified contact route;
- Notice metadata.

Demonstrate referral receipt and notice-status updates.

A full beneficiary billing portal is out of scope.

Keep separate:
- Nexa's reporting target;
- Beneficiary's COBRA notice period;
- Administrator's notice duty;
- Beneficiary's election period.

Use an explicit synthetic administrator arrangement and approved sourced rules.

Missing inputs produce:
“Deadline needs verification.”

Do not guess legal deadlines.

A divorce-related beneficiary notice procedure generally must allow at least the applicable 60-day period under federal rules. Administrator notice and beneficiary election have separate triggers.

Implement exact dates only when those triggers and plan procedures are known.

Do not use the five-day evidence target as a COBRA deadline.

Maya may see:
“Continuation information referred to the administrator”
and receipt status.

Maya must not see Arjun's:
- Private address;
- Election;
- Payments;
- Correspondence.

Payroll receives deduction instructions, not the decree.

The QLE can close after correct removal/payroll and acknowledged handoff, while the clearly linked continuation workflow remains open.


## 14. Loss-of-coverage edge cases

Collect:
- Who lost coverage;
- Prior employer/plan;
- Benefits ending;
- Loss reason;
- Actual coverage-end date;
- Last workday separately;
- Prior coverage/waiver facts;
- Accepted proof.

Ask about remaining coverage when it affects the decision.

Do not make every employee answer every possible legal question.

Evidence is configurable:
- Carrier notice;
- Employer notice;
- Other approved proof.

It should identify affected people and coverage-end date.

Do not universally reject employer-issued letters.

A job-termination letter without coverage dates may need clarification.

Job ended versus coverage ended:
- Use the correct coverage-loss trigger.

Employment termination “for cause”:
- Do not automatically exclude it.
- The ordinary HIPAA exclusion concerns coverage terminated for cause, such as fraud/material misrepresentation connected with the plan, and nonpayment.
- Do not confuse job dismissal with that exclusion.

Hours reduction:
- Confirm it actually caused coverage loss.

Employer stops contributing:
- Use contribution-termination event/date.
- Coverage need not physically end for this separate route.

COBRA exhausted:
- Distinguish recognized exhaustion from voluntary early cancellation or nonpayment.

Nonpayment/voluntary cancellation alone:
- No ordinary-loss auto-approval.
- Explain and offer review for another applicable rule.

Medicaid/CHIP loss or premium assistance:
- Dedicated 60-day path.
- Benefit-specific configuration.

Future loss:
- Allow draft.
- Allow advance request only if the approved plan permits it.
- Do not claim active replacement coverage early.

Loss after divorce:
- Confirm whose plan ended.
- Outside-plan enrollment rights and old-plan COBRA rights can coexist.

Only one household member loses coverage:
- Evaluate who can specially enroll.
- Do not automatically grant every dependent new enrollment rights.

Employee previously waived:
- Check otherwise eligible people and prior-coverage conditions.
- If waiver statement is missing, check whether it was validly required and disclosed.

Partial household eligibility:
- Continue eligible lines.
- Explain/review others.
- Do not reject the whole household.

Conflicting dates or notice names only subscriber:
- Create a precise missing-information task.

Another coverage remains:
- Evaluate the applicable rule.
- Do not automatically deny just because another policy exists.

HMO service-area loss:
- Distinguish actual eligibility loss and available alternatives from merely moving or a doctor leaving the network.

Overlap with open enrollment:
- Keep the QLE's appropriate effective-date path.
- Do not automatically move it to next plan year.

Urgent care, gap, or overlap:
- Show actual dates.
- Offer support.
- No blanket “no coverage gaps” promise.

Age-related loss:
- Use the old plan's actual end date.
- Outgoing Nexa age-off is a different removal/continuation case.

State/disability uncertainty:
- Assisted review.
- Do not automatically delete every dependent at 26.
- Do not guarantee indefinite coverage because of disability.

Age-off reminders and full disability-extension handling are secondary scope. Include a seeded review example if time permits without sacrificing the three deep flows.


## 15. Carrier preparation, EDI, and third-party console

Implement an independent simulated carrier store.

It starts with seeded current coverage and changes only when the carrier operator publishes a result.

Do not derive the actual carrier roster from our desired election. That would make reconciliation meaningless.

Default medical route:
Simulated nightly EDI 834.

Configuration:
- Cutoff: 9:45 p.m.
- Send: 10 p.m.
- Employer timezone.

These are fictional settings, not Aetna's schedule.

The operator can run or advance to the next batch using the same server worker.

After HR approval create a canonical ChangeOrder:

- Employer/group;
- Employee/subscriber;
- Affected dependent;
- Relationship;
- Benefit and plan identifiers;
- Action;
- Dates;
- Tier;
- Approved version;
- Operation key.

Include only required carrier fields.

Keep evidence separate.

Generate the payload deterministically.

Produce:
- Downloadable illustrative .edi;
- Readable transaction summary.

Both must come from the same ChangeOrder.

Use a documented 834 demo subset:
- Envelopes;
- Sender/receiver control references;
- Member loops;
- Coverage actions/dates;
- Reconciled counts.

Validate the subset actually implemented.

Label:
“Illustrative 834 — not carrier-certified.”

Do not invent actual carrier companion-guide requirements or claim certification.

If a licensed mapping/validator is unavailable, disclose the supported subset.

Never pack PDF certificates inside an 834.

Supporting evidence uses a separately authorized secure channel. The simulator may represent this as restricted attachments.

Never send the feed as an ordinary email attachment.

Batch records retain:
- batchId;
- Carrier/group;
- caseVersion;
- Transaction IDs;
- Payload hash;
- Record count;
- Queued/sent times;
- Attempt IDs.

Hold invalid records with specific correction tasks.

Process valid records according to configured batch policy.

Keep these stages separate:
- Queued;
- Transmitted;
- Transport receipt;
- File validation;
- Member business result;
- Observed coverage result.

A 999-style acknowledgment is not active coverage.

An 835 is claims payment/remittance, not enrollment confirmation.

Build /demo/integrations with:

“External systems simulator — synthetic”

Tabs:

A. CARRIER INBOX

List received batches/requests:
- Group;
- Benefit;
- Route;
- Count;
- Timestamp;
- Status.

Open batch:
- Read-only payload;
- Download .edi;
- Decoded member table;
- Authorized evidence links.

Operator actions:
- Acknowledge transport;
- Reject file with reason;
- Accept file validation;
- Accept selected records for processing;
- Request information;
- Reject selected record;
- Publish coverage observation.

Accepting a record must not post payroll.

Publishing coverage observation is a separate action.

Observation fields:
- Person;
- Plan;
- Benefit;
- Tier;
- Start date;
- End date;
- Source reference;
- Observed time.

Allow deliberately incorrect date/tier values for reconciliation tests.

Support:
- One rejected twin;
- Medical success/dental failure;
- Unknown delivery;
- No response;
- Late stale callback.

Explain disabled controls.

Do not confirm an unsent change through the ordinary operator path.

B. BROKER/MANUAL TASKS

Show:
- Assigned packet;
- Required fields;
- Permitted evidence;
- Portal checklist;
- Due date;
- Owner;
- Submission reference.

“Record portal submission” means submitted only.

“Record carrier result” requires:
- Source/reference;
- Observed details;
- Verifier;
- Time.

Requests for employee information use the same task and notification loop.

Do not automate a real insurance portal login, bypass MFA, or pretend this occurred.

C. PAYROLL SIMULATOR

Show:
- Authorized instructions;
- Target run;
- Expected recurring amount;
- Expected adjustment.

Actions:
- Apply instruction;
- Reject instruction with reason;
- Post run;
- Publish a deliberately different result.

Keep instruction acceptance and actual pay-run posting separate.

D. COBRA SIMULATOR

Show minimal referral inbox.

Actions:
- Acknowledge receipt;
- Request missing information;
- Record notice status/reference.

Restrict beneficiary data.

No Maya-session access to private correspondence.

E. EMAIL OUTBOX AND DEMO CONTROLS

- Render notifications by recipient.
- Advance clock.
- Run due jobs.
- Simulate delivery failure.
- Select failure preset.
- Reset selected scenario after confirmation.

No button may bypass the domain workflow and make everything successful.

Also implement a small simulated API adapter using the same ChangeOrder and result schema.

A 202/transaction reference means received, not covered.

Do not build multiple real integrations.

Use one adapter interface for EDI, API, and manual routes.

Unknown delivery requires status investigation before retrying or switching routes.

Internal idempotency alone cannot guarantee a real external carrier deduplicates.


## 16. Reconciliation and completion

Compare approved intent against independently stored carrier observations.

Reconcile at:
- Person;
- Benefit;
- Coverage period.

Match:
- Identity;
- Action;
- Plan;
- Tier;
- Dates;
- Unaffected members.

Store:
- Source;
- observedAt;
- Snapshot scope.

Absence from an incomplete roster does not prove termination.

Mismatch example:
“Ava's requested start is September 1. The carrier record shows October 1.”

Then:
- Save both values;
- Create assigned issue;
- Pause affected completion/payroll instruction;
- Show an employee-safe explanation.

Correction:
- Preserve original receipt;
- Preserve approved intended outcome;
- Fix mapping through a versioned correction;
- Reapprove material fact/election changes;
- Send only failed lines or carrier-approved correction scope;
- Do not repeat completed deductions.

Subscriber tier and dependent membership changes may depend on each other.

Group transactions with prerequisite subscriber updates.

Do not allow partial success to create an impossible household state.

Use separate state fields:

Request:
draft
submitted
needs_information
under_review
approved
declined
withdrawn

Delivery:
queued
sent
receipt_unknown
acknowledged
file_rejected
record_rejected

Coverage line:
awaiting_confirmation
confirmed_future
confirmed_current
end_confirmed
mismatch

Payroll:
preview
blocked
approval_needed
scheduled
instruction_accepted
posted
mismatch
verified_no_change

COBRA:
not_applicable
review_needed
referral_ready
sent
received
notice_tracked
exception

Derive case status from these records.

Do not create a free-form “set complete” API.

An approved change completes only when:
- Every affected line has a verified correct outcome;
- Payroll is correctly posted or explicitly verified unchanged;
- Required tasks and handoffs are satisfied.

Future-dated coverage can be confirmed without being active today.

If payroll is scheduled for later:
“Coverage confirmed; pay update scheduled.”

Do not say Complete yet.

Declined and withdrawn requests have separate terminal outcomes. They do not count as fulfilled QLEs.

A later material conflicting observation reopens an issue with history preserved.

Acknowledged COBRA ownership may satisfy the benefit-case boundary while the continuation workflow remains visibly separate and open.


## 17. Synthetic plans, money, and payroll

Use one source of truth for rates and plan text.

Generate from it:
- Cards;
- Comparison;
- Plan documents;
- Calculations;
- Emma knowledge.

Do not put conflicting numbers in different screens.

All following contribution amounts are dollars per semi-monthly paycheck.

Store integer cents.

Use 24 deductions per year.

Tier order:
Employee only / Employee plus spouse / Employee plus children / Family.

EMPLOYEE CONTRIBUTIONS

Aetna Standard Medical — illustrative:
150 / 300 / 250 / 400

Aetna Plus Medical — illustrative:
200 / 375 / 325 / 475

Nexa Dental — illustrative:
12 / 24 / 26 / 38

Nexa Vision — illustrative:
4 / 8 / 8 / 12

TOTAL ILLUSTRATIVE PREMIUMS

Standard Medical:
450 / 800 / 750 / 1100

Plus Medical:
600 / 1000 / 900 / 1350

Dental:
30 / 60 / 65 / 95

Vision:
10 / 20 / 20 / 30

Employer contribution:
Total premium minus employee contribution.

Never deduct the entire carrier premium from the employee.

SYNTHETIC MEDICAL TERMS

Standard:
- Deductible: $1,500 individual / $3,000 family.
- Out-of-pocket maximum: $5,000 / $10,000.
- Primary-care copay: $25.
- Specialist copay: $50.
- Illustrative in-network preventive care: $0.
- 20% coinsurance after applicable deductible for modeled services.

Plus:
- Deductible: $750 / $1,500.
- Out-of-pocket maximum: $3,500 / $7,000.
- Primary-care copay: $20.
- Specialist copay: $40.
- Illustrative in-network preventive care: $0.
- 10% coinsurance after applicable deductible for modeled services.

These are invented demonstration terms, not verified Aetna products.

No provider-network, prescription-price, accumulator-transfer, or claim-payment guarantee.

SYNTHETIC DENTAL TERMS

- $50 individual / $150 family deductible.
- $1,500 annual covered-service maximum per person.
- Preventive services at 100%.
- Basic services at 80% after deductible.
- Major services at 50% after deductible.
- No orthodontia in the sample.

SYNTHETIC VISION TERMS

- $10 exam copay once per 12 months.
- $150 frame allowance once per 24 months.
- $150 elective contact-lens allowance instead of frames once per 12 months.

Keep benefit maximums distinct from medical out-of-pocket maximums.

DEMO PAYROLL POLICY

Paydays:
15th and last business day of the month.

Store explicit:
- Payroll periods;
- Paydays;
- Cutoffs.

Full month:
Monthly employee obligation = per-paycheck contribution × 2.

Midmonth change:
Use an explicit synthetic daily-proration policy over actual days in that month.

This is Nexa demo configuration, not a universal carrier rule.

Retain unrounded intermediate precision.
Round final monthly obligation once to cents.
Allocate any residual cent deterministically.

Build obligation by benefit and covered period.

Subtract actual posted deductions allocated to those periods.

Separate:
- Recurring amount;
- Arrears proposal;
- Refund proposal.

Do not count already scheduled adjustments twice.

No catch-up is needed if:
- Tier/rate is unchanged; or
- Correct amounts were already collected.

Refunds and prior-year corrections need authorization.

A negative calculation is a proposal, not a payment.

The demo waits for matching carrier evidence and authorized payroll instructions before changing actual deductions.

This is our operating policy, not a universal legal requirement to wait for a carrier.

While the carrier is silent:
- Preserve requested effective date;
- Show estimated exposure;
- Escalate urgent coverage concerns.

Do not equate missing confirmation with a legal finding that no coverage exists.

REQUIRED NUMERIC CHECKS

Birth medical:
September obligation $500
minus collected $300
equals catch-up $200.

October 15:
Medical $250 recurring + $200 adjustment = $450.
Dental $12.
Vision $4.
Total benefit deduction = $466.

Next regular run:
$250 + $12 + $4 = $266.

Divorce:
Family total $450.
New employee-plus-children total $284.
Reduction = $166 per paycheck.
No September refund in standard fixture.

Outside loss:
Employee-only total $166.
Employee-plus-spouse total $332.
Increase = $166.
No catch-up if first affected run posts correctly.

PAY SCREEN STATES

Historical posted payslip:
Immutable.

Proposed benefit preview:
Changes as Maya compares plans.
Not an actual deduction.

Approved scheduled change:
Appears after authorization and required reconciliation.

Posted simulated payslip:
Appears only after the payroll simulator posts the target run and the result matches.

Show:
- Previous recurring amount;
- New recurring amount;
- One-time adjustment;
- Total benefit deduction;
- Effective period;
- Target paycheck.

Cutoff passed:
Show next permitted run and recalculate exposure.

Insufficient wages, large catch-up, or leave:
Create approved installment/alternate-collection review.

Do not force negative net pay.

Create a realistic synthetic historical payslip with:
- Earnings;
- Benefit deductions;
- Retirement contribution;
- Withholding lines.

Source withholding from the payroll-simulator fixture.

Label it illustrative.

Do not claim to calculate live federal/state taxes or predict exact future take-home pay from the benefit change alone.

All payslip totals must still add up.

Do not add full FSA, HSA, imputed-income, garnishment, tax-filing, or claims-adjudication engines.

Explain these boundaries when relevant.

Unknown tax treatment becomes payroll review.


## 18. AI capabilities and safeguards

Use the configured server-side model API if available.

The coding assistant subscription does not automatically provide application API access.

Verify the configured model with a small synthetic request.

If unavailable:
- Use a labeled deterministic/manual fallback;
- Keep submission and HR review working.

Emma uses grounded retrieval, not fine-tuning.

Load:
- Approved synthetic documents;
- Structured rules;
- Selected plans;
- Rate versions;
- Only case facts the current user may see.

A small indexed document collection is enough. A vector database is not mandatory.

Every policy answer includes:
- Document title;
- Section/page or exact record reference;
- Version;
- Applicable date.

Distinguish:
- Official federal guidance;
- Nexa policy;
- Carrier demo configuration;
- Estimate.

Missing/conflicting sources:
“I cannot confirm that from the available documents.”

Provide a review action.

Never promise the model always answers correctly.

AI capabilities:

Guide
Explain event choices and ask the next relevant question.

Evidence reader
Propose facts with source locations.
Employee/HR confirms material facts.

Plan explainer
Compare permitted options using stated preferences and deterministic costs.

HR assistant
Summarize facts, checks, conflicts, and next actions.

Packet assistant
Explain missing carrier fields and draft a checklist.
Code generates the actual payload.

Exception assistant
Translate carrier errors and propose precise corrections/follow-ups.

Workflow monitor
Explain due/overdue tasks.
Code schedules reminders and detects discrepancies.

Allowed AI tools:
- Scoped reads;
- preview_calculation;
- propose_task;
- draft_message.

Raising a review request requires the user's confirmed action, then calls the same case API.

AI cannot directly:
- Approve;
- Decline;
- Terminate coverage;
- Post payroll;
- Change permissions;
- Send to arbitrary recipients;
- Mutate external records.

Response schema:
- answer;
- sourceRefs;
- proposedFacts;
- uncertainFields;
- proposedActions.

Validate the schema.

Obtain numbers from calculation services.

Reject unsupported numeric claims.

Use bounded retries, timeouts, and call budgets.

Do not stall the form behind AI.

AI activity panel:
- Actual timestamps;
- Document read;
- Facts proposed;
- Facts confirmed;
- Summary prepared.

Label deterministic work:
“Rule check”
or
“Reconciliation check.”

Do not show:
- Fictional agents running;
- Hidden reasoning;
- Invented confidence scores.

Uploaded text is untrusted content.

Instructions inside documents cannot:
- Change system behavior;
- Retrieve another employee's case;
- Invoke unauthorized tools.

Do not send uploaded documents to web search.

Do not log raw sensitive prompts in ordinary analytics.

Suspected alteration or conflict:
- Proportionate human verification;
- Alternate accepted evidence;
- Review route.

No automatic fraud finding.

A second model agreeing does not establish authenticity or legal compliance.


## 19. Data model and API contracts

Use a modular monolith:
- UI;
- Domain types;
- Deterministic services;
- Repository;
- Adapters;
- Workers.

Do not spend the interview on Kubernetes or microservices.

Persist at least these aggregates:

1. Partners, employers, users, memberships, scenarios, clocks.
2. People, relationships, household snapshots, current host elections.
3. Plans, rates, policy documents, rule versions, jurisdiction reviews.
4. QLE cases, versions, affected people, requested/approved election lines.
5. Evidence files, proposed facts, confirmed facts, evidence reviews.
6. Approvals, decisions, tasks, comments, exception issues.
7. Carrier batches, transactions, attempts, inbox events, independent observations.
8. Payroll obligations, instructions, posted results, immutable paystub snapshots.
9. Restricted COBRA referrals and status events.
10. Notification outbox, attempts, inbox views, append-only audit.

Combine tables where sensible without losing relationships.

Every record has:
- Stable identity;
- Partner/employer scope where applicable;
- Scenario scope for demo data.

Separate personId from subscriberId.

Separate benefit from carrier.

Link carrier results to transaction/version, not employee name alone.

CORE APIS OR EQUIVALENT SERVER ACTIONS

POST /api/session/demo
Validate predefined identity and create session.

GET /api/employee/benefits
GET /api/employee/pay
Return scoped actual data and separately labeled proposed data.

POST /api/qle/cases
Idempotently create draft.

PATCH /api/qle/cases/:id
Validate version and update draft/revision.

POST /api/qle/cases/:id/evaluate
Return checks, permitted changes, dates, missing facts, calculation preview.

POST /api/qle/cases/:id/evidence
Authorize upload, record file, create extraction task.

POST /api/qle/cases/:id/submit
Validate minimum intake, save receipt/version, create HR work.

POST /api/qle/cases/:id/respond
Answer a specific information task and attach revision.

POST /api/admin/qle/:id/request-information
POST /api/admin/qle/:id/approve
POST /api/admin/qle/:id/decision
POST /api/admin/qle/:id/escalate
Role-checked domain transitions.

POST /api/demo/batches/run
Process due authorized carrier jobs.

POST /api/demo/carrier-events
Receive simulator event through ingestion/reconciliation.

POST /api/demo/payroll/run
POST /api/demo/payroll-events
Apply/post/publish through payroll adapter.

POST /api/demo/cobra-events
Update restricted handoff workflow.

POST /api/demo/clock/advance
Advance scenario business time and run due jobs.

POST /api/emma
Retrieve scoped sources and return validated response.

GET /api/qle/cases/:id
GET /api/notifications
GET /api/documents/:id
Role-filtered views and protected downloads.

MUTATION CONTRACT

Include:
- idempotencyKey;
- expectedVersion.

Derive actor, partner, and employer from verified session, not browser claims.

Use meaningful:
400 / 401 / 403 / 404 / 409 / 422 responses.

Return:
- Safe error code;
- Field errors;
- Next action.

Never return secret values or raw stack traces.

Successful mutations return:
- Entity ID;
- New version;
- Business status;
- Task/event references.

Version conflict:
Return latest summary and ask user to review changes rather than overwriting them.

CARRIER EVENT CONTRACT

Include:
- eventId;
- transactionId;
- caseVersion;
- personId;
- benefit;
- eventType;
- carrierReference;
- observedAt;
- payload.

Reject mismatched/unknown references.

Ingest duplicates once.

A real external callback would require authentication.

The demo uses an operator-authenticated internal endpoint, not a publicly writable fake webhook.

HOST INTEGRATION

Host adapter reads:
- Employee snapshot;
- Plan snapshot;
- Current elections;
- Payroll history.

Host receives:
- Approved election changes;
- Payroll instructions;
- Idempotency keys;
- Dated status/history events.

Store host acknowledgment separately.

Persist outgoing work with the case change so a crash cannot lose delivery.

An interface is not a completed external integration.

CROSS-SCREEN UPDATES

Use:
- Existing realtime capability;
- Server events; or
- Short polling with refetch-on-focus.

An operator action must appear in HR and employee views without manual database edits.

Polling is acceptable.

Do not claim instantaneous external coverage.

ACA HISTORY

Create an export with:
- Employee/employer references;
- Event/version;
- Coverage periods;
- Host offer references;
- Contribution references;
- Superseded corrections.

The partner compliance system selects reporting codes and files forms.

A family contribution change does not necessarily change employee-only affordability.

Do not populate self-insured dependent reporting by default for fully insured Nexa medical coverage.

Label:
“History for reporting.”

Not:
“ACA compliant”
or
“IRS filed.”


## 20. Reliability, permissions, and privacy

Tie approved version, queued work, audit, and outbox together transactionally.

Retries may repeat delivery attempts but must not duplicate the business effect.

Use uniqueness constraints for:
- Operation keys;
- Callback IDs;
- Notification keys.

Use current-version checks for employee edits and HR decisions.

Keep duplicate/out-of-order responses in history without reversing a newer approved outcome.

Unknown delivery requires investigation, not blind resend.

Corrections receive new version/operation identity linked to the original.

PERMISSIONS

Employee:
Own cases and permitted household data.

HR:
Its employer only.

Broker:
Assigned tasks only.

Carrier operator:
Its synthetic group/inbox.

COBRA:
Assigned beneficiaries only.

Payroll:
Dates and amounts, not unrestricted documents.

Never send private fields to the browser merely to hide them with CSS.

Use:
- Private storage;
- Short-lived authorized document links;
- Server-side role checks;
- File-access audit events.

Keep secrets, SSNs, evidence text, and sensitive event details out of:
- URLs;
- Error logs;
- Analytics;
- Email subjects.

Synthetic identifiers must not be usable insurance cards or government credentials.

Treat uploads as sensitive PII and potentially PHI depending on role/use.

Do not claim every HR record is automatically HIPAA PHI.

Production would require:
- Legal-role assessment;
- Applicable BAAs;
- Approved hosting/OCR/AI/logging arrangements;
- Security review;
- Retention controls;
- Incident procedures.

No “HIPAA certified” badge.

Store necessary AI metadata and protected source references only.

Do not assert one universal retention period for every document.

No general-model training on case data.


## 21. Notifications and stalled work

Every material employee-visible transition creates:
- Timeline update;
- Employee email-outbox event;
- Relevant HR notification.

Technical retries and raw acknowledgments go to the internal audit without confusing employee spam.

Deduplicate related events.

Material events include:
- Request received;
- Information requested;
- Employee response received;
- Review/decision recorded;
- Submitted to provider;
- Provider issue requiring action;
- Coverage result confirmed;
- Payroll scheduled;
- Payroll posted/corrected;
- Case completed/reopened;
- Important continuation handoff status.

Messages contain:
- Case number;
- Safe summary;
- Next action;
- Authenticated deep link.

Do not include:
- Certificates;
- SSNs;
- Private former-spouse details;
- Diagnoses.

Employee and HR receive appropriately different messages.

Do not send the same full case dump to everyone.

Default email delivery:
Rendered simulated inbox.

Show:
- Recipient;
- Subject;
- Preview;
- Created time;
- Simulated delivery state;
- Linked event.

Do not claim real email delivery.

Real email requires:
- Already-configured provider;
- Explicitly approved recipient allowlist;
- Synthetic content.

Do not invent live addresses or reuse contacts from research.

Reminders use:
- Task owner;
- Backup;
- dueAt;
- Deduplication key.

Under demo settings:
- Remind after one business day.
- Escalate after two.
- Accelerate for imminent deadlines or urgent coverage issues.
- Stop obsolete reminders after resolution.

Bounce:
Create alternate-contact task.

HR silence is not approval.
Employee silence is not automatic denial.
Carrier silence is not coverage.
COBRA silence is not a notice.

Each creates a visible, owned exception.


## 22. Downloads and synthetic knowledge pack

Create files during the live build from the same fixture data used by the application.

Every download must work.

Label:
“SYNTHETIC DEMO — NOT VALID FOR ENROLLMENT.”

Use fictional issuers.

No government seals or signatures.

Required files:
- Nexa benefits guide;
- Election rules;
- Contribution schedule;
- Payroll policy;
- Standard and Plus illustrative medical summaries;
- Dental and vision summaries;
- Maya's current election statement per scenario;
- Birth hospital-evidence sample;
- Twins same-date and different-date variants;
- Readable and conflicting-date evidence;
- Adoption/placement sample;
- Divorce fact-summary sample;
- Late-divorce-report variant;
- Outside-loss notice naming Arjun and October 31 end date;
- Missing-name and conflicting-date notice variants;
- Medicaid/CHIP and COBRA-exhaustion examples;
- Submitted election receipt;
- Approved election summary;
- Illustrative 834;
- Carrier result summary;
- Payroll change statement;
- Historical and posted simulated payslips;
- Minimal continuation referral.

Divorce evidence should be a synthetic fact-summary sample containing relevant names, final date, and child-coverage note, not a forged legal decree.

Label what each fixture tests.

Also handle arbitrary supported uploads through actual extraction or clearly labeled manual review.

Do not merely recognize filenames.

Never label generated samples as:
- Official Aetna plans;
- Government certificates;
- Legally served COBRA notices;
- Real member ID cards.

Professional structure is welcome; impersonating official issuers is not.


## 23. Acceptance tests and failure presets

Write:
- Pure rule tests;
- Calculation tests;
- API tests;
- Browser journeys.

Use actual clicks and refreshes.

Assertions inspect:
- Persisted outcomes;
- Dates;
- Money;
- Messages;
- Permissions;
- Side effects.

MANDATORY HAPPY PATHS

Birth:
Submit → HR approval → batch → transport/file/member stages → matching coverage observation → authorized adjustment → payroll posted → tracker completion and notifications.

Divorce:
Correct spouse removed → child preserved → end date verified → contribution reduced → COBRA referral acknowledged → private fields hidden → payroll reconciled.

Loss:
Correct actual coverage-end date → eligible person and start date → carrier confirmation → changed next payroll → no premature current-election change.

MANDATORY EDGE TESTS

1. Day 30/31 and 60/61 with correct messages/review routing.

2. Timely submission and late HR review preserve original receipt.

3. Draft/unrelated upload does not become a timely completed election.

4. Missing/unreadable proof → exact HR request → employee correction in same case.

5. Wrong extracted date does not overwrite confirmed value.

6. Twins with different DOBs and one carrier rejection preserve the successful child.

7. Existing child tier creates real enrollment work without an extra recurring contribution.

8. Missing SSN/certificate follows approved pending route without invented data.

9. Adoption after placement does not create duplicate enrollment.

10. Divorce direction switch does not terminate Nexa coverage for an outside-plan loss.

11. Unfinalized divorce/uncertain separation does not cause unauthorized termination.

12. Six-month-late divorce creates review with no automatic refund/backdate and flags continuation risk.

13. Maya cannot access private former-spouse data through the API.

14. Job end and coverage end differ; correct trigger is used.

15. Nonpayment/voluntary cancellation differ from genuine COBRA exhaustion.

16. Employment dismissal for cause is not confused with plan-coverage fraud termination.

17. Future loss, missing prior-waiver facts, and unreviewed jurisdiction route honestly.

18. Whole-file rejection and one-member rejection have different recovery scope.

19. Wrong carrier start/end date blocks completion.

20. Medical success/dental failure does not roll back medical.

21. Unknown transport outcome requires investigation before resend/fallback.

22. Duplicate submission/callback/job does not duplicate cases, notifications, coverage changes, or deductions.

23. Stale callback/concurrent HR edits cannot overwrite newer approved data.

24. Payroll cutoff, existing collections, zero adjustment, refund proposals, and insufficient wages behave correctly.

25. Payroll mismatch keeps coverage confirmed but payroll unresolved.

26. HR/carrier/COBRA silence creates reminders and named backup escalation.

27. Model timeout/malicious document leaves deterministic workflow and permissions intact.

28. Refresh, back navigation, save failure, and role switching preserve correct state.

29. Cross-employee, cross-employer, and unassigned-broker requests are denied server-side.

30. New rule/rate version triggers review without silently changing approved cases.

An edge is handled when it follows the specified correction or accountable review path.

Do not invent automatic legal resolutions.

Clearly report any unimplemented or untested matrix item.

Presets should configure failures/events and then use normal transitions.

They must not directly mark a case complete.

Test scenario-reset isolation.


## 24. Instrumentation and final handoff

Record non-sensitive structured events for:
- Journey started;
- Request received;
- Information requested/responded;
- Approval;
- Carrier delivery;
- Mismatch detected/resolved;
- Payroll posted/reconciled;
- Handoff acknowledged;
- Case completed/reopened.

Goal:
Correct, timely completion with less employee uncertainty and HR effort.

North star:
Correctly completed eligible cases within agreed service target
divided by
Eligible cases due in that cohort.

Include unresolved eligible cases.

Separate disputed, declined, and unclassified cases rather than hiding them.

The demo cannot prove real customer improvement.

AI evaluation:
- Field corrections;
- Source correctness;
- Case-preparation accuracy against labeled synthetic examples.

Do not use HR rubber-stamping or invented model confidence as proof of accuracy.

After building, deliver:

1. Working preview and actual run instructions.

2. README
Stack, persistence mode, setup, actual test commands.

3. DEMO_GUIDE.md
Identities, scenario starting states, downloads, operator actions, expected numbers.

4. BUILD_STATUS.md
Implemented, tested, simulated, blocked, deferred.

5. Short architecture map
Host, QLE service, carrier, payroll, COBRA boundaries.

6. Test results and known limitations.

Do not claim:
- Production readiness;
- Carrier certification;
- Legal sign-off;
- Real email delivery;
- Tests that were not run.

Inspect screenshots after the core flows work.

Fix the two largest usability/visual weaknesses per review pass, respecting the prepared two-round limit.

Verify employee and HR views after external events.

Preserve existing repository work.

Do not push, merge, deploy to production, or modify third-party accounts beyond the authorized preview workflow.


## 25. Source and correctness guardrails

Use current primary sources to verify uncertain rules.

Do not spend the live build repeating broad market research.

Do not let internet results override approved runtime configuration.

Do not send uploaded case information to search.

References:

Employer-plan special enrollment:
https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XXV/subchapter-L/part-2590/subpart-B/section-2590.701-6

Section 125 permitted election changes:
https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/section-1.125-4

DOL HIPAA special-enrollment FAQs:
https://www.dol.gov/node/25144

DOL COBRA guidance:
https://www.dol.gov/agencies/ebsa/laws-and-regulations/laws/cobra

CMS transaction standards:
https://www.cms.gov/priorities/key-initiatives/burden-reduction/administrative-simplification/hipaa/adopted-standards-operating-rules

HHS cloud/ePHI guidance:
https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html

IRS employer-size framework:
https://www.irs.gov/affordable-care-act/employers/determining-if-an-employer-is-an-applicable-large-employer

Do not hard-code unsupported universal:
- Proof requirements;
- Cure periods;
- Retroactive refunds;
- State exemptions;
- Age-off dates;
- Carrier turnaround promises.

Mark synthetic policies as assumptions.

When uncertain:
Preserve the request.
Expose the issue.
Assign review.

Before START BUILD:
Return readiness findings and wait.

After START BUILD:
Give a short phase plan and begin implementation.

Continue through implementation, browser verification, correction, and handoff.
