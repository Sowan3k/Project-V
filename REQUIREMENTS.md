<!-- GENERATED FILE - DO NOT EDIT BY HAND.
     Source of truth: Vindeshi_Express_Final_PreDevelopment_Requirements_Baseline.docx
     Regenerate rather than editing. See CLAUDE.md section 2. -->

# Vindeshi Express — Final Pre-Development Requirements Baseline

> Working copy in Markdown, generated verbatim from the frozen DOCX baseline (v2.0, 1 September 2026).
> The DOCX remains the archival artifact. Content is identical; only formatting differs.

ভিনদেশী এক্সপ্রেস

VINDESHI EXPRESS

Working Bengali brand — final public name remains intentionally open

Concept, Functional Requirements and Governance Specification

FINAL PRE-DEVELOPMENT REQUIREMENTS BASELINE

> Purpose of this document This document is the single-source description of the project idea developed through the complete requirements discussion. It defines what the platform is intended to do, how it should behave from a user and community perspective, the decisions already made, trust and safety rules, and the boundaries of the concept. It intentionally does not prescribe software architecture, programming languages, databases, APIs, hosting, or implementation methods.

| Document status | Final pre-development concept and requirements baseline |
|---|---|
| Version | 2.0 — Final baseline before development |
| Date | 1 September 2026 |
| Primary launch audience | Students from Bangladesh planning international higher education |
| Project intent | Public-good platform; not an education agency or commercial consultancy |

## Contents

1. Executive Summary

2. Problem and Rationale

3. Vision, Mission and Product Promise

4. Scope and Guiding Principles

5. Working Brand Direction

6. Users and Roles

7. Core Terminology

8. End-to-End User Experience

9. Route Search and Discovery

10. Ribbon-to-Road Visual Model

11. Route Structure and Step Information

12. Personal Journeys and Private Progress Tracking

13. Live Route Evolution and Change Propagation

14. Shadow Route and Change Comparison

15. Types of Change

16. Community Contribution Model

17. Field Revision, Archival and Non-Destructive Editing

18. Route Creation, Identity, Duplication and Merging

19. Route Lifecycle, Activity and Freshness

20. Expected Timeline and Expected Fly Window

21. Trust, Confidence and Source Provenance

22. Safety: Links, Contacts, Scam and Abuse Controls

23. Reporting and Moderation

24. Privacy and Minimal Personal Data

25. Community Reputation and Incentives

26. Completion and Community Outcome Signals

27. Bangladesh-First Product Positioning

28. Public-Good and Sustainability Principles

29. Functional Requirements Catalogue

30. Business Rules

31. Illustrative User Scenarios

32. Quality Expectations

33. Explicitly Out of Scope

34. Initial Release Scope

35. Future Possibilities

36. Open Decisions

37. Decision Register

38. Final Concept Statement

39. Detailed Content and Field Governance

40. Route Identity, Variation, Branching and Merge

41. Change Impact, Effective Dates, Volatility and User Awareness

42. Detailed Link, Contact and Anti-Scam Requirements

43. Community Self-Correction, Anti-Gaming and Dispute Handling

44. Information Independence and Operating Philosophy

45. Conceptual Risks and Failure Modes

46. Final Pre-Development Scope Freeze

47. Frequently Asked Questions and Clarifications

## 1. Executive Summary

The proposed platform is a Bangladesh-first, community-maintained navigation and tracking service for students pursuing higher education abroad. Its core purpose is not to discover scholarships, rank universities, sell consultancy, or submit applications on behalf of students. Its purpose is to make the process itself understandable, visible, current, and traceable.

A visitor selects an origin, destination, study level, intake or other relevant filters and sees one or more available journeys represented initially as compact visual ribbons. Each ribbon communicates the approximate duration, expected departure window, activity and relevance of that route. When selected, the ribbon unfolds into a visual road consisting of meaningful stages such as academic preparation, tests, document preparation, recognition, admission, scholarships or funding, visa preparation, embassy procedures and departure.

Each road stage can expand to show the actual procedure: what needs to be done, which documents may be required, where the student needs to go, relevant public contacts or addresses, official or community sources, expected time, deadlines, costs when appropriate, and recent community feedback. The platform is intended to convert scattered institutional rules, embassy procedures, university requirements and student experience into a single understandable journey.

Registered users may follow a public route as their own private journey. They can mark stages complete, enter personal dates and notes, and see their own progress without uploading evidence or exposing progress to other users. Their private journey remains linked to the evolving public route. If the public route changes after they begin following it, they can see what changed, when it changed, and whether the change affects unfinished parts of their journey.

Community contribution is central. Signed-in users can create missing routes, add steps and fields, update existing information, confirm that information is still current, or challenge information that is obsolete, incorrect or suspicious. Normal users do not directly delete shared knowledge. Every revision preserves history, enabling correction, rollback, archiving and a visual “shadow route” showing how a route has changed over time.

> Core idea in one line Compare the available ways to reach an overseas study destination, open a route to understand every step, privately follow it as your own journey, and benefit continuously as the community corrects and updates the public route.

## 2. Problem and Rationale

### 2.1 The user problem

Students planning international education must normally assemble a journey from many disconnected sources: university admission pages, scholarship portals, immigration websites, embassy instructions, document-attestation authorities, test providers, social-media groups, YouTube videos, education agents, alumni and friends. These sources answer different fragments of the journey but rarely show how those fragments connect.

A scholarship advertisement may appear attractive even though the applicant cannot obtain a required document before the deadline.

Different universities in the same country may use different admission procedures, tests or recognition requirements.

A country may not maintain an embassy in Bangladesh, so an applicant may need to follow an indirect consular route.

Visa, proof-of-funds, appointment or document rules may change after a student has already started preparing.

Social-media advice may be useful but old, incomplete, unverified, buried in groups, or intentionally deceptive.

Students repeatedly research the same procedures from scratch even though previous applicants have already learned them through experience.

### 2.2 The information-quality problem

The difficulty is not simply finding information. The more serious problem is determining which information is current, how a rule affects the sequence of the journey, whether a requirement is official or community-observed, and whether a change matters to a particular student who is already partway through the process.

> Problem statement There is a gap between scattered information about studying abroad and a living, understandable, community-maintained representation of the actual journey from preparation to departure.

## 3. Vision, Mission and Product Promise

### 3.1 Vision

Students from Bangladesh should be able to understand the road to an overseas study destination without depending on a private agent, fragmented social-media posts, or repeated personal research.

### 3.2 Mission

Provide a public, visual and continuously improving representation of international study journeys, maintained by the people who use them and designed so that changes, uncertainty and historical information remain visible rather than being hidden.

### 3.3 Product promise

> Product promise Show me the available route, every meaningful step before I fly, what has changed, and what I should pay attention to next.

## 4. Scope and Guiding Principles

| Principle | Meaning |
|---|---|
| Process before promotion | The platform is about navigating a journey, not promoting universities or scholarships. |
| Public knowledge, private progress | Routes are public; a user’s personal progress and notes are private. |
| No evidence burden for personal tracking | A user may mark personal tasks complete without uploading IELTS results, passports, admission letters or other evidence. |
| Community freedom with preserved history | Users may improve shared information, but prior states are retained rather than destroyed. |
| Freshness must be visible | Users should be able to see when information was updated or last confirmed and whether the route is active, stale, disputed or developing. |
| Official facts and community experience are different | The product should distinguish authoritative requirements from personal or aggregate community experience. |
| Uncertainty must be shown | A new or poorly maintained route must not look as trustworthy as a well-established route. |
| Safety over convenience for risky content | Unknown links, contacts and payment-related information require stronger caution than ordinary text. |
| Bangladesh first | The first content and route logic should focus on the specific procedures faced by applicants from Bangladesh. |
| Public good | The project is not intended to become an education agency or fee-based consultancy. Ordinary advertising may be considered only as a way to offset operating costs. |

## 5. Working Brand Direction

The original working idea “Fly Monsoon” is no longer the preferred naming direction. Because the initial audience is Bangladeshi and origin-country procedures strongly influence each journey, a Bangla-rooted identity is preferred.

The current naming direction is a Bengali name conveying movement toward a foreign country. “ভিনদেশী এক্সপ্রেস / Vindeshi Express” is an active candidate, while names built around ভিনদেশ (foreign land), পথ (path) and যাত্রা (journey) remain valid alternatives. The final brand name is intentionally not frozen in this document.

> Naming decision Use a Bengali-rooted brand for the Bangladesh-first launch. Final name and domain are still open decisions.

## 6. Users and Roles

| Role | Expected behavior |
|---|---|
| Visitor / Anonymous User | Search routes, compare ribbons, open roads and steps, read fields, sources, activity, history and safety indicators. No account should be required for normal information access. |
| Journey Follower | Signed-in user who follows a public route privately, records progress, dates and notes, and receives in-platform awareness of relevant public-route changes. |
| Contributor | Signed-in user who can create routes, add steps/fields, update current information, confirm accuracy, challenge obsolete or incorrect information, and report safety problems. |
| Trusted / Experienced Contributor | Contributor whose previous revisions are repeatedly confirmed or retained and may therefore carry greater community credibility. |
| Route Maintainer / Volunteer Caretaker | Optional mature-community role for people who voluntarily monitor a route or destination and help review suggested changes. They do not own the route. |
| Administrator / Moderator | Handles abuse, harassment, personal-information exposure, malicious links, disputes, quarantined items, annual maintenance and exceptional archival/removal actions. |

## 7. Core Terminology

