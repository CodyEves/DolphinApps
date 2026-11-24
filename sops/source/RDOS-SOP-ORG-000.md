id: ORG-000
title: How This Manual Works
dept: Start Here
style: Standard
owner: Cody Eves
audience: Public
version: 0.2
date: Nov 23, 2026
summary: Every SOP lives on one website. Anyone can read it; team members sign in to Dolphin Apps to suggest changes; mentors review the suggestions and Claude rebuilds the pages. Read this before you suggest a change to any SOP.

## At a glance
1. **Find the SOP:** open the catalog and pick a section (see Where things live)
2. **Suggest:** sign in, press Suggest an edit, select the words and comment (see Suggesting an edit)
3. **Review:** a mentor accepts or rejects each suggestion (see Review and approval)
4. **Batch:** the mentor copies the accepted suggestions for Claude (see Rebuilding the pages)
5. **Rebuild:** Claude changes the source and rebuilds the pages (see Rebuilding the pages)
6. **Publish:** a mentor runs the publish script and marks the suggestions done (see Rebuilding the pages)

## Why one locked copy
The Robot Dolphin Operations Manual works like a franchise handbook. Anyone opening a new team, or joining ours, should be able to pick up any SOP and run the process the same way we do.

To keep the pages clean and trustworthy, nobody edits a page directly. Every page is generated from one source file, and every change starts as a suggestion that a mentor can see, accept or reject.

- **The page:** what everyone reads at apps.robotdolphins.org/SOP. Anyone in the world can open it without signing in.
- **A suggestion:** a comment pinned to the words it is about. Only signed-in team members can leave one.
- **The source:** one plain text file per SOP that the pages are built from. Claude edits it when suggestions are approved.

NOTICE: If you spot something unsafe in an SOP, don't wait for the rebuild. Tell a mentor in person, then leave a suggestion so the fix is recorded.

## Where things live
| What | Where |
|---|---|
| SOP pages (read these) | apps.robotdolphins.org/SOP, sorted into sections |
| Suggestions log (mentors) | apps.robotdolphins.org/SOP/suggestions |
| Source files | Dolphin Apps code repository, sops/source folder (one file per SOP ID) |
| Build notes and history | Claude project "RDOS SOP Creation" |
| Sign-offs and safety tests | Team training tool, not paper |

## Suggesting an edit
1. Open the SOP you want to change. [Student]
2. Press **Suggest an edit** in the bottom corner of the page. If you aren't signed in, it takes you to the Dolphin Apps sign-in first.
3. Select the words you want changed. On a phone, tap the step or paragraph instead.
4. Pick what kind of change it is, write what should change, and press **Send suggestion**.
5. Repeat for anything else on the page, then press **Done**.

KEY: Never put passwords, account logins, student phone numbers, addresses or grades in a suggestion or an SOP. Public pages are seen by the whole world. [Team rule]

TIP: Press **Suggestions** on any SOP to see what has already been suggested, so you don't send the same thing twice.

## Writing a good suggestion
- **Say the new words:** "Change 'wear gloves' to 'never wear gloves at the bandsaw'" beats "this is wrong".
- **One idea each:** send three suggestions rather than one long one, so each can be accepted on its own.
- **Fill a blank:** yellow "To fill" marks need team facts. Select the blank and write the answer.
- **Unsure? Ask:** choose Question when you aren't sure something is right.

## How the source is written
Claude and mentors use these patterns in the source files. You don't need them to suggest an edit, but they explain why the pages look the way they do.

| In the source file | On the page |
|---|---|
| A ## heading | A numbered section with its own tab in the page menu |
| A ### heading just above a numbered list | A phase label inside the steps |
| ### heading starting with Gate 1:, Gate 2: | A phase-gate banner |
| Numbered list | Numbered steps |
| A step starting with KEY: | A red critical step |
| A step starting with GO: | A green "start" step |
| A bullet starting with [ ] | An interactive checklist with a progress meter |
| A paragraph starting with DANGER:, WARNING:, CAUTION: or NOTICE: | A colored safety callout in ANSI style |
| A paragraph starting with TIP: | A blue tip box |
| CARD: Title, followed by bullets | A card; CARD NO: makes a red "never" card |
| Bullets that all start with a bold label and colon | A grid of small cards |
| [Team rule], [Student], [Lead], [Officer], [Mentor] | Colored role tags |
| [Source: Name] | A source tag |
| [EDIT: what goes here] | A yellow "to be completed" marker |
| A word in backticks like `E11` | A machine display code |
| (#4) | A numbered callout badge |
| The At a glance numbered list | The station rail at the top of the page |

## Review and approval
1. A mentor opens the suggestions log and reads each open suggestion next to the words it points at. [Mentor]
2. The mentor accepts or rejects it, with a short note if the answer isn't obvious.
3. Before an SOP goes from Draft to Approved, the approver (a mentor or teacher) reads the whole page once. [Mentor]

TIP: Use 0.x versions while an SOP is a draft. The first approved release is 1.0. Small fixes go 1.0 to 1.1; a rewrite goes to 2.0.

## Rebuilding the pages
1. In the suggestions log, press **Copy for Claude**. It copies every accepted suggestion, grouped by SOP. [Mentor]
2. Paste it into the Claude project "RDOS SOP Creation" with "Apply these SOP suggestions." Add anything else you want changed, such as a version bump or Approved status.
3. Claude edits the source files, rebuilds the pages, adds a Revision history row, and reports anything it couldn't apply.
4. Run the publish script Claude gives you. The site updates about two minutes later. [Mentor]
5. Check the changed pages, then press **Mark accepted as done** in the suggestions log.

## Public and internal SOPs
Most SOPs are public so other teams can copy them. A few cover private matters (conduct records, account administration) and are marked Audience: Internal. Internal SOPs are left out of the website.

## Revision history
| Version | Date | Change | By |
|---|---|---|---|
| 0.1 | Nov 21, 2026 | First draft, Google Docs workflow | Cody Eves |
| 0.2 | Nov 23, 2026 | Moved to the Dolphin Apps website with suggestions | Claude |
