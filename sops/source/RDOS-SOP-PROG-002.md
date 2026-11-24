id: PROG-002
title: Log Pull and Post-Event Analysis
dept: Electrical & Software
style: Procedure
owner: Programming Lead
audience: Public
summary: Pull robot logs after every event, store them by event, and review them for brownouts, current limits and mechanism performance before the next practice.

## At a glance
1. **Pull:** logs off the robot (see Pulling logs)
2. **Store:** named by event (see Pulling logs)
3. **Review:** key signals (see What to look at)
4. **Report:** findings to the team (see Reporting)

## Pulling logs
1. Within [EDIT: days] of an event, copy all logs (for example Hoot logs and Driver Station logs) off the robot.
2. Save them to [EDIT: log folder] as event-year/match.
3. Free space on the robot only after the copy is verified.

## What to look at
- Battery voltage dips and brownouts by match
- Motor currents against current limits
- Mechanism recovery times (for example shooter speed after a shot)
- Reboots, CAN errors and loop overruns
- Autonomous path accuracy

## Reporting
1. Post a short summary in #programming with graphs and what to change.
2. Turn each change into a task for the next practice.