| Term | Meaning |
|---|---|
| Route | A public community-maintained path describing one recognizable way of reaching an overseas study objective. |
| Ribbon | The compressed visual representation of a route shown in search results. |
| Road | The expanded visual representation of a selected ribbon, displaying stages in sequence and timeline. |
| Step / Road Block | A major stage of the road, such as IELTS, academic documents, admission, scholarship, visa or departure. |
| Field | A specific information element within a step, such as document, requirement, contact, address, hyperlink, cost, deadline, duration or explanatory text. |
| Journey | A user’s private followed instance of a public route, combining live route information with the user’s own progress and notes. |
| Revision | A preserved new state of route, step or field information after a community update. |
| Shadow Route | The visually faded previous route/version shown beneath or alongside the current route to reveal changes. |
| Confirm | A positive community signal that information is still current or matched the contributor’s recent experience. |
| Challenge | A signal that a route/step/field is obsolete, incorrect, misleading or otherwise problematic. |
| Archive | Removal from normal current display while preserving historical information and links to past journeys. |
| Expected Fly Window | An approximate departure period inferred from the route timeline; a planning window, not a guaranteed flight date. |
| Temporary Disruption | Short-lived event such as weather cancellation or temporary embassy closure that affects a route without permanently redefining it. |

## 8. End-to-End User Experience

| Search | → | Compare Ribbons | → | Open Road | → | Inspect Steps |
|---|---|---|---|---|---|---|

| Follow Journey | → | Track Progress | → | Receive Changes | → | Confirm / Update |
|---|---|---|---|---|---|---|

### 8.1 Anonymous discovery

A visitor should be able to search and understand routes without being forced to register. The first interaction should resemble searching for a journey rather than browsing articles.

### 8.2 Route comparison

Search results present multiple compact ribbons when multiple routes exist. The visitor compares approximate duration, expected departure window, number of followers, recent activity, route maturity and major visual stages before choosing one to open.

### 8.3 Detailed route use

Selecting a ribbon expands it into a road. Major steps can be opened to reveal detailed procedure and fields. The user should be able to collapse the detail and return to the visual journey at any time.

### 8.4 Optional personal tracking

A signed-in user may follow a route. This creates a private journey view where the user marks progress, records personal dates or notes, and sees route changes relevant to unfinished stages.

### 8.5 Community feedback loop

After a user completes or experiences a step, the platform should make it easy to confirm that the public information was correct or to suggest an update if it was not. This converts fresh firsthand experience into reusable knowledge for future students.

## 9. Route Search and Discovery

Route discovery should start with a small number of understandable filters. The system may later support more filters, but it should not require a detailed student profile before showing useful information.

| Search element | Purpose |
|---|---|
| Origin | Bangladesh at launch; origin matters because document, embassy and consular routes differ. |
| Destination | Country to which the student wants to travel for study. |
| Study Level | Bachelor’s, Master’s, PhD or another supported higher-education level. |
| Intake / Target Period | When relevant, allows route timelines and departure windows to be understood in context. |
| Funding / Route Mechanism | Optional filter such as direct admission, government scholarship, university scholarship or another materially different route. |
| Other route filters | May include field of study, institution or route-specific attributes only where useful. |

The platform should not assume that there is only one correct route per destination. Multiple routes may coexist because procedures, funding mechanisms, universities, timelines and applicant strategies differ.

## 10. Ribbon-to-Road Visual Model

### 10.1 Ribbon search result

A route should initially appear as a compact horizontal visual ribbon rather than a conventional rectangular information card. The ribbon is a compressed representation of the future road. Its colored segments correspond to major categories of steps and provide a quick visual sense of length and sequence.

> Ribbon principle The ribbon is not a decorative preview. It is the compressed route. When opened, its segments expand into the actual road.

### 10.2 Information shown on a ribbon

Route title or recognizable route type.

Approximate total journey duration or planning window.

Expected fly/departure window.

Number of people currently following or using the route for tracking purposes.

Recent change/activity indicator.

Route maturity or confidence indicator such as Established, Developing, Experimental or Disputed.

### 10.3 Expanded road

When selected, the ribbon should unfold into a route road made of visually distinct road blocks. Each block represents a major step. The user can understand the journey at a glance and then widen or expand a block to inspect its fields.

### 10.4 Color meaning

Color should communicate the category of work rather than being randomly assigned. For example, documentation, language/testing, university/admission, funding, immigration/visa and travel may use distinct visual categories. Text and icons should accompany color so the meaning does not depend on color alone.

## 11. Route Structure and Step Information

Each route is composed of ordered or partially overlapping steps. A step may represent a mandatory action, optional action, waiting period, decision, test, document process, application, funding action, immigration action or travel stage.

### 11.1 What a step may contain

| Field category | Expected content |
|---|---|
| Plain-language explanation | What the step means and why it exists. |
| Procedure | What the student is expected to do. |
| Documents | Documents that may be required for this step. |
| Where to go | Office, authority, university, embassy, testing center or other public destination. |
| Address | Public institutional or business address where appropriate. |
| Contact | Public telephone, email or official contact channel, subject to stronger trust rules. |
| Hyperlink | Official or community reference link, visibly classified by trust/source status. |
| Cost | Known fee or approximate cost where appropriate, clearly distinguished from proof-of-funds or optional expenses. |
| Duration | Typical or expected duration, with uncertainty where appropriate. |
| Deadline / effective period | When action should be completed or when a rule becomes effective. |
| Dependency | What should normally happen before or after the step. |
| Source / provenance | Where the information came from and whether it is official or community experience. |
| Last updated / confirmed | Freshness indicator. |
| Community signals | Confirmations, challenges, recent update activity or unresolved concerns. |
| History | Previous versions of the step or fields. |

### 11.2 User-created fields

Contributors may add field names and field content when an existing step lacks important information. Fields may contain text, public contact information, public address, hyperlinks, dates, costs, durations, instructions or other relevant information. Field types may be presented differently depending on risk and meaning.

## 12. Personal Journeys and Private Progress Tracking

A signed-in user may choose to follow a public route for tracking purposes. This does not create an independent disconnected copy. Conceptually, the personal journey remains linked to the live public route while storing the user’s progress separately.

> Personal journey model Live public route + private user progress = My Journey.

### 12.1 What the user may record privately

Step status such as not started, in progress, completed, skipped or not applicable.

Personal target date or expected date.

Actual completion date.

Short private notes, similar to a personal notebook.

Optional personal tasks that do not belong in the public route.

### 12.2 No evidence requirement

The platform is not intended to verify whether the user genuinely completed IELTS, received admission, submitted a visa or completed another step. The tracker is for the user’s own benefit. Therefore the user should not be asked to upload supporting evidence merely to mark a personal step complete.

### 12.3 Privacy of progress

Other users must not be able to see an individual user’s journey progress, notes, target dates, scores or completion status. Public statistics may use aggregated signals only where they do not expose private individual progress.

## 13. Live Route Evolution and Change Propagation

A route must remain capable of changing after users begin following it. Community updates should improve the live public route while preserving earlier states.

### 13.1 Effect on followers

When the live route changes, users following the route should see that new information exists. The platform should emphasize changes affecting unfinished or upcoming steps rather than forcing the user to reread the entire route.

### 13.2 Personal data is not overwritten

A public change must not silently erase a user’s private progress or notes. If the user completed a step before a requirement changed, the journey should preserve that completion and explain that the public route changed after the user’s recorded date.

### 13.3 User control over applicability

Where the platform cannot confidently determine whether a rule change applies to a follower, the follower should be shown the change and allowed to mark it as applicable, already handled, or not applicable to their case.

## 14. Shadow Route and Change Comparison

A defining visual feature is the shadow of a previous route/version beneath or alongside the current route. The objective is to let a user understand the scale of change visually rather than only through a text log.

### 14.1 Shadow behavior

Current route is the primary solid road.

Previous route/version appears faded as a shadow.

New steps are visibly introduced.

Removed/archived stages remain visible in the shadow rather than disappearing from history.

Reordered stages or changed branches should be visually apparent.

The interface may summarize the scale of change, such as “2 steps added, 1 archived, 3 fields changed.”

### 14.2 Follower comparison

A user may compare the route they originally followed with the current live route. The system should focus attention on changes ahead of the user’s current progress.

## 15. Types of Change

Not every new event should modify the permanent route. The platform should distinguish the following categories at the product level:

| Change type | Meaning |
|---|---|
| Structural Route Change | A lasting change to the journey sequence or required steps, such as a new visa prerequisite. |
| Field / Information Correction | A changed phone number, fee, address, deadline, link, duration or text within an existing step. |
| Temporary Disruption | Short-term condition such as weather cancellation, temporary office closure, exam rescheduling or emergency disruption. It affects users temporarily but should not permanently redefine the route unless the change becomes lasting. |
| Community Experience | Observed real-world experience such as recent waiting times or interview behavior. It should remain distinguishable from official rules. |
| Historical Revision | A prior route, step or field state retained for transparency and comparison. |

## 16. Community Contribution Model

The core community actions should be easy to understand and available to signed-in contributors. The community should not need to understand software or technical data structures.

| ADD | → | UPDATE | → | CONFIRM | → | CHALLENGE |
|---|---|---|---|---|---|---|

### 16.1 ADD

Create a missing route, add a missing step, or add a missing field within a step.

### 16.2 UPDATE

Provide a newer or corrected value for existing information. An update creates a new revision and does not permanently destroy the old value.

### 16.3 CONFIRM

