id: MACH-011
title: CAM Review and Sign-Off
dept: Machines
style: Checklist
owner: Manufacturing Lead
audience: Public
summary: No toolpath runs on a machine until a mentor has checked it. The programmer runs this checklist first, then gets sign-off.

## At a glance
1. **Program:** CAM in Fusion (see Approved CAM tools)
2. **Self-check:** run the checklist (see Programmer checklist)
3. **Sign-off:** mentor reviews (see Mentor sign-off)
4. **Post:** program and setup sheet saved (see Records)

## Approved CAM tools
| Tool | Status | Notes |
|---|---|---|
| Autodesk Fusion | Approved | Default for the Haas mill and the router |
| PenguinCAM (Onshape add-on) | Testing only | Produced odd zeros and units in early tests. Do not use for real parts until mentors approve it. [Team rule] |
| [EDIT: other] | [EDIT: status] | [EDIT: notes] |

## Programmer checklist
- [ ] Stock size and material match the real sheet or bar
- [ ] Work origin matches where the operator will zero
- [ ] Units are inches or millimeters as intended
- [ ] Every tool in the tool list exists in the shop, with correct diameter and stick-out
- [ ] Speeds and feeds calculated for the material (a calculator such as fswizard.com is fine)
- [ ] Tabs or hold-downs keep parts from breaking free
- [ ] Clearance and retract heights clear the clamps
- [ ] Simulation shows no gouges or collisions
- [ ] Setup sheet exported with tool changes listed

## Mentor sign-off
1. KEY: ALL CAM, from any source, is checked by a mentor before the first cut. [Team rule]
2. The mentor reviews the simulation and setup sheet with the programmer.
3. Approved programs are marked [EDIT: how sign-off is recorded, e.g. in the training tool or the request thread].

## Records
- Program file saved in [EDIT: CAM folder location] with the part name and date.
- Proven programs are marked "proven" so they can be rerun without a new dry run.
