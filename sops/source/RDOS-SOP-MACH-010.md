id: MACH-010
title: Manufacturing Request Workflow
dept: Machines
style: Workflow
owner: Manufacturing Lead
audience: Public
summary: Every part that needs making goes through a manufacturing request in Slack with a file, quantity and due date. One person claims it, makes it, and closes it out.

## At a glance
1. **Design:** CAD released (see Requesting a part)
2. **Request:** Slack form with file, qty, due (see Requesting a part)
3. **Claim:** "I'll Make This!" (see Claiming and making)
4. **Make:** CAM, cut, inspect (see Claiming and making)
5. **Deliver:** part handed off, request closed (see Delivering)

## Roles
| Role | Responsibility |
|---|---|
| [Student] Requester | Submits a complete request and answers questions |
| [Student] Maker | Claims the request, makes the part, delivers it |
| [Lead] Manufacturing Lead | Watches the queue, assigns stale requests, sets priorities |
| [Mentor] Mentor | Signs off CAM; settles priority conflicts |

## Requesting a part
1. Make sure the CAD is final and the part studio is named clearly (see RDOS-SOP-DES-001).
2. Submit the Manufacturing Request form in #manufacturing with:
- **Part name:** as it appears in CAD
- **Team:** 5199, 9271 or the B-team number
- **Quantity:** including spares
- **Due date:** when it's needed, not "ASAP"
- **Material and thickness:** for example 1/8 in. 6061 aluminum, 1/16 in. polycarbonate
- **Link:** Onshape link or exported file
3. Answer questions in the request's thread, not in a new message.

## Claiming and making
1. The maker clicks **I'll Make This!** in the request. One maker per request.
2. CAM and run the part following the machine's SOP and RDOS-SOP-MACH-011.
3. Inspect the part against the drawing: critical holes, thickness, deburring.
4. If you can't finish by the due date, say so in the thread right away.

## Delivering
1. Bag or label the part with its name and request date.
2. Post a photo in the thread and hand the part to the requester or put it in [EDIT: delivery bin].
3. KEY: The requester confirms the part fits, then the request is closed.

## Queue rules
- Competition robot parts come before practice and B-team parts unless a mentor says otherwise.
- Requests with no claim after [EDIT: hours] get assigned by the Manufacturing Lead.