Indicate that information was still current or matched the contributor’s recent experience. Confirmations are essential because silence does not prove that old information remains accurate.

### 16.4 CHALLENGE

Mark information as obsolete, incorrect, misleading, incomplete, suspicious or otherwise in need of review. Challenges should capture reason where possible rather than acting as a generic dislike button.

### 16.5 Contribution at the right moment

The platform should encourage contribution immediately after a follower marks a step complete, because this is when firsthand knowledge is freshest. A lightweight prompt such as “Was this step still accurate?” can generate confirmations or corrections without requiring a separate contribution campaign.

## 17. Field Revision, Archival and Non-Destructive Editing

### 17.1 No normal-user deletion

Ordinary contributors should not have a direct destructive delete function for shared route knowledge. They may update a field or challenge it as obsolete, incorrect or unsafe.

### 17.2 Revision history

Every meaningful update should preserve the prior value. If multiple contributors change a field over time, the history should remain visible so that mistakes can be reversed and contradictory periods can be understood.

### 17.3 Archiving obsolete fields

A field that is no longer needed may be challenged as obsolete. Once community signals or moderation determine that it should not remain current, it becomes archived rather than erased. Archived information should normally disappear from the main current view but remain available in history.

### 17.4 Challenge reasons

No longer required / obsolete.

Incorrect.

Broken link.

Wrong contact or address.

Duplicate information.

Unsafe / scam / phishing concern.

Personal information / harassment concern.

Other explainable reason.

### 17.5 Frequently edited information

If a field is changed repeatedly in a short period or receives conflicting confirmations/challenges, the product should communicate that volatility to readers rather than presenting the newest value as unquestioned truth.

## 18. Route Creation, Identity, Duplication and Merging

### 18.1 Community-created routes

Signed-in contributors should be able to create routes that do not yet exist. Newly created routes must not automatically look as mature as established routes. They begin with a visible developing/experimental status until they gain meaningful use, sources, confirmations or community activity.

### 18.2 Multiple valid routes

Multiple routes for the same origin and destination are acceptable when their journey differs materially in process, timing, scholarship mechanism, institution-specific pathway or other meaningful content. The road itself may therefore look different in sequence, duration and information.

### 18.3 Permanent route identity

Although users recognize routes through their visual road and content, every route must conceptually remain a distinct persistent object so followers, history, revisions and archival actions stay attached to the correct route. The implementation method is outside the scope of this document.

### 18.4 Duplicate routes

A new route that substantially duplicates an existing route should be discouraged from unnecessary duplication and may later be merged. Route merging should preserve the followers’ private journeys and historical contributions rather than causing data loss.

### 18.5 No route ownership

A route creator contributes the first version but does not own the shared route. The community must be able to improve it even if the creator becomes inactive or disagrees with later corrections.

## 19. Route Lifecycle, Activity and Freshness

Activity is an important signal but not proof of correctness. A route may receive little activity simply because it is seasonal or less popular. The platform should therefore treat inactivity as a freshness warning rather than immediate evidence that the route is false.

| Lifecycle status | Meaning |
|---|---|
| Experimental / Community Draft | Newly created; limited community history and verification. |
| Developing | Some followers, sources or confirmations exist, but coverage is still incomplete. |
| Established / Active | Meaningful use, recent confirmations and useful history. |
| Quiet | No recent activity, but no strong evidence of a problem. |
| Stale / Needs Review | Information has not been confirmed for a significant period or route-specific review is overdue. |
| Disputed | Important information is being challenged or serious conflicts remain unresolved. |
| Dormant | A new/low-value route has no meaningful activity or followers for a defined period, such as roughly 30 days; removed from normal prominence but preserved. |
| Archived | No longer a current route but retained for history and existing personal journeys. |
| Removed / Hidden | Reserved for abuse, personal-information exposure, malicious content or exceptional administrative reasons. |

### 19.1 Thirty-day inactivity decision

The original idea of automatically treating all routes as inactive after 30 days without activity was refined. A 30-day dormancy rule is appropriate mainly for newly created routes with no followers, confirmations or useful activity. Established routes should instead display their last confirmation and become stale only after a more meaningful period or lack of verification.

### 19.2 Annual maintenance

The administrator may periodically perform an annual review by destination: merge duplicates, archive obsolete routes, refresh categories, remove abuse, and perform feature/content housekeeping. Normal historical information should be archived rather than destroyed.

## 20. Expected Timeline and Expected Fly Window

The platform should communicate the approximate time required for a route and an expected departure window. This is one of the intended signature features because students care not only about deadlines but also about when the complete process may realistically allow them to leave.

### 20.1 Expected fly window

The route should normally display a window such as “Expected fly: August–October 2027” rather than a precise guaranteed date. The window communicates planning uncertainty and should change when the route timeline changes materially.

### 20.2 Parallel activities

Not all route steps happen sequentially. A student may prepare IELTS while collecting documents, or financial preparation may overlap with visa-document preparation. The visual timeline should therefore be capable of communicating overlap rather than merely adding every duration in a straight line.

### 20.3 Dates and duration fields

Where information is known, individual steps may show recommended start period, hard deadline, typical duration, waiting time or effective date. These values should be clearly identified as official, estimated or community-observed.

## 21. Trust, Confidence and Source Provenance

The platform’s credibility depends on showing the origin and freshness of information rather than pretending every field is equally authoritative.

| Source class | Interpretation |
|---|---|
| Official | Government, embassy, university, recognized testing body, scholarship provider or other authoritative first-party source. |
| Institutional / Public | Recognizable public organization or official business/institutional source not necessarily the primary rule-making authority. |
| Community Confirmed | Information repeatedly confirmed through user experience but not established as an official rule. |
| Community Submission | A contribution from one or a small number of users with limited corroboration. |
| Disputed / Under Review | Information with unresolved challenges, safety concerns or conflicting revisions. |

### 21.1 Route confidence

The platform may communicate route confidence or maturity using combined signals such as age, sources, confirmations, contributor history, recent activity, unresolved challenges and follower use. Popularity alone must not be treated as proof of correctness.

### 21.2 Route passport / route history summary

A route may expose an at-a-glance history such as created date, follower count, contributor count, change count, last meaningful change, last confirmation, number of sources and unresolved reports. This gives readers context before relying on the route.

## 22. Safety: Links, Contacts, Scam and Abuse Controls

The project is motivated partly by the risk of scams and misinformation. The contribution model must therefore be open without making arbitrary community links or contact information immediately look trustworthy.

### 22.1 Link trust classes

| Link status | Expected treatment |
|---|---|
| Trusted / Established domain | Official or otherwise established domain that can be presented normally with visible source status. |
| Community-submitted link | May be useful but not yet established. It should remain visibly unverified and should not be presented as official. |
| Quarantined / Blocked | Reported or suspicious link that should be hidden from normal use pending review or after confirmation of abuse. |

### 22.2 Visibility and destination clarity

The visible domain/destination should be understandable before a user leaves the platform.

Unknown shortened URLs should not be treated as official process links.

A contributor should not be able to replace a trusted official link with an unknown domain and immediately make the replacement look authoritative.

External links should be clearly separated from Fly Monsoon/Vindeshi Express content.

### 22.3 Contact information

Public contacts may be contributed, but phone numbers and personal-looking contact details carry harassment risk. New or changed contacts should display source and trust information. Reports such as “private person’s number,” “wrong contact,” “impersonation” or “scam” should permit rapid hiding/quarantine while retaining history for moderation.

### 22.4 Payment and money-related content

Payment instructions, personal bank accounts, mobile-wallet numbers and similar content are high risk. The platform should never make a community-submitted payment instruction appear equivalent to an official institution payment channel. Route ranking or trust must never be purchasable.

### 22.5 Adult, phishing and malicious content

Because arbitrary links can lead to phishing, pornography, malware or changed content, the safety principle is preventative: unknown links should not immediately inherit trust simply because a signed-in user added them. Community reporting, contributor reputation and quarantine should allow suspicious destinations to be hidden quickly.

## 23. Reporting and Moderation

### 23.1 Reporting should be distinct from ordinary challenge

A routine challenge means “this information is no longer correct.” A report means “this may be abusive or unsafe.” Reports should therefore support reasons such as phishing/scam, adult content, malware/download, impersonation, harassment/personal information, malicious contact, spam or other serious concern.

### 23.2 Temporary hiding / quarantine

High-risk content may be temporarily hidden or quarantined when credible reports reach an appropriate threshold. The administrator can then restore, correct, archive or remove the item. Exact thresholds are an operational decision and are not fixed in this concept baseline.

### 23.3 Administrator role

The administrator should not be expected to approve every normal contribution. Manual intervention is primarily for safety, disputes, abuse, annual maintenance and exceptional cases. The long-term objective is a community that maintains ordinary route accuracy itself.

## 24. Privacy and Minimal Personal Data

The platform should deliberately avoid becoming a repository of sensitive student documents. The personal tracker is intended as a lightweight self-managed notebook, not an evidence vault.

### 24.1 Information the platform does not need for the core concept

Passport scans.

Degree or transcript uploads.

IELTS/PTE certificates.

Bank statements or proof of funds.

Visa documents.

Admission letters.

Private residential address.

### 24.2 Account information

A user account is required for contribution and persistent private tracking. The exact sign-in method is not fixed, although a familiar external sign-in option such as Google may be considered. The product principle is to collect only what is necessary to identify an account and preserve the user’s private journey.

### 24.3 Public identity

Contributors need not expose their real identity publicly. The system may show an optional public username or a neutral contributor identity, together with contribution history or reputation signals where useful.

