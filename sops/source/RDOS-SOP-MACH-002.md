id: MACH-002
title: Haas CNC Mill
dept: Machines
style: Procedure
owner: Cody Eves
audience: Public
summary: Only Haas-certified operators run the mill. Every program is CAM-checked by a mentor, proven with a dry run, and watched from start to finish.

## At a glance
1. **Certified:** Haas course plus in-person test (see Who may use it)
2. **CAM checked:** mentor sign-off on the program (see Before you run)
3. **Pre-use check:** machine, tools, workholding (see Pre-use check)
4. **Set up:** work offsets and tool lengths (see Setup)
5. **Prove out:** dry run above the part (see Running a program)
6. **Run & watch:** hand on Feed Hold (see Running a program)
7. **Clean up:** chips, coolant, tools away (see Shutdown and cleanup)

## Safety essentials
CARD: Wear
- Safety glasses rated ANSI Z87+
- Closed-toe shoes
- Hair tied back, sleeves fitted
- Hearing protection for long or loud cuts

CARD NO: Never
- Wear gloves near a turning spindle
- Open the doors while the spindle turns
- Run a program that hasn't been CAM-checked
- Leave the machine running unattended

WARNING: **Entanglement and flying chips.** A turning spindle can catch hair, gloves or loose clothing. Keep the doors closed while cutting and clear chips only with the spindle stopped, using a brush or chip hook, never your hands.

## Who may use it
| Level | May do | How to get there |
|---|---|---|
| [Operator] | Load proven programs, set work offsets, run and monitor jobs, daily cleanup | Gate 0 and 1 done (RDOS-SOP-SAFE-002), Haas Basic Mill Operator course with all quizzes passed, in-person Haas test passed |
| [Lead] | Touch off new tools, load the tool changer, first runs of new programs | Signed-off Operator with [EDIT: number] supervised first runs; appointed by a mentor |
| [Mentor] | CAM sign-off, maintenance, crash recovery, anything not covered here | Adult mentor or teacher |

## Know the machine
| Item | Our machine |
|---|---|
| Model | [EDIT: Haas model] |
| Travels (X / Y / Z) | [EDIT: travels] |
| Spindle max | [EDIT: rpm] |
| Tool changer | [EDIT: number of pockets] |
| Workholding | [EDIT: vise model, fixture plates] |
| Location | [EDIT: room] |

## Before you run
1. The program comes from Fusion CAM following RDOS-SOP-MACH-011. [Team rule]
2. KEY: A mentor has signed off the CAM (toolpaths, stock, origin and tool list).
3. You have the setup sheet: stock size, work origin, tool list with stick-out.

## Pre-use check
- [ ] PPE on, no gloves or loose items
- [ ] Coolant and way-lube levels OK
- [ ] Air pressure at [EDIT: psi]
- [ ] Vise clean and torqued; no chips under the part
- [ ] Tools in the changer match the setup sheet
- [ ] Doors and window intact; E-stop reachable

## Setup
1. Power on and home the machine following the control's prompts. [Operator]
2. Clamp the stock; tap it down onto parallels.
3. Set the work offset (G54) at the origin on the setup sheet using [EDIT: probe or edge finder].
4. Confirm tool length offsets for every tool in the program. New tools are touched off by a Lead. [Lead]

## Running a program
1. Load the program and check its name matches the setup sheet.
2. KEY: Dry run first: raise the work offset in Z by [EDIT: amount] or use graphics mode, and watch the whole path above the part.
3. Restore the Z offset. Turn rapid override down to 25 percent for the first run.
4. GO: Close the doors and press Cycle Start with a hand near Feed Hold.
5. Watch the first tool all the way through. Bring rapids back up once the path is proven.
6. KEY: Stay at the machine until the program ends. Press Feed Hold, then stop the spindle before opening the doors.

## Shutdown and cleanup
1. Remove the part and deburr it away from the machine.
2. Clear chips from the table, vise and enclosure with a brush. Empty the chip tray if full.
3. Wipe the vise and table; leave the spindle empty or with the standard tool.
4. Log the job and any issues in [EDIT: machine log].

## Emergencies
DANGER: Anyone at risk: press the E-stop. Do not open the doors until the spindle has stopped.

1. KEY: E-stop, then get a mentor.
2. After any crash, do not reset or rehome. A mentor inspects the spindle, tool and vise first. [Mentor]
3. Report injuries and near misses the same day to the supervising mentor and Safety Captain.

## Training and sign-off
1. Haas Basic Mill Operator course completed, all quizzes passed
2. In-person Haas test passed
3. Pre-use check done unprompted
4. Sets a work offset and verifies tool lengths
5. Supervised dry run and first run of a proven program
6. Feed Hold, E-stop and crash response drill
