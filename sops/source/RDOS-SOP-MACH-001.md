id: MACH-001
title: Tormach AF50+ CNC Bandsaw
dept: Machines
style: Procedure
owner: Cody Eves
audience: Public
version: 1.0
date: Nov 13, 2026
status: Approved
link: Tormach manual | https://tormach.com/support
summary: Standard operating procedure. Only signed-off operators run this saw: gear up, run the pre-use check, set up with the head held in Stop, then stay with the machine until the last part drops.

## At a glance
1. **Gear up:** Z87+ glasses, closed toes, no gloves or loose items (see Safety essentials)
2. **Pre-use check:** blade, air ≥ 90 psi, coolant, guards, chips (see Pre-use check)
3. **Load & clamp:** vises 1/8 in. off the stock, backlash out (see Automatic mode: repeat parts)
4. **Set length:** infeed table to the ruler, strokes if over 10 in. (see Automatic mode: repeat parts)
5. **Set head stop:** feed lever up, blade 2 in. above the work (see Automatic mode: repeat parts)
6. **Program & start:** cuts, strokes, Cycle Start twice (see Automatic mode: repeat parts)
7. **Feed & watch:** lever down, set rate, stay at the machine (see Automatic mode: repeat parts)
8. **Shut down:** E-stop, power off, brush and pan clean (see Shutdown and cleanup)

Tags used in this SOP: [Source: Tormach] comes straight from the manufacturer's manual or quick start guide. [Team rule] is a Robot Dolphin Family rule. [Operator] [Lead] [Mentor] mark who is allowed to do a task.

## Safety essentials
Tormach requires every operator to read and understand the operator's manual before using the machine. This SOP is the team's version of it, not a replacement. The machine is automatically controlled and can start moving at any time.

CARD: Wear
- Safety glasses rated ANSI Z87+
- Closed-toe shoes
- Long hair tied back and secured
- Hearing protection if the cut is loud
- Work gloves only to handle blades, swarf or stock; rubber gloves for coolant

CARD: Remove before running
- Gloves
- Loose sleeves, hoodie strings, lanyards, ties
- Rings, watches, bracelets, necklaces
- Headphones (you need to hear the cut)

CARD NO: Never cut
- **G10 and other fiberglass**, ceramic, graphite
- Beryllium, lead or magnesium and their alloys
- Anything abrasive, carcinogenic, explosive, flammable, radioactive or toxic

WARNING: **Crush and cut hazard.** Moving parts can entangle, pinch or cut you. Keep your hands away from the blade, never reach around a guard, and never hold the workpiece by hand. Clamp it in the vises or use a jig. [Source: Tormach]

WARNING: **Broken blades become projectiles.** Never run a worn or damaged blade or one with missing teeth. Guards may not stop a broken blade or a loose workpiece. [Source: Tormach]

### Stop the machine and wait for all motion to end before you…
- adjust a part, fixture or the coolant nozzle
- change blades or parts
- clear chips, oil or coolant (brush or scraper, never fingers or air)
- reach into any part of the machine's motion envelope
- remove a guard or shield
- take a measurement
- do anything else inside the guard
- pull a cut-off part or large chip out of the machine

### Shop rules for this machine [Team rule]
1. **Never leave it running.** Autofeed makes it tempting to walk away during a 40-part run. Don't. Tormach says the machine must never run unattended. If you need to leave, press Pause or the E-stop first.
2. **One operator.** Only the operator touches the controls. Everyone else stands outside the floor tape (or 3 ft from the machine) wearing safety glasses.
3. **Never block the E-stop** or any control. Keep stock, tools and drinks off the machine. Nothing loose goes inside the machine.
4. **Never bypass a safety device or interlock.** That includes the pulley-cover switch.
5. **Read the SDS** for any new material, coating or coolant. Chips and vapor from some materials are harmful.
6. **Not tired, not rushed, not impaired.** Don't operate on medication that affects judgment, or when you're exhausted at the end of a build night.