## 25. Community Reputation and Incentives

Community participation should be encouraged because people who have just experienced a route often know exactly what was confusing, outdated or missing. However, reputation should reward useful contributions rather than raw volume.

Accepted or repeatedly confirmed updates may increase contributor credibility.

Frequently reversed, spammy or reported contributions may reduce credibility.

Long-term contributors may become trusted contributors or volunteer route maintainers.

Positive recognition may include badges, contribution counts or messages such as “Your updates helped future students,” without turning the platform into a competitive points game.

The creator of a route does not receive permanent control over it.

## 26. Completion and Community Outcome Signals

A follower may voluntarily mark a personal journey as completed or indicate that they flew/started the intended study journey. No evidence is required because the primary purpose remains personal tracking.

If aggregate completion numbers are shown publicly, the wording must accurately reflect self-reporting, for example: “116 users marked this journey completed,” not “116 verified visas” or “116 successful admissions.”

### 26.1 Followers as a relevance signal

The number of people following a route is useful for understanding current relevance and community activity, but it must not be treated as proof that the route is correct or safe.

## 27. Bangladesh-First Product Positioning

The initial platform is explicitly for students beginning their journey from Bangladesh. This is not merely a language choice. Origin-country procedures affect document authentication, embassy jurisdiction, testing logistics, payment mechanisms, local authorities and practical sequencing.

A route designed for a student from India, Pakistan, Nigeria or another country may not match a Bangladeshi route even when the destination and university are identical. International expansion, if it ever occurs, should therefore treat origin-country routes as distinct rather than assuming one global process.

### 27.1 Initial destination focus

The initial content may be manually seeded for a small number of popular destinations such as Germany, Australia, the United States and Malaysia. Additional countries and routes should increasingly be created and maintained by the community.

## 28. Public-Good and Sustainability Principles

The project is not intended as a commercial education business. The founder does not intend to sell consultation, paid placement, visa assistance or premium route ranking. The objective is to help students understand and navigate processes.

### 28.1 Cost philosophy

The initial intention is to invest as little as possible beyond essential ownership costs such as a domain. Free or low-cost operation is preferred. If the platform becomes large, unavoidable operating costs may arise; this does not change the public-good purpose.

### 28.2 Advertising

Ordinary advertising, such as general web advertising, may eventually be considered only to offset operating cost. Advertising must remain visibly separate from route order, route confidence, source status, agency trust and community governance.

> Non-negotiable trust principle No organization should be able to pay to become “official,” increase route confidence, suppress community challenges, or rank its route higher.

## 29. Functional Requirements Catalogue

The following requirements translate the concept into observable product behavior. They describe what the platform should do, not how it should be implemented.

| ID | Requirement | Statement |
|---|---|---|
| FR-01 | Public route access | Visitors shall be able to browse and open route information without creating an account. |
| FR-02 | Route search | Visitors shall be able to search routes using origin and destination, with study level/intake and other relevant filters where available. |
| FR-03 | Multiple results | The platform shall be able to show multiple distinct routes for the same destination when different journeys exist. |
| FR-04 | Ribbon presentation | Search results shall represent routes as compact visual ribbons showing key timeline and activity signals rather than conventional information cards. |
| FR-05 | Ribbon expansion | Selecting a ribbon shall expand it into a visual road whose segments correspond to the ribbon stages. |
| FR-06 | Step expansion | A user shall be able to expand individual road blocks/steps to view procedure and detailed fields. |
| FR-07 | Flexible fields | Steps shall support community-added fields such as text, documents, requirements, contact, address, link, cost, deadline and duration. |
| FR-08 | Expected fly window | Routes shall be able to display an approximate expected departure window. |
| FR-09 | Timeline visibility | Routes shall visually communicate approximate timing, including overlapping activities where relevant. |
| FR-10 | Route activity | Routes shall display relevant activity/freshness signals such as followers, recent changes and last confirmation. |
| FR-11 | Route status | Routes shall display an understandable maturity/lifecycle state such as Experimental, Developing, Established, Stale, Disputed or Archived. |
| FR-12 | Account-only contribution | Only signed-in users shall be allowed to create or revise shared route content. |
| FR-13 | Create route | Signed-in users shall be able to create a missing route. |
| FR-14 | Add step | Signed-in users shall be able to add a missing step to a route. |
| FR-15 | Add field | Signed-in users shall be able to add a missing field to a step. |
| FR-16 | Update | Signed-in users shall be able to propose/update current field or step information. |
| FR-17 | Confirm | Signed-in users shall be able to confirm that information is still current. |
| FR-18 | Challenge | Signed-in users shall be able to challenge information as obsolete, wrong, suspicious or otherwise problematic. |
| FR-19 | No destructive normal delete | Normal contributors shall not be able to permanently delete shared route knowledge. |
| FR-20 | Revision history | Updates shall preserve prior information as revisions/history. |
| FR-21 | Archive obsolete content | Obsolete content shall be capable of moving out of the current view while remaining available in history. |
| FR-22 | Shadow route | The platform shall be able to visually compare a current route with one or more prior route versions. |
| FR-23 | Follow route | A signed-in user shall be able to follow a public route as a private personal journey. |
| FR-24 | Private progress | A journey follower shall be able to mark private step status, dates and notes. |
| FR-25 | No evidence upload requirement | The platform shall not require documentary proof merely to update personal journey progress. |
| FR-26 | Private journey visibility | A user’s personal progress and notes shall not be visible to other ordinary users. |
| FR-27 | Live-link behavior | A user’s personal journey shall remain associated with the evolving public route rather than becoming a permanently disconnected copy. |
| FR-28 | Change notification in journey | A follower shall be able to see that the live route changed after they began following it. |
| FR-29 | Change relevance | The journey view should emphasize changes affecting incomplete/upcoming stages. |
| FR-30 | Preserve personal state | Public route changes shall not silently erase or reset a follower’s private progress. |
| FR-31 | Change history | Users shall be able to inspect what changed and when. |
| FR-32 | Temporary disruptions | The platform shall be able to represent temporary disruptions without permanently changing the base route. |
| FR-33 | Official/community distinction | The platform shall visibly distinguish official/institutional sources from community experience. |
| FR-34 | Link classification | Submitted links shall be capable of being shown as trusted, community-submitted/unverified, or quarantined/blocked. |
| FR-35 | Report unsafe content | Users shall be able to report phishing, adult content, malware, impersonation, personal information, scam/spam and other serious concerns. |
| FR-36 | Quarantine | High-risk content shall be capable of temporary hiding/quarantine pending review. |
| FR-37 | Contact safety | Public contact fields shall support source/trust status and rapid reporting for harassment or personal-information concerns. |
| FR-38 | Route dormancy | New routes with no meaningful use or activity may automatically become dormant after an appropriate period such as 30 days. |
| FR-39 | Established route freshness | Established routes shall not be treated as false merely because of 30 days without activity; they shall instead expose freshness/last-confirmed information. |
| FR-40 | Route merge | Substantially duplicate routes shall be capable of later merging without losing followers’ personal progress or contribution history. |
| FR-41 | Completion signal | Followers shall be able to self-mark a journey as completed, with public aggregates described as self-reported. |
| FR-42 | Feedback after completion | After completing a step, followers should be offered a lightweight opportunity to confirm accuracy or suggest a change. |
| FR-43 | Contributor history | The platform shall be able to distinguish new contributors from contributors whose past changes have earned community credibility. |
| FR-44 | Route creator non-ownership | Creating a route shall not grant permanent control over its future content. |
| FR-45 | Archive access | Historical or archived route information should remain viewable for transparency where safety does not require removal. |
| FR-46 | Annual maintenance | The administrator shall be able to periodically archive obsolete routes, merge duplicates and remove abusive content. |
| FR-47 | Advertising separation | Any future advertising shall not alter route ordering, source classification, community trust or confidence status. |
| FR-48 | Bangladesh origin specificity | Initial routes shall reflect Bangladesh-specific document, embassy, testing and procedural realities rather than generic destination-only guidance. |
| FR-49 | Public field freshness | Fields shall be able to display last updated/confirmed information and unresolved community challenges. |
| FR-50 | Low-friction feedback | Confirm, update, challenge and report actions shall be understandable and require minimal unnecessary form filling. |
| FR-51 | Field category | Each public field shall be identifiable by a meaningful category such as requirement, procedure, document, contact, address, link, cost, deadline, duration, experience or warning. |
| FR-52 | Field expiry/freshness | Fields shall support expiry, review-needed or last-confirmed behavior appropriate to their type. |
| FR-53 | Field edit instability | Frequently revised or disputed fields shall be capable of displaying visible instability/review status. |
| FR-54 | Official/community separation | Community experiences shall not overwrite official requirements; both may coexist with clear labels. |
| FR-55 | Positive confirmation | Users shall be able to confirm that a route/field was still accurate, not only report problems. |
| FR-56 | Meaningful route variants | Multiple routes for the same destination shall be allowed when the actual procedure/timing/pathway materially differs. |
| FR-57 | Route branches | A route shall be capable of representing optional/alternative branches where real processes diverge and reconnect. |
| FR-58 | Merge preservation | When duplicate routes are merged, follower progress, useful contribution history and route history shall not be lost. |
| FR-59 | Announcement/effective dates | Material changes shall support announcement/discovery date and effective date where known. |
| FR-60 | Change severity | Route changes shall be classifiable as informational, relevant, important or critical (or equivalent public wording). |
| FR-61 | Change relevance | Followers shall be shown changes in context of completed versus unfinished personal steps rather than having progress silently reset. |
| FR-62 | Route volatility | Routes should be capable of showing recent change activity/volatility based on material revision history. |
| FR-63 | Temporary disruption scope | Temporary disruptions shall support limited date/location/process scope and shall resolve without permanently rewriting the route. |
| FR-64 | Visible external destination | External links shall expose their destination/domain before a user leaves the platform. |
| FR-65 | Obscured link caution | Shortened, obscured or unknown links shall not be treated as official/trusted process links merely because a user submitted them. |
| FR-66 | Trusted domain separation | Official/trusted-source status shall be distinguishable from ordinary community-submitted domains. |
| FR-67 | External-content separation | Unknown external content shall remain clearly external and shall not visually inherit the platform’s authority. |
| FR-68 | Agency neutrality | Agency/service-provider information may be displayed as public information but shall not create endorsement, paid trust or route priority. |
| FR-69 | Self-correcting revisions | A signed-in user shall be able to revise a field previously revised by another user while preserving all earlier revisions. |
| FR-70 | Dispute visibility | Conflicting community claims shall be capable of being shown as disputed/under review instead of silently choosing a false certainty. |
| FR-71 | Anti-gaming | Raw follower counts, votes or reports shall not be the sole automatic determinant of trust, ranking, deletion or archival. |
| FR-72 | Native route knowledge | Core route knowledge shall exist as platform/community content rather than depending on a third-party study-abroad data feed. |
| FR-73 | No private-message dependency | Core community correction shall occur around routes/steps/fields and shall not require an open private-messaging social network. |
| FR-74 | Route risk transparency | New, disputed, stale or low-history routes shall visibly communicate uncertainty before a user relies on them. |
| FR-75 | Cold-start seeding | The first release shall contain a useful manually prepared baseline of Bangladesh-origin routes before relying on community expansion. |
| FR-76 | Notification priority | If change notices are shown, the product shall distinguish routine information from action-relevant or critical changes. |
| FR-77 | Route shadow scale | Shadow/history comparison should show not only that a route changed, but the location and scale of additions, removals, reordering or material field changes. |
| FR-78 | Public-good neutrality | No paid actor shall be able to purchase confidence, official-source classification, trusted status or route prominence. |
| FR-79 | Content-scope discipline | The first release shall remain focused on navigation/tracking rather than becoming a consultancy, application manager, document vault or general social network. |
| FR-80 | Requirements traceability | First-release product behavior shall be traceable to this final baseline; materially new features shall be treated as requirement changes. |
| FR-81 | Information applicability | Each information element shall record the applicability of its claim — such as route-wide, origin-specific, application-channel-specific, institution-specific, programme-specific or intake-specific — separately from its source classification, and shall support more than one applicability where a claim depends on more than one dimension. Information whose scope is narrower than the route shall not be presented in a way that implies it applies universally. |

