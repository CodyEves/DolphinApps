id: ELEC-002
title: Wiring Diagrams and CAN Documentation
dept: Electrical & Software
style: Standard
owner: Electrical Lead
audience: Public
summary: Every robot has a current wiring diagram in the shop and online. Update it whenever a motor, sensor or CAN device is added or moved.

## At a glance
1. **Draw:** diagram from CAD and the robot (see What the diagram shows)
2. **Post:** paper in shop, copy online (see Where it lives)
3. **Update:** every change (see Keeping it current)
4. **Check:** before each event (see Pre-event check)

## What the diagram shows
- Power path: battery, main breaker, PDH or PDP channel and breaker size for each device
- CAN bus order from the controller to the terminating device, and which bus (for example a CANivore)
- Device IDs for every motor controller, encoder and sensor
- Cameras, coprocessors and radio power
- Wire gauge for each branch

## Where it lives
1. A printed copy stays in the shop next to the robot. [Team rule]
2. An editable copy lives in [EDIT: location, e.g. team drive folder per robot].

## Keeping it current
1. Anyone who adds or moves a device updates the paper copy that day.
2. The Electrical Lead updates the online copy within a week.
3. Route CAN so the line ends at the last device in a sensible order, and record the change.

## Pre-event check
- [ ] Diagram matches the robot
- [ ] Device IDs match the code
- [ ] Spare connectors and pigtails match what the robot uses
