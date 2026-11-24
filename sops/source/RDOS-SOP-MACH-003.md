id: MACH-003
title: Omio CNC Router
dept: Machines
style: Procedure
owner: Cody Eves
audience: Public
summary: The router cuts our plate parts in aluminum, polycarbonate and SRPP. Fusion CAM only, mentor-checked, with the operator watching every pass.

## At a glance
1. **Signed off:** router operator (see Who may use it)
2. **CAM checked:** Fusion, mentor sign-off (see Before you cut)
3. **Secure stock:** sheet held flat (see Setup)
4. **Zero:** X, Y and Z from the sheet (see Setup)
5. **Cut & watch:** dust collection on (see Cutting)
6. **Clean up:** chips vacuumed (see Shutdown and cleanup)

## Safety essentials
CARD: Wear
- Safety glasses rated ANSI Z87+
- Hearing protection
- Closed-toe shoes

CARD NO: Never cut
- G10 or other fiberglass without a mentor-approved dust plan
- Material that isn't held down
- With the dust collector off

WARNING: **Fire risk.** Fine chips and a dull or rubbing bit can ignite. Never leave the router running, and keep the vacuum filter clean.

## Who may use it
| Level | May do | How to get there |
|---|---|---|
| [Operator] | Load sheet, zero, run checked programs, cleanup | Gates 0 and 1, read this SOP, supervised runs signed off |
| [Lead] | Change bits, first runs of new programs, vacuum filter changes | Signed-off Operator appointed by a mentor |
| [Mentor] | CAM sign-off, maintenance, anything not covered here | Adult mentor or teacher |

## Know the machine
| Item | Our machine |
|---|---|
| Model | [EDIT: Omio model] |
| Bed size | [EDIT: bed size] |
| Spindle | [EDIT: spindle and collet size] |
| Hold-down method | [EDIT: vacuum, screws, tape and glue] |
| Common bits | [EDIT: e.g. 1/8 in. and 4 mm single flute] |

## Before you cut
1. CAM the part in Fusion following RDOS-SOP-MACH-011. Do not use PenguinCAM until it is approved by mentors; it has produced bad zeros and units. [Team rule]
2. KEY: A mentor signs off the CAM before the first cut.
3. Note every tool change in the setup sheet (for example 2.5 mm to 4 mm).

## Setup
1. Place the sheet on [EDIT: spoilboard], square to the axes, and secure it flat.
2. Install the bit listed for the first operation with the correct collet.
3. Zero X and Y at the origin on the setup sheet; zero Z on [EDIT: top of stock or spoilboard].
4. Turn on dust collection.

## Cutting
1. GO: Start the program and watch the first plunge and first full pass.
2. Listen for chatter or squealing; pause and get a Lead if the cut sounds wrong.
3. KEY: Stay at the machine for the whole run.
4. Batch by material: today's goal is often all polycarbonate and SRPP first, then aluminum.

## Shutdown and cleanup
1. Remove parts and skeleton; check tabs and deburr away from the machine.
2. Vacuum the bed and gantry. Replace the vacuum filter when it's full. [Lead]
3. Post finished parts in the manufacturing request thread (RDOS-SOP-MACH-010).

## Training and sign-off
1. Read this SOP; pass the router safety test
2. Secures stock and zeros all axes correctly
3. Supervised run of a checked program, including a tool change
4. Pause and E-stop drill