## 30. Business Rules

| Rule | Statement |
|---|---|
| BR-01 | Shared content is community knowledge; route creators do not own routes. |
| BR-02 | Normal users may not permanently delete public route knowledge. |
| BR-03 | Every accepted/current update must retain a recoverable prior state unless safety/legal removal requires otherwise. |
| BR-04 | No reports is not evidence that a route is trustworthy. |
| BR-05 | Follower count is a relevance signal, not a correctness guarantee. |
| BR-06 | Personal journey updates require no evidence because they are private self-management data. |
| BR-07 | Official requirements and community experiences must not be presented as the same type of claim. |
| BR-08 | Temporary disruptions should expire or resolve without permanently redefining the route unless they become structural changes. |
| BR-09 | A new community route must visibly indicate limited maturity until it gains meaningful history. |
| BR-10 | An established route does not become invalid solely because it has no activity for 30 days. |
| BR-11 | Safety reports are treated differently from ordinary accuracy challenges. |
| BR-12 | High-risk links, contacts and payment details require greater caution than ordinary explanatory text. |
| BR-13 | Route confidence cannot be purchased. |
| BR-14 | Advertising cannot alter public route ranking or trust. |
| BR-15 | Archived information remains historical knowledge; removal is exceptional. |
| BR-16 | A user’s private progress remains private even when public route statistics are shown. |
| BR-17 | Changes to the public route do not automatically invalidate previously completed personal steps. |
| BR-18 | Route timelines and expected fly windows are estimates/planning aids, not promises. |
| BR-19 | Bangladesh-specific origin procedures take precedence over generic global advice in Bangladesh routes. |
| BR-20 | The product is an information/navigation community, not an admission, visa or scholarship decision authority. |
| BR-21 | A field’s current value does not erase earlier revisions. |
| BR-22 | A community experience cannot silently replace an official requirement. |
| BR-23 | A frequently changed field should expose instability rather than pretending certainty. |
| BR-24 | A route may contain branches or overlapping steps when the real process does. |
| BR-25 | Route merging must preserve follower progress and useful history. |
| BR-26 | Where known, effective date matters more than edit date for deciding whether a requirement affects a follower. |
| BR-27 | Temporary events are overlays/disruptions, not permanent route revisions unless the underlying policy actually changes. |
| BR-28 | An unknown domain cannot become an official source merely because a signed-in user labels it as such. |
| BR-29 | External destinations should be visible before users leave the platform; obscured destinations receive lower trust. |
| BR-30 | The platform does not endorse an agency merely because its public information appears in a route. |
| BR-31 | Reputation increases credibility but never creates permanent ownership or immunity from correction. |
| BR-32 | Raw votes, follower counts or mass reports are never the sole basis for public trust decisions. |
| BR-33 | Core study-route knowledge is maintained inside the platform/community rather than outsourced to a proprietary data feed. |
| BR-34 | Community interaction should remain attached to useful route knowledge rather than becoming an entertainment/social-feed product. |
| BR-35 | After this baseline is frozen, materially new first-release ideas are change requests, not implicit requirements. |

## 31. Illustrative User Scenarios

### 31.1 Visitor comparing Germany routes

A visitor chooses Bangladesh → Germany → Master’s → Winter 2027.

Several route ribbons appear, for example direct university admission and a scholarship route.

Each ribbon shows approximate duration, expected fly window, follower count, recent changes and maturity.

The visitor opens one ribbon; it unfolds into a road with document, test, admission, financial, visa and departure stages.

The visitor opens the visa block to view the current procedure, relevant documents, sources, contact information, history and community signals.

### 31.2 User privately following the route

The user signs in and follows the route.

The user marks passport and IELTS complete, records a personal exam date and writes a private note.

Nobody else can see the note or progress.

The public road remains live and continues receiving community updates.

### 31.3 New visa document added

Community contributors update the visa step because a new document becomes required from a future effective date.

The old field remains in revision history.

The route shows a visible change and the shadow route reveals the earlier state.

A follower who has not yet submitted the visa sees an important change ahead.

A follower who submitted before the effective date retains their completed status and sees contextual information instead of being reset.

### 31.4 Weather disruption affecting IELTS

A temporary event causes certain IELTS sessions in Dhaka to be rescheduled.

Contributors add a temporary disruption with date/location scope rather than permanently modifying the normal IELTS process.

Followers whose personal test date may be affected see a relevant warning when they return to their journey.

After the disruption expires, the normal route remains unchanged.

### 31.5 Wrong community link

A new contributor adds an unknown link to a route field.

The link does not automatically appear as an official trusted source.

Users report the domain as phishing or unsafe.

The link becomes quarantined/hidden and remains available to the administrator for review/history.

### 31.6 Obsolete field

A route contains a document field that is no longer required.

Signed-in users challenge it as obsolete and may propose the replacement/current requirement.

Once the current state is established, the obsolete field is archived rather than deleted.

Past followers and the route history can still reveal that it existed previously.

## 32. Quality Expectations

| Quality expectation | Meaning |
|---|---|
| Clarity | A first-time student should understand the route without knowing immigration or admissions jargon. |
| Visual continuity | The ribbon shown in search results should clearly correspond to the expanded road. |
| Transparency | Current information, historical information, source type and community uncertainty should be visible rather than hidden. |
| Low friction | Normal browsing requires no account; contribution and private tracking require only the minimum necessary interaction. |
| Recoverability | Mistaken edits should be correctable because prior revisions remain available. |
| Safety awareness | Unknown community content must not visually inherit the authority of official content. |
| Accessibility | Important meaning should not depend only on color, hover behavior or fine visual detail. |
| Mobile usefulness | The concept should remain understandable on a phone because many students will access it through mobile browsers. |
| Neutrality | The platform should not favor a university, agent or route because of payment. |
| Simplicity | The product should resist feature expansion that turns it into a social network, agency or application-management service. |

## 33. Explicitly Out of Scope

The following capabilities were discussed implicitly or explicitly and are not part of the core concept baseline:

Uploading or storing students’ passports, transcripts, bank statements, IELTS certificates, visa documents or admission letters.

Verifying a follower’s private claim that a personal step is complete.

Submitting university, scholarship or visa applications on behalf of users.

Providing paid admissions or visa consultancy.

Guaranteeing admission, scholarship, visa approval, safety or successful travel.

Ranking routes according to sponsorship or payments.

Operating as a social-media feed, entertainment network or open private-messaging platform.

Building a scholarship directory as the primary purpose of the platform.

Requiring artificial intelligence as a core feature.

Requiring live external data integrations to maintain public route content.

Flight booking, accommodation booking, loans, jobs or travel sales in the initial concept.