## Who may use it
The handbook says students may not use any tool or machine until they have completed the required training and been approved for that activity. On this saw, approval comes in three levels. [Team rule]

| Level | May do | How to get there |
|---|---|---|
| [Operator] | Pre-use check, automatic and manual cuts, adjust feed rate and clamping pressure, daily cleanup | Shop safety certification complete, read this SOP, then every skill in Training and sign-off signed off by a Lead or mentor in the training tool |
| [Lead] | Everything an Operator does, plus blade changes, speed (belt) changes, blade brush and guide adjustments, weekly and monthly maintenance | Signed-off Operator who has done one supervised blade change; appointed by a mentor |
| [Mentor] | Electrical cabinet, gearbox oil, tracking and jaw alignment, anything not covered here | Adult mentor or teacher. Electrical work inside the cabinet is for qualified technicians only [Source: Tormach] |

## Know the machine
Numbers match the callouts on Tormach's quick reference guide (QS10826), so a printed copy at the saw lines up with this page. Front is the operator side with the control panel.

| # | Part | Where | What it does |
|---|---|---|---|
| (#1) | **Vises** | At the blade and on the infeed table | Fixed vise holds the stock during the cut; feeding vise grips it and carries it forward each stroke |
| (#2) | **Horizontal quick-adjustment nut** | Back, infeed table | Sets how far the infeed table travels. Press its button to slide it; rotate it for fine adjustment |
| (#3) | **Infeed table** | Back | Moves the stock forward. Its back edge against the ruler sets the cut length |
| (#4) | **Handwheel** | Vise | Closes the fixed vise clamp |
| (#5) | **Clamp handle** | Feeding vise | Positions and locks the feeding vise clamp |
| (#6) | **Blade support guide** | Front | Steadies the blade near the cut. Set it about 1/4 in. from the material and never past the outfeed guide |
| (#7) | **Outfeed guide** | Front | Directs finished parts out of the cut |
| (#8) | **Blade feed lever** | Front | **Up = Stop**: the head will not descend. **Down = Go**: the head feeds through the cut |
| (#9) | **Vertical quick-adjustment nut** | Back, threaded rod | Sets how high the head lifts between cuts in automatic mode |
| (#10) | **Lift height sensor** | Back | The vertical nut meets it to tell the controller the head is high enough |
| (#11) | **Emergency Stop** | Control panel | Push to stop and lock out. Twist a quarter turn clockwise to release, which powers the control board |
| (#12) | **Up / Down arrows** | Control panel | Set the number of cuts, 1 to 999. Press both together for manual mode, shown as `---` |
| (#13) | **Stroke button** | Control panel | Sets strokes per part, 1 to 5. Automatic mode only |
| (#14) | **Cycle Start (green)** | Control panel | Press twice to start the blade and the program. `CS` means it's waiting for you |
| (#15) | **Feed adjustment knob** | Front, above the feed lever | Sets how fast the head descends through the cut |

### Other controls you'll use
- **Main Disconnect switch:** Front of the electrical cabinet. ON/OFF for mains power.
- **Pause button:** Control panel. Use it to hold the program if you must step away.
- **Coolant switch:** Control panel. Turns the coolant pump on.
- **Clamping pressure regulator:** Mounted by the gearbox. Sets how hard the vise jaws squeeze.
- **FRL (filter-regulator-lubricator):** Back of the machine. Shop air comes in here; needs 90–120 psi and air tool oil.
- **Blade tensioner and gauge:** Top of the saw head. Lead only.

### Capacity
| Spec | AF50+ value |
|---|---|
| Rectangular stock | 6 in. tall × 8 in. wide |
| Round stock | 7 in. diameter |
| Cut length | 0.157 in. to 50 in. |
| Length per stroke / strokes per part | up to 10 in. / up to 5 |
| Parts per program | 999 |
| Stock weight | 250 lb, depending on air pressure |
| Blade | 93 in. × 3/4 in. × 0.035 in. |
| Blade speeds (60 Hz) | 90, 134, 195, 255 ft/min |
| Motor / power | 1 hp, 115 V single phase, dedicated 15 A |
| Coolant tank | 2.65 gal |

## Pre-use check
Do this at the start of every session. If any item fails, don't run the saw; tell a Lead. [Operator]

- [ ] I'm wearing Z87+ glasses and closed-toe shoes; no gloves, jewelry or loose clothing; hair secured.
- [ ] Work area is clear, dry and well lit. No spills, stock or tools on or inside the machine.
- [ ] E-stop is reachable and nothing is blocking the control panel.
- [ ] Blade cover, blade guard and pulley cover are closed and secured.
- [ ] Blade has no missing teeth, cracks, twists or kinks, and it suits the material (see Pick the right blade).
- [ ] No chip build-up between the blade and its wheels. Blade brush bristles touch the blade.
- [ ] FRL gauge shows at least 90 psi, and the lubricator oil is above the bottom of the plastic tube.
- [ ] Coolant level and condition are good. Drip pan and grate are clear of swarf.
- [ ] Last part and large chips from the previous user are removed.

## Pick the right blade
**Keep at least three teeth in the material at all times.** A higher TPI (teeth per inch) cuts slower and smoother; a lower TPI cuts faster and rougher. [Source: Tormach]

On tube and channel, the teeth only engage the wall, not the whole profile. Size the blade to the wall thickness, so the thin-wall aluminum tube common in FRC needs a fine blade. [Team rule]

If the blade on the machine doesn't fit the job, a Lead changes it before you cut (see Change the blade). Tooth form and set also matter; check the blade maker's chart for anything unusual.

| Material thickness | TPI |
|---|---|
| 1/8 in. to 1/4 in. | 10–14 |
| 1/4 in. to 1/2 in. | 8–12 |
| 1/2 in. to 1 in. | 6–10 |
| 1 in. to 2 in. | 5–8 |
| 2 in. to 4 in. | 3–4 |
| 4 in. to 7 in. | 2–3 |

## Automatic mode: repeat parts
Use automatic mode when you need several parts of the same length. The saw clamps, cuts, lifts, feeds the stock and repeats until the count is done. [Operator] Steps are Tormach's procedure, with the quick start guide's callout numbers.

1. Confirm the blade suits the material. If it doesn't, stop and get a Lead.
### Load and clamp
2. Open both vise clamps with the handwheel (#4) and clamp handle (#5). Load the stock between the vises (#1).
3. Push the stock up until it touches the back of the blade.
### Set the length
4. Press the button on the horizontal quick-adjustment nut (#2) and slide it, with the infeed table (#3), away from the blade until it's just past the length you want.
5. Rotate the nut to fine-tune until the **back edge of the infeed table lines up with your cut length on the ruler**.
6. Part longer than 10 in.? One stroke can't reach. Set strokes on the control panel in step 15: the table advances once per stroke, up to 5 strokes. Check the first part with a tape. [Team rule]
7. Close the fixed vise clamp with the handwheel (#4) to about **1/8 in.** from the stock.
8. Loosen the clamp handle (#5), bring the feeding vise clamp to about 1/8 in. from the stock, then tighten the handle to lock it.
9. Remove backlash: pull the feeding vise by hand toward the clamp handle, then confirm the 1/8 in. gap is still there.
10. Set clamping pressure on the regulator by the gearbox (see Settings: feed, pressure, speed).
11. Move the blade support guide (#6) to about 1/4 in. from the stock, never past the outfeed guide (#7). Aim the coolant nozzle at the blade just ahead of the cut.
### Set the head stop
12. KEY: Move the blade feed lever (#8) **up to Stop**. The head can't descend while it's up.
13. At the back, press the button on the vertical quick-adjustment nut (#9) and run it to the top of the threaded rod. Lift the saw head until the blade is **about 2 in. above the stock**.
14. Lower the vertical nut until it meets the lift height sensor (#10). This sets where the head stops lifting between cuts. Too low and the blade drops onto the stock before the feed rate takes over, which can break the blade or stall the motor.
### Program, start and watch
15. Twist out the E-stop (#11). Set the number of parts with the arrows (#12) and the strokes per part with the Stroke button (#13).
16. GO: Hands clear. Press the green **Cycle Start (#14) twice**. The blade starts.
17. GO: Move the blade feed lever (#8) **down to Go**. Set the cutting rate with the feed adjustment knob (#15).
18. Watch the first cut all the way through. The head should fall at a steady rate. Stop and adjust if it chatters, stalls or the blade wanders. Measure the first part before letting the run continue.
19. KEY: **Stay at the machine until the count finishes.** Clear finished parts only with the machine stopped.

## Manual mode: single cuts
Use manual mode for one-off cuts. Only the front (fixed) vise clamps; the infeed table and Stroke button aren't used. [Operator]

1. Confirm the blade suits the material.
2. Twist out the E-stop (#11). Press the Up and Down arrows (#12) together. The display shows `---`, meaning manual mode.
3. Open the vises (#1) and load the stock between them.
4. KEY: Move the blade feed lever (#8) **up to Stop**.
5. At the back, run the vertical quick-adjustment nut (#9) to the top of the threaded rod. Lift the saw head to its maximum height. The blade must start above the stock, never resting on it.
6. Slide the stock forward to your cut mark.
7. Close the vise with the handwheel (#4) until the stock is tight.
8. Move the blade support guide (#6) to about 1/4 in. from the stock, not past the outfeed guide (#7). Aim the coolant nozzle at the blade ahead of the cut.
9. GO: Hands clear. Press **Cycle Start (#14) twice**.
10. GO: Move the feed lever (#8) **down to Go** and set the rate with the feed adjustment knob (#15).
11. Watch the blade through the cut and confirm the head falls at a steady rate. Wait for the blade to stop before removing the part.

## Settings: feed, pressure, speed
### Feed rate [Operator]
Judge feed by how the saw sounds and the chips it makes. Too fast stalls the saw or breaks blades; too slow dulls the blade.

1. Open the hydraulic flow: turn the blade feed lever in line with the cylinder.
2. Turn the dial **counterclockwise to feed faster**, **clockwise to feed slower**.
3. Close the flow: turn the lever perpendicular to the cylinder.

### Clamping pressure [Operator]
Adjust the pneumatic regulator by the gearbox. Raise it if stock slips or won't advance in automatic mode; lower it for thin-wall tube that could crush. [Team rule]

### Blade speed [Lead]
Speed changes move the belt between pulleys. The speed chart is inside the pulley cover.

1. E-stop in, Main Disconnect OFF, disconnect shop air at the FRL.
2. Open the pulley cover and loosen the clamping bolt under the motor.
3. Turn the belt tensioning bolt counterclockwise until the belt comes off. Move it to the new pulley pair.
4. Turn the bolt clockwise to re-tension. Pushed firmly between the pulleys, the belt should move about 1/2 in.
5. Tighten the clamping bolt and close the pulley cover. The machine won't run with it open (error `E5`).

## Shutdown and cleanup
Leave the saw ready for the next person. These are Tormach's daily maintenance items. [Operator]

1. KEY: Push the E-stop in to lock it. Turn the Main Disconnect switch OFF.
2. Move the blade feed lever up to Stop and remove all stock and cut-offs.
3. With work gloves and a brush or scraper, clean swarf off the blade brush, out of the drip pan, and from the drip pan grate. Check that the grate isn't clogged.
4. Check the coolant level and condition. Report low or foul coolant to a Lead.
5. Wipe a rust inhibitor on exposed bare metal. **Not on the guide rails or the vise lead screw.**
6. Oil the linear rails (E-900 ball screw lubricant or similar).
7. Confirm the FRL still reads at least 90 psi and the lubricator has oil. Sweep the floor around the machine.

## Change the blade [Lead]
A new blade must be verified on the wheels before the head comes down, then broken in.

CAUTION: Blades cut. Wear work gloves, eye protection, long sleeves and long pants to handle them. [Source: Tormach]

1. KEY: E-stop in, Main Disconnect OFF, disconnect shop air at the FRL.
2. At the back, pull the cotter clip and the quick-release pin from the air cylinder. Set them aside. The cylinder hangs from the head.
3. Lift the saw head to the upright position.
4. Loosen the air cylinder bolt (8 mm hex) just enough for the door to open. Keep it tight enough to hold the cylinder; letting it hang strains the wires.
5. Slide up the bottom of the blade cover, then slide the cover up until it clears the base casting. Remove its two screws (5 mm hex) and open it.
6. Remove the blade guard (two Phillips screws).
7. Loosen the tensioner on top of the saw head and carefully remove the old blade.
8. Fit the new blade into the blade guides with the teeth pointing away from the guide rollers and toward the motor. Holding it in the guides with one hand, loop it around the wheels with the other.
9. Still holding the blade in the guides, tighten the tensioner until the gauge needle lines up with the tip of the arrow. Use the inner circle for 3/4 in. blades.
10. Reinstall the blade guard, close and screw the blade cover, and slide the cover bottom down.
11. **Verify, head still up:** release the E-stop, Main Disconnect ON, press both arrows for manual mode `---`. Hands clear, press Cycle Start, let the blade run 3 seconds, then hit the E-stop.
12. Check the blade is still seated on the wheels. If it moved off, power off, reseat it and repeat step 11.
13. Power off, reinstall the air cylinder pin and clip, reconnect air, and set the head down carefully.

### Break in the new blade
New teeth are sharp enough to fracture. Use the normal blade speed for the material, then:

| Material | Feed during break-in | For the first |
|---|---|---|
| Easy to cut: aluminum, carbon steel | Half the normal rate | 50–100 sq in. of cut |
| Hard to cut: stainless, tool steel, hardened steel, nickel alloys | 3/4 of the normal rate | 25–75 sq in. of cut |

Then ramp up to the normal rate over the next few cuts, easing speed slightly if it vibrates. Cut area is width × height of each cut: ten cuts through 1 × 2 in. bar is 20 sq in.

## Maintenance schedule
Power off and disconnect air before any maintenance; lock out the plug and air line when appropriate. Z87+ glasses always, work gloves for swarf, rubber gloves for coolant. [Source: Tormach]

| When | Task | Who |
|---|---|---|
| **Every session** | Shutdown and cleanup above: blade brush, drip pan and grate, coolant check, rust inhibitor, rail oil, FRL check | [Operator] |
| **Weekly** | Wipe all exterior surfaces with a clean rag. Check the blade brush touches the blade; adjust until the bristles overlap it. Replace a worn brush (PN 38033) | [Lead] |
| **Monthly** | #2 tube grease on each guide rail within the infeed table's travel. Clean fine swarf from the coolant tank | [Lead] |
| **Monthly** | Dust the electrical cabinet with a clean cloth or compressed air, power off | [Mentor] |
| **90 days, then every 6 months** | Inspect the motor belt for wear. Lightly grease the vise lead screw with #2 tube grease | [Lead] |
| **Yearly** | Inspect the gearbox for leaks | [Mentor] |
| **As needed** | Gearbox oil: drain at the plug, wipe out, refill with about 10 oz of SAE 90 gear oil (ISO 220), reseal the cover plate and gasket | [Mentor] |

NOTICE: Coolant must be a metalworking coolant with rust inhibitor (soluble oil, semi-synthetic or synthetic). Never use plain water, straight cutting oil, or anything flammable such as alcohol, diesel or kerosene. Never let swarf pile up on or in the machine. [Source: Tormach]

## Troubleshooting
Operators may clear `CS` and `E11`. For any other code, press the E-stop and get a Lead. Codes E1–E6 go to a mentor.

| Display | Meaning | First thing to check |
|---|---|---|
| `CS` | Not an error: waiting for Cycle Start | Press the green Cycle Start button |
| `E11` | Incorrect input; cut canceled | Press Cycle Start twice |
| `E10` | Saw lift timed out before reaching its height | Air at least 90 psi; vertical nut and lift sensor position |
| `E12` | Saw up and saw down sensors both active | Proximity sensor gap (about 1 mm from activating) |
| `E13` | Infeed and outfeed sensors both active | Proximity sensor gap |
| `E15` `E17` | Infeed table retract stroke timed out (first or later stroke) | Air pressure; vise jaws dragging on the stock; chips on the table |
| `E16` | Infeed table advance stroke timed out | Air pressure; jaws dragging; stock too heavy for the air supply |
| `E5` | Pulley safety switch not latched | Close the pulley cover fully |
| `E1`–`E4` `E6` | Memory failure, over/under voltage, panel communication, cut sensor | Mentor. Electrical issue |

The Stroke LEDs double as sensor lights while troubleshooting. Lit means that sensor is active: **×1** infeed (advance), **×2** outfeed (retract), **×4** saw down, **×5** saw up.

### Common cutting problems, most likely cause first
| Problem | Check, in this order |
|---|---|
| **Blades break** | Chips between blade and wheels · feed too high · head dropping onto the stock (raise the vertical nut) · wrong TPI · blade tension · blade resting on the stock at start (manual) |
| **Blades dull fast** | Chips on the wheels · feed or speed too high · wrong TPI · skipped break-in · twisted or kinked blade |
| **Teeth strip off** | Chips on the wheels · feed too high · stock loose or vise gap over 1/8 in. · chips packed in the gullets (use a coarser blade) |
| **Crooked cuts** | Chips on the wheels · feed too high · dull blade · blade support guide too far from the work · blade tension |
| **Stock won't advance** | Chips · pinched air line · clamping pressure too low · air under 90 psi · jaws or infeed table misaligned |
| **Stock slips in the vise** | Chips · air under 90 psi · handwheel not fully tight (manual mode) |
| **Stalls or bogs** | Head dropping onto the stock · TPI too fine or stock too coarse · feed or speed too high · loose stock |
| **Loud or rough cut** | Chips · feed too high · wrong TPI · clamping pressure low · handwheel loose · speed too high |
| **No coolant** | Coolant switch ON · tank level · then a Lead checks the pump for blockage |

## Emergencies and incidents
DANGER: **Anyone at risk: hit the E-stop first.** Then turn the Main Disconnect OFF. Never reach in to grab a falling part or a snapped blade. [Team rule]

1. KEY: Stop the machine: E-stop, then Main Disconnect OFF. Disconnect air if anything is still moving.
2. Get the nearest mentor or teacher. For any serious injury, call 911 and follow the school's emergency procedure.
3. Don't restart the machine. A Lead or mentor clears it after checking blade, guards and setup.
4. Report every injury, near miss or broken blade to the supervising mentor and the Safety Captain the same day.
5. If the machine is damaged, hang a "Do not use" tag on the E-stop and tell a mentor.
6. Tormach support: tormach.com/support, or (608) 849-8381, weekdays 8–5 Central. Have the serial number from beside the Main Disconnect. Mentor contacts only. [Team rule]

## Training and sign-off
Sign-offs and safety tests for this saw are tracked in the team's training tool, not on paper. A student becomes an Operator once a Lead or mentor has signed off every skill below there. [Team rule]

1. General shop safety certification complete
2. Read this SOP and Tormach's safety chapter; pass the bandsaw safety test
3. Names all 15 callouts and the controls on the panel
4. Performs the pre-use check unprompted
5. Chooses an appropriate blade for a given stock
6. Supervised manual-mode cut, correct setup and feed
7. Supervised automatic run of 3+ parts, first part measured
8. Clears CS and E11; knows when to stop and call a Lead
9. E-stop drill and shutdown/cleanup

## Sources
- [Tormach UM10825 AF50+ Operator's Manual (0825A)](https://tormach.com/support)
- [Tormach QS10826 Quick Start Guide (0124A)](https://tormach.com/support)
- [Robot Dolphin Family Program Handbook](https://robotdolphins.org/index.php/program-handbook/)
