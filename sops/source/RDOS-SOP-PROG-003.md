id: PROG-003
title: Transferring a Robot Between Teams
dept: Electrical & Software
style: Checklist
owner: Programming Lead
audience: Public
summary: When a robot moves from one team to another (for example from 5199 to 9271), reconfigure its identity, radio and tuning so it runs safely for the new team.

## At a glance
1. **Identity:** set the new team number (see Transfer checklist)
2. **Radio:** reflash for the new team (see Transfer checklist)
3. **Code:** trim and retune (see Transfer checklist)
4. **Hand off:** brief the new drive team (see Hand-off)

## Transfer checklist
- [ ] Team number set on the robot controller
- [ ] Radio reflashed for the new team number
- [ ] New team's Driver Station connects and enables
- [ ] Unused code removed and the build is clean
- [ ] Setpoints retuned for the new team's strategy
- [ ] Operator controls mapped and documented
- [ ] Robot passes a full systems test

NOTICE: Radio and account passwords go in the mentor-held credentials list, never in Slack or in this SOP. [Team rule]

## Hand-off
1. The outgoing programmer walks the new team through controls and known issues.
2. Update the robot's wiring diagram and README with the new team number.