Patent-level claims that no related idea exists anywhere; the differentiation lies in the integrated community-maintained journey model.

## 34. Initial Release Scope

The first release should prove the route model and community behavior rather than attempt global coverage. The following scope reflects the decisions made during requirements discussion:

Bangladesh as the origin country.

A small number of popular destinations manually seeded by the founder, likely Germany, Australia, the United States and Malaysia.

A limited number of meaningful route variants for each destination rather than hundreds of shallow routes.

Anonymous search and route viewing.

Ribbon-to-road experience with expandable steps and fields.

Signed-in route following and private progress tracking.

Community creation of new routes/steps/fields.

ADD, UPDATE, CONFIRM and CHALLENGE actions.

Revision history, archival and route/field freshness indicators.

Reporting/quarantine for unsafe links, contacts and abusive content.

Shadow-route comparison when routes change.

Expected timeline / expected fly window.

> MVP success question Do students voluntarily return to track their journeys and correct or confirm public route information after experiencing the real process?

## 35. Future Possibilities

The following ideas may become useful later but should not distract from the initial route-navigation mission:

Volunteer destination or route maintainers who adopt stale routes for community review.

More sophisticated aggregate community statistics such as self-reported processing-time distributions.

Email or other proactive alerts for critical changes, if users choose to receive them.

Additional origin countries, each with its own origin-specific route sets.

More advanced route health/volatility indicators based on change history.

Multilingual interface beyond Bangla/English.

Research/archive view showing historical versions of international education procedures.

General advertising only if needed to offset operating costs, without influencing route governance.

## 36. Open Decisions

| Open item | Current position |
|---|---|
| Final brand name | Bengali-rooted name preferred. Current candidate: ভিনদেশী এক্সপ্রেস / Vindeshi Express. Alternatives around ভিনদেশ / পথ / যাত্রা remain open. |
| Primary interface language | Bangla-first, bilingual Bangla/English, or English-first with Bengali brand has not been finalized. |
| Exact route maturity labels | Concept is agreed; final wording and colors are not. |
| Exact inactivity periods | 30 days is suitable for completely inactive new routes; thresholds for stale established routes remain open. |
| Exact quarantine/report thresholds | Principle is agreed; numerical thresholds depend on real-world abuse patterns. |
| Exact contributor reputation labels | Reputation concept is agreed; names/weights are not. |
| Exact initial routes per destination | Countries are tentatively Germany, Australia, USA and Malaysia; precise route list remains to be researched and seeded. |
| External notifications | In-app change visibility is core. Email/other proactive notifications may be added later. |
| Advertising | Permitted in principle only to offset costs; not required for launch. |
| Final tagline and terminology | Ribbon, Road, Step and Journey are the current conceptual terms; public-facing Bengali terminology can be refined during visual design. |
| Baseline completeness | The product concept and first-release behavior are frozen. Remaining open items concern branding, presentation or operational thresholds and do not prevent development from starting. |

## 37. Decision Register

| ID | Decision | Status |
|---|---|---|
| D-01 | The product is a process/navigation platform, not a scholarship finder. | Agreed |
| D-02 | Bangladesh is the first origin market because routes depend on origin-country procedures. | Agreed |
| D-03 | Anonymous visitors can browse routes without registration. | Agreed |
| D-04 | Search results use visual ribbons rather than conventional cards. | Agreed |
| D-05 | A selected ribbon expands into a road made of step blocks. | Agreed |
| D-06 | Step blocks expand to reveal procedure, documents, where-to-go information, contact/address/link/cost/time and related fields. | Agreed |
| D-07 | Multiple community routes may coexist for the same destination when their journey differs. | Agreed |
| D-08 | Signed-in users can follow a route as a private journey. | Agreed |
| D-09 | Followers update personal progress like a private notebook; no documentary evidence is required. | Agreed |
| D-10 | Followers’ personal progress is not public. | Agreed |
| D-11 | Private journeys remain linked to the evolving public route. | Agreed |
| D-12 | Public route changes are shown to followers and do not silently erase their personal state. | Agreed |
| D-13 | Previous route versions remain visually available as a shadow beneath/alongside the current route. | Agreed |
| D-14 | Signed-in contributors can create routes, steps and fields. | Agreed |
| D-15 | Community governance is based on ADD, UPDATE, CONFIRM and CHALLENGE. | Agreed |
| D-16 | Normal users cannot permanently delete shared fields or routes. | Agreed |
| D-17 | Obsolete information is archived/history-preserved rather than destructively deleted. | Agreed |
| D-18 | A route creator does not own the route permanently. | Agreed |
| D-19 | New routes must visibly show limited maturity; no reports does not equal trust. | Agreed |
| D-20 | 30-day inactivity is mainly a dormancy signal for unused new routes, not automatic invalidation of established routes. | Agreed |
| D-21 | Follower counts and self-reported completions are useful signals but not proof of correctness or verified success. | Agreed |
| D-22 | Official requirements and community experience must be distinguishable. | Agreed |
| D-23 | Temporary disruptions such as weather-related test cancellations should be represented separately from permanent route changes. | Agreed |
| D-24 | Unknown links and contacts must not immediately appear as trusted official content. | Agreed |
| D-25 | Users can report phishing, adult content, malicious links, impersonation, personal-information exposure and other abuse. | Agreed |
| D-26 | High-risk content may be quarantined/hidden pending administrator review. | Agreed |
| D-27 | The founder does not intend to run the project as a paid consultancy or placement business. | Agreed |
| D-28 | Ordinary advertising may be considered only to offset costs and may not influence route trust or ranking. | Agreed |
| D-29 | The product should collect minimal user information and not become a sensitive document repository. | Agreed |
| D-30 | Expected fly/departure windows are a core route feature and should be approximate, not guaranteed precise dates. | Agreed |
| D-31 | A Bengali-rooted name is preferred for the Bangladesh-first launch. | Agreed |
| D-32 | Final Bengali brand name is not yet frozen. | Open |
| D-33 | The ribbon is the compressed route; opening it should visually unfold into the same journey road rather than a disconnected detail page. | Agreed |
| D-34 | Field types have different freshness/expiry behavior; old values remain historically visible. | Agreed |
| D-35 | Repeated contradictory edits should make uncertainty visible instead of silently treating the last edit as absolute truth. | Agreed |
| D-36 | Positive confirmations after real-world step completion are a core self-maintenance signal. | Agreed |
| D-37 | Routes may branch/overlap and are not required to be a single straight sequence. | Agreed |
| D-38 | Duplicate route merging must preserve follower progress and useful history. | Agreed |
| D-39 | Material changes should carry effective dates where known and be contextualized against follower progress. | Agreed |
| D-40 | Route volatility/change activity may be shown as an informational monitoring signal. | Agreed |
| D-41 | External link destination/domain must be visible; shortened/obscured unknown links receive lower trust. | Agreed |
| D-42 | Unknown external content must not visually inherit the platform’s authority or “official” status. | Agreed |
| D-43 | Community agency/contact information is informational, not endorsement; paid trust is prohibited. | Agreed |
| D-44 | Core route knowledge will be maintained natively by the website/community rather than depending on external study-data APIs. | Agreed |
| D-45 | The platform should not become a general social feed or unsolicited private-messaging network. | Agreed |
| D-46 | The first release concept is frozen by this document; new material features require explicit requirements change. | Agreed |
| D-47 | Applicability is recorded on each field revision rather than as an unversioned property of the field, because the scope of a claim is part of the claim and can be corrected like any other part of it. It remains separate from source class: source class states who asserts a fact, applicability states whom it applies to. | Agreed |

## 38. Final Concept Statement

The project is a public-good, Bangladesh-first community navigation system for studying abroad. It treats international education not as a list of scholarships or a collection of articles, but as a set of evolving journeys. A person searches where they want to go, compares route ribbons, opens a route as a visual road, expands each step to understand the real procedure, and may privately follow that road throughout the months-long preparation process.

The public road remains alive after the user begins following it. People who discover that a step, document, contact, timeline or procedure has changed can revise it for everyone. People who recently completed a step can confirm that it is still accurate. People who find something obsolete can challenge it. People who detect scams, malicious links or personal-information abuse can report it. Ordinary users do not destroy history: older information becomes revision history or an archived shadow, allowing future students to understand what changed and when.

The platform succeeds when it reduces repeated confusion. A student should not have to reconstruct the same process from scattered embassy pages, university sites, Facebook posts and word-of-mouth every time a new intake begins. The knowledge created by one applicant’s real journey should become clearer, safer and more useful for the next applicant.

> The essence of the project People ahead on the journey leave the route clearer for the people coming behind them.

## 39. Detailed Content and Field Governance

The route is the public journey, but the quality of that journey depends on the behavior of the individual fields inside each step. Fields therefore need their own meaning, history, freshness and challenge state. A field is not merely free text: it represents a specific piece of knowledge that can change independently from the rest of the road.

### 39.1 Field categories

| Field category | Purpose and expected behavior |
|---|---|
| Requirement | States something the applicant must satisfy or provide. It should clearly distinguish mandatory, conditional and optional requirements. |
| Procedure | Explains what action must be taken and in what practical sequence. |
| Document | Identifies a required or useful document, including where it comes from and when it is needed. |
| Contact | Provides a public institutional telephone number, email or contact channel. Because contacts can be abused, source and trust status must be visible. |
| Address / location | Explains where a student must physically go when a process cannot be completed remotely. |
| Hyperlink / source | Points to an external source or action page. Link trust status must be visible before a user relies on it. |
| Cost / fee | Shows a fee, deposit or expected expense and identifies whether it is official, estimated or community reported. |
| Deadline / date | Shows a hard deadline, opening period, appointment date range or other time-sensitive date. |
| Duration / waiting time | Shows official processing information or community-observed waiting time, clearly labelled by source type. |
| Community experience | Records what applicants actually encountered without presenting an individual experience as an official rule. |
| Warning / dependency | Explains that another step, document or deadline must be completed first or that a known risk affects the stage. |

