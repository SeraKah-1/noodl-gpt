# Technical writing rules

## Scope

Project documentation uses an ASD-STE100-inspired style. This repository has no licensed ASD-STE100 checker or full approved-word dictionary. These rules do not establish formal compliance or certification.

Use English for shared technical documentation. Keep interface language choices separate. Preserve legal text, quotations, code names, and third-party skill files.

## Sentence rules

1. Use one main instruction in each procedural step.
2. Use the imperative form. Example: “Read the record before you update it.”
3. Put a condition before its action. Example: “If the revision changed, read the record again.”
4. Use the active voice when the actor is known.
5. Target 20 words or fewer for an instruction. Target 25 words or fewer for a description.
6. Use a list when multiple conditions make a sentence difficult to read.
7. State each limit with its unit and code reference.
8. State which check supports a claim. State when a check did not run.
9. Do not use promotional text or unverified quality claims.
10. Keep exact code names.

Sentence length is a review target. URLs, signatures, and error messages can exceed it. Short sentences alone do not establish ASD-STE100 compliance.

## Terms

| Term | Meaning |
| --- | --- |
| account | The authenticated ChatGPT user identity supplied by the hosting proxy |
| bank | A `Pack` record with questions and artifacts |
| question | A `Question` record inside a bank |
| option | A multiple-choice item with an ID |
| answer key | The stored correct value used for scoring |
| learner response | A value submitted during a session |
| artifact | Saved material, insight, or visualization |
| session | An `Attempt` record with saved occurrences and learner responses |
| occurrence | One question position in a session |
| revision | A record version used to detect a concurrent edit |
| operation ID | The identifier used to recognize a repeated mutation |
| deleted-record marker | A retained `deletedAt` value; also called a tombstone |
| publication | A shared content snapshot with answer keys and without learner history |
| host | ChatGPT when it displays the embedded application |
| proposal | A change that is not implemented |

## Document facts

Include a source path for statements about behavior. Prefer symbol names to line numbers.

Distinguish these states:

- Implemented: current code contains the behavior.
- Tested: a named check observed the behavior under stated conditions.
- Not verified: the necessary check has not run.
- Proposed: the behavior requires a future change.

Do not describe a historical upstream finding as a current defect in this derivative. Read the pinned upstream code before you update the audit.
