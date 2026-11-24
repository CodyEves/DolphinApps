id: DES-001
title: Onshape Organization and CAD Standards
dept: Design
style: Standard
owner: CAD Lead
audience: Public
summary: One team Onshape, one folder structure, one naming scheme. Anyone should be able to open any document and know what it is, who owns it, and whether it's ready to make.

## At a glance
1. **Access:** get added to the team Onshape (see Getting access)
2. **Set up:** install the standard FeatureScripts (see Standard tools)
3. **File it:** right folder, right name (see Folders and naming)
4. **Design:** follow the design rules (see Design rules)
5. **Release:** mark it ready for manufacturing (see Releasing a part)

## Getting access
1. Post in #cad with the email you use for Onshape and ask the CAD Lead to add you. Use one email for everything.
2. The CAD Lead adds you to the "5199 Robot Dolphins from Outer Space" team and the right folders. [Lead]

## Folders and naming
| Folder | What goes in it |
|---|---|
| Season robot (for example Robot 2027) | Competition robot master assembly and subsystems |
| Prototypes | Kickoff and season prototypes, named by mechanism |
| Classwork | Training work; each student has a named folder |
| Field elements | Practice field and game piece models |
| Library | Reusable parts and team standards |

- Documents: Season-Subsystem-Description, for example 2027-Intake-Roller Assembly.
- Training documents: your initials and the week, for example "TA - Week 2". Keep a week's work in one document with separate part studios.
- Parts that get made carry their material and thickness in the name, for example "Intake Side Plate 1/8 Al".

## Standard tools
Install these FeatureScripts before you start. Most are linked from FRCDesign.org and Chief Delphi. [Team rule]
- **MKCad:** standard COTS parts (bearings, hex shaft, motors)
- **Auto Layout:** lays out plate parts for manufacturing
- **Robot Belt:** belt and pulley center distances
- **Assembly Mirror:** mirrored subassemblies
- **Tube Converter:** box tube with hole patterns

TIP: Check a FeatureScript's source and reviews before installing it. Some are worse or more complicated than others.

## Design rules
1. Strategy drives design: every mechanism traces back to a line on the Will Do list (RDOS-SOP-BUILD-001).
2. Use real COTS models from MKCad or vendor CAD, not look-alikes. The swerve modules in CAD must match the ones on the robot.
3. Hole patterns in tube are not fixed. Follow the team's general pattern unless the design needs otherwise, and size bearing holes for a press fit on one face.
4. Chain lengths must work with full links; belt lengths must be stock sizes.
5. Design for manufacturing, repair, wiring and pit access.

## Releasing a part
1. Run a design review with the CAD Lead or a mentor. [Lead]
2. Mark the part studio "Released" in [EDIT: how release is marked, e.g. Onshape release or version name].
3. Submit a manufacturing request (RDOS-SOP-MACH-010).