### 39.2 Field freshness and natural expiry

Different information becomes stale at different speeds. The platform should therefore be able to show when a field was last updated or confirmed and, where appropriate, when it should be reviewed again. A scholarship deadline naturally expires after an intake; a visa fee may need periodic review; an embassy address may remain stable for years. The product should show age and uncertainty instead of assuming every field remains current forever.

A deadline or intake-specific field may become expired automatically when its relevant period has passed, while remaining visible in history.

A contact, fee, link or processing-time field may be marked “needs fresh confirmation” when it has not been reconfirmed for a meaningful period.

An old field can remain historically visible after archival; archival is not the same as permanent deletion.

When a replacement field is introduced, the current and previous values should remain traceable so users can understand why older posts or advice may differ.

### 39.3 Conflicting edits and edit wars

A signed-in user may update a field that another signed-in user previously updated. Each update creates a new revision rather than destroying the earlier value. If a field changes repeatedly within a short period or receives simultaneous confirmations and challenges, the platform should make that instability visible instead of silently presenting the latest edit as unquestioned truth.

Frequently edited fields may display a warning such as “Frequently changed — verify carefully.”

Users should be able to view earlier revisions and understand who or what type of contributor made the change without requiring real-name disclosure.

Where an official source exists, an individual community experience should not overwrite the official rule; it should be recorded as a separate experience or observation.

Where official sources conflict or appear outdated, the field should visibly show that the matter is disputed or under review rather than forcing a false certainty.

### 39.4 Positive confirmation matters

The platform must collect positive signals as well as complaints. “No one reported a problem” is not equivalent to “this is current.” A user who has just completed a step should be able to confirm that the information was still accurate. These confirmations help distinguish a quiet but valid route from an abandoned one.

## 40. Route Identity, Variation, Branching and Merge

For users, a route is understood visually: its ribbon, sequence, timing and step content make it feel different from another route. The platform should preserve that intuitive experience while also treating each public route as a stable community object whose followers, revisions and history remain attached to it over time.

### 40.1 What makes routes meaningfully different

Two routes may legitimately coexist for the same origin and destination when their actual journeys differ. Differences may include funding mechanism, admission pathway, scholarship process, university-specific branch, entrance examination, document sequence, embassy route, timing, intake or other substantial procedural differences. Minor wording differences do not justify duplicate routes.

### 40.2 Visual difference is a user-facing signal

Because route results are ribbons, differences in sequence, number of stages, stage categories, timing and expected fly window should naturally produce different-looking ribbons. A user should be able to sense that two journeys are different before opening them, without forcing every route into identical cards or templates.

### 40.3 Route branches and shared stages

A route may contain alternative or optional branches where the real journey allows them. For example, language-test options may differ, several universities may share the same country-level visa stage, or a scholarship route may branch before reconnecting with the normal admission/visa journey. The user experience should communicate these choices without implying that every applicant follows one single straight sequence.

### 40.4 Duplicate detection and merging

Community creation will inevitably produce routes that substantially overlap. The product should permit users to flag likely duplicates and, when appropriate, combine them into a stronger canonical route. Merging must preserve the knowledge and participation that already exists rather than discarding it.

Followers of merged routes should not lose their private progress.

Contribution history and useful revisions should remain traceable after a merge.

If two routes are genuinely different, they should remain separate even if many steps overlap.

Archived duplicate routes may point visitors toward the active route rather than simply disappearing.

## 41. Change Impact, Effective Dates, Volatility and User Awareness

A central purpose of the platform is to show not only what the route looks like today but also how it has changed and whether those changes matter to someone already using it. Changes therefore need timing, scope, severity and context.

### 41.1 Announcement date versus effective date

Where known, a change should distinguish the date it was announced or discovered from the date it becomes effective. This is essential for cases where a new visa rule applies only to applications submitted after a particular date.

### 41.2 Change severity

| Severity | Meaning to the follower |
|---|---|
| Informational | A field changed but normally requires no action, such as an office telephone number. |
| Relevant | A change may affect planning or expected timing, such as longer processing times. |
| Important | A new requirement, deadline or procedural change may require action before the user reaches that stage. |
| Critical | A change can invalidate or seriously disrupt the planned path, such as a visa closure, major eligibility change or sudden suspension. |

### 41.3 Change relevance to private journeys

The platform should not treat every public change as equally relevant to every follower. A user who already completed a step before an effective date should retain that completion and see the change in context. A user who has not reached the changed stage should see it as an update ahead. The user remains responsible for deciding whether an update applies to their own case.

### 41.4 Route volatility

The platform may derive a visible “route volatility” or “change activity” signal from revision history. A route with many material changes in a short period can warn students that it requires closer monitoring, while a stable route can show relatively low change activity. This is an informational signal, not a judgment of route quality.

### 41.5 Temporary disruption overlays

Temporary events such as weather-related test cancellation, strikes, emergency closures, appointment suspension or catastrophic events should appear as time- and location-scoped disruptions layered on top of the normal route. They should expire or resolve without rewriting the permanent process unless the disruption becomes a structural policy change.

## 42. Detailed Link, Contact and Anti-Scam Requirements

The platform is intended partly to reduce the risks created by scattered social-media advice and malicious actors. Community contribution must therefore be open while trust is deliberately earned. A new contributor may add information, but that action alone must never make an unknown contact, website or payment instruction look official.

### 42.1 Link classes and visible destination

Official or established domains may be labelled as trusted only when their institutional identity is clear.

Community-submitted links from unknown domains should be visibly labelled as unverified or community supplied.

Quarantined or reported links should not remain normally clickable while under safety review.

The destination domain should be visible before the user leaves the platform; generic labels such as “Apply Here” should not hide where the link actually goes.

URL-shortening services or obscured destinations should not be treated as official process links because they hide the true destination.

Links that attempt to use non-web or executable behavior should not be accepted as ordinary public route links.

### 42.2 Look-alike and impersonation risk

A website can imitate the name or appearance of a university, embassy or scholarship body while using a different domain. The interface should therefore emphasize the actual domain and warn users when a community-submitted domain is not the established institutional domain. A contributor cannot earn “official” status merely by naming a link after an institution.

### 42.3 No embedded trust transfer

Community websites and unknown external content should not be embedded in a way that makes them look like part of the platform. External material should remain clearly external. The user should deliberately choose to leave the route before visiting an untrusted destination.

### 42.4 Contact and agency information

Agency or service-provider information may be useful to some users, but the platform must not become a lead-generation marketplace. Public business contacts should show their source or verification context. A newly added phone number should never automatically appear as an endorsed contact simply because a contributor entered it.

Personal phone numbers reported as harassment, impersonation or unauthorized publication may be hidden quickly.

Where possible, contact details should be traceable to a public institutional or business source.

Agencies cannot pay to receive a trusted badge, route priority or higher confidence.

The platform should not encourage users to transfer money to individuals through community-posted payment instructions.

### 42.5 Immediate response to phishing, adult content and malicious links

The goal is rapid containment rather than an impossible guarantee that every arbitrary website can be perfectly classified before anyone reports it. Unknown links start with limited trust, credible reports can quarantine them quickly, and established contributors can help restore or reject them. Serious categories include phishing/scam, adult content, malware/download, impersonation, harassment/personal information and malicious payment solicitation.

## 43. Community Self-Correction, Anti-Gaming and Dispute Handling

The platform is designed around the belief that many students will voluntarily correct information because they have just experienced the real process and already know what confused them. That self-correction must remain possible even when an earlier contributor was wrong. The platform therefore treats editing as a continuing sequence of revisions, not as one person receiving permanent authority.

### 43.1 Signed-in editing principle

Any signed-in user may contribute to shared knowledge within the permitted contribution model. Another signed-in user may later update the same field. Earlier values remain in history. The route creator has no permanent veto over later improvements.

### 43.2 Reputation is a trust signal, not ownership

A contributor whose previous updates repeatedly survive confirmation may become more trusted than a new account, but reputation does not grant permanent ownership or immunity from correction. New accounts can still contribute; their changes simply begin with less accumulated community confidence.

### 43.3 Anti-gaming principles

Follower count alone must not determine trust or route ranking.

Raw vote totals alone must not automatically delete or archive high-risk information because coordinated accounts could manipulate them.

Rapid bursts of identical reports or suspicious account activity should be treated differently from independent confirmations accumulated over time.

Useful confirmed contributions should matter more than the sheer quantity of edits.

A route or field with zero reports must not be labelled safe merely because nobody has challenged it.

### 43.4 Dispute resolution behavior

When contributors disagree, the platform should expose the disagreement and revision history rather than forcing the latest edit to look certain. The item may be marked disputed, frequently changed or under review. Serious abuse is handled through reporting/quarantine; ordinary factual disagreement is handled through update, confirm, challenge and history.

## 44. Information Independence and Operating Philosophy

The public route knowledge should live inside the platform and be maintained as community knowledge. The core service should not depend on a third-party study-abroad data feed that could disappear, change pricing or silently rewrite the route. External websites are sources that users and contributors reference; they are not the owner of the route experience.

### 44.1 No dependency on study-data APIs for the core concept

The route, step, field, revision, confirmation, challenge and personal tracking functions are intended to operate as native website content. Ordinary infrastructure services such as account sign-in, hosting, email or security tooling may be used later if required, but the platform concept does not require external APIs to populate or maintain the study-abroad process itself.

### 44.2 Public-good neutrality

Because the project is intended for people rather than as an education-placement business, the interface should avoid design choices that make it look like an agency. No university, scholarship provider, agent or service provider can purchase route precedence, confidence or official-source status. If advertising is ever used to cover operating costs, it remains visibly separate from community knowledge.

### 44.3 Keep the product focused

The platform should resist becoming a general social network. There is no need for an entertainment feed, follower culture, unsolicited private messaging, consultant marketplace or document-upload workflow. Community interaction should remain attached to the route, step or field where the knowledge is useful.

## 45. Conceptual Risks and Failure Modes

The concept is intentionally community-driven and low-cost. The following failure modes were identified during requirements discussion and should be treated as product risks that the final experience must visibly address.

| Risk | Required conceptual response |
|---|---|
| Empty-platform / cold start | Seed a small number of high-quality Bangladesh-origin routes before expecting the community to expand coverage. |
| False new route with no reports | Mark new routes as experimental/developing; absence of reports is not a trust signal. |
| Stale but valid route | Show last confirmation/freshness rather than automatically declaring it false after 30 days. |
| Duplicate route explosion | Allow duplicate reporting and route merging while preserving followers and history. |
| Wrong community edit | Preserve earlier revisions so another signed-in user can correct the value and the community can see instability. |
| Malicious link/contact | Limit initial trust, expose destination/source, support rapid reporting and quarantine. |
| Vote or follower manipulation | Do not make raw counts the sole basis of trust, deletion or ranking. |
| Contributor abandonment | Allow other contributors to continue maintenance; route creators never own public routes permanently. |
| Notification overload | Differentiate informational, relevant, important and critical changes rather than alerting every follower about every edit. |
| User privacy creep | Keep private progress lightweight; do not request sensitive documentary evidence just because it could be collected. |
| Agency/commercial capture | Prevent paid influence over route ranking, trust, confidence or official-source status. |
| Feature creep | Keep scholarship discovery, consultancy, applications, social networking and travel sales outside the core unless a later requirements decision deliberately changes scope. |
| Legal/reputation disputes | Separate factual corrections from abuse reports, preserve history, and maintain a clear takedown/moderation path for harmful content. |

## 46. Final Pre-Development Scope Freeze

This document is the final concept and functional requirements baseline to be used before development begins. The purpose of the freeze is to stop the idea from expanding indefinitely and to ensure that design/development can proceed from one agreed source. New ideas after this point should be treated as requirement changes rather than silently added to the first release.

### 46.1 Core first-release behavior that must be represented

Bangladesh-origin route search with a small set of manually seeded popular destinations.

Ribbon-based route results that show duration, expected fly window, relevance/followers, activity and route status.

Ribbon expansion into a road with expandable step blocks and structured fields.

Anonymous browsing without forced registration.

Account-based route following, private progress, personal dates and private notes without evidence uploads.

Community creation of routes, steps and fields.

ADD, UPDATE, CONFIRM and CHALLENGE actions with non-destructive revision history.

Public route changes propagating to followers while preserving private progress.

Shadow-route comparison between the follower’s starting state and the current live route.

Route/field freshness, change history, maturity and dispute signals.

Temporary disruption behavior distinct from permanent route changes.

Expected fly window and step timing information.

Reporting, quarantine and trust separation for unknown links, contacts and abuse.

No ordinary-user permanent deletion of shared knowledge.

Route dormancy/archival behavior for unused experimental content and freshness handling for established routes.

Public-good neutrality and no paid influence over route order or trust.

### 46.2 Items intentionally not required before first development

The final public Bengali name, exact colors, exact reputation formulas, numerical quarantine thresholds, proactive email alerts, additional origin countries, advertising, advanced statistics and future volunteer governance labels may be finalized during or after design validation. Their principles are already defined in this baseline; their exact presentation is not required to begin development.

### 46.3 Pre-development acceptance statement

Development may begin when the product team can explain every first-release screen and user action using this document without inventing a new product concept. If a proposed feature cannot be traced to this baseline, it should be treated as a change request and evaluated against the project’s public-good, privacy, simplicity and trust principles.

## 47. Frequently Asked Questions and Clarifications

Is this a scholarship website?

No. Scholarships may appear as one type of route, but the product exists to explain and track the complete process from preparation to departure.

Is this an education agency?

No. It does not apply on behalf of students, guarantee visas/admission, store application documents, or sell placement services.

Why can more than one route exist for Germany or another destination?

Because funding route, university pathway, entrance tests, document sequence, timing and other real-world procedures can differ. Users compare these journeys rather than being forced into one generic guide.

Why are route results shown as ribbons?

The ribbon is a compressed visual summary of the whole journey. Its colored segments, length, timeline and activity signals let a student compare routes quickly. Opening it expands the same visual object into the detailed road.

What happens when a student follows a route?

The public route becomes the basis of a private journey. The student can mark steps complete, record personal dates and notes, and return later without uploading evidence.

Can other people see a follower’s progress?

No. Public route activity may be aggregated, but a person’s notes, completion status and personal dates are private.

What if the public route changes after someone starts following it?

The private journey remains linked to the live route. The user sees what changed and can compare the current road with the earlier shadow route. Their completed personal steps are not silently erased.

What if the whole route changes?

The current road becomes primary and the prior route remains visually available as a shadow/history so the user can understand the scale and location of the change.

Can anyone edit the route?

Signed-in users can contribute through ADD, UPDATE, CONFIRM and CHALLENGE. Edits create revisions; they do not permanently destroy the previous value.

What if someone updates a field incorrectly?

Another signed-in user can update it again, users can challenge it, and the revision history remains available. Repeated disagreement makes the field’s uncertainty visible.

Why can’t users simply delete incorrect information?

Direct deletion would make vandalism and accidental loss easy. Obsolete content is challenged and archived while history remains recoverable. Permanent removal is reserved for abuse, safety or exceptional administrative reasons.

What happens to a route nobody uses?

A brand-new route with no followers, confirmations or useful activity may become dormant after a period such as 30 days. Established routes are not declared false merely because they are quiet; their freshness is shown instead.

Does a route with no complaints mean it is safe?

No. “No reports” is not a trust signal. New routes and fields must visibly show limited history until people use, confirm and source them.

How are temporary events handled?

A weather event, test cancellation, strike or temporary closure is shown as a scoped disruption over the route rather than rewriting the permanent process.

How will phishing, porn or malicious links be handled?

Unknown links do not automatically receive official trust. Their destination is visible, users can report them quickly, and credible safety reports can quarantine them. Suspicious or hidden-destination links are treated more cautiously than established institutional domains.

Can people add agencies or contacts?

They may add public service information, but contacts must show source/trust context. Personal numbers, impersonation and malicious payment solicitation can be reported and hidden quickly.

Can an agency pay to appear more trustworthy?

No. Advertising or future sponsorship cannot alter route order, source status, confidence or community trust.

How does the platform know a journey was successful if no evidence is uploaded?

It does not claim verification. A user may self-mark a journey completed for personal tracking. Public aggregates must say “users marked completed,” not “verified visas” or “verified admissions.”

Why is Bangladesh the first origin?

Because the route is affected by origin-country realities such as document authentication, embassy jurisdiction, local testing, payment and travel-to-embassy requirements. A Bangladesh route may differ significantly from an India, Pakistan or Nigeria route to the same destination.

Will the site depend on external study-abroad APIs?

No for its core knowledge model. The route content is intended to be maintained within the platform by sources and community contributions. Ordinary web infrastructure may still be used where necessary.

How will the project make money?

It is not intended as a business. The founder’s objective is a public-good service. General web advertising may be considered only to cover unavoidable operating costs and must not affect route trust or ranking.

What proves the concept works?

The most important evidence is behavioral: students return to track their own journeys and, after experiencing real steps, voluntarily confirm or correct the public route so the next students benefit.

## One-Page Stakeholder Explanation

If this project must be explained quickly to a student, contributor, volunteer, university employee or potential supporter, use the following description:

> What it is A free community-maintained website where Bangladeshi students can search the process of studying in another country as a visual journey, understand every step, follow the journey privately, and stay aware when community updates change the live route.

> What makes it different It does not merely list scholarships or publish static guides. Routes are visual, versioned, community-maintained and connected to private progress tracking. The current route and its older shadow can show how the journey changed over time.

> Why people contribute Students who actually experience a step often discover outdated or missing information. They can immediately confirm or update it so the next person does not repeat the same confusion.

> What it does not do It does not apply to universities or visas for users, store sensitive application documents, guarantee outcomes, verify personal progress, or sell higher placement/trust to agents.

## Amendment 001 — Information applicability

Approved 3 September 2026. Raised from Bangladesh → Germany seed-content research, which established that source class alone cannot tell a reader whether a claim is route-wide, channel-specific, institution-specific, programme-specific, intake-specific or origin-specific.

The case that exposed it: a blocked-account requirement of €11,904 applies to every German student visa applicant from Bangladesh, while a GRE percentile requirement applies to one programme at one university. Both are official. Presented side by side with no applicability information, the second reads as a requirement of Germany.

This amendment adds FR-81 and decision register entry D-47. No existing requirement is changed, withdrawn or renumbered.
