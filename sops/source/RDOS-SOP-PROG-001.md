id: PROG-001
title: Software Version Lock and Pre-Event Checklist
dept: Electrical & Software
style: Checklist
owner: Programming Lead
audience: Public
summary: Lock the robot's software to the versions the event allows, load offline installers, and soak-test the robot the night before load-in.

## At a glance
1. **Find versions:** event-locked stack (see Find the required versions)
2. **Update:** robot and laptops (see Robot and laptop checklist)
3. **Offline kit:** installers on USB (see Pack for load-in)
4. **Soak test:** the night before (see Soak test)
5. **Freeze:** no updates at the event (see Rules)

## Find the required versions
1. Check the event's announcements page and FIRST updates [EDIT: days] before the event.
2. Write the required versions here for this event: control system image, WPILib, Driver Station, vendor libraries, device firmware, camera firmware.

## Robot and laptop checklist
- [ ] Robot controller on the event's required image
- [ ] WPILib on every programming laptop matches
- [ ] Driver Station version allowed by the event
- [ ] All vendor libraries at the minimum version or newer
- [ ] Motor controllers, PDH and sensors on current firmware
- [ ] Camera firmware updated
- [ ] Code builds and deploys from the driver laptop

## Pack for load-in
- [ ] Offline installers on a USB stick (image, WPILib, Driver Station); don't rely on venue Wi-Fi
- [ ] Driver and programming laptops with chargers
- [ ] USB and ethernet cables
- [ ] Controllers plus a backup

## Soak test
1. The night before load-in, power the robot and leave it running enabled and disabled for [EDIT: time].
2. Watch status LEDs and the Driver Station log for reboots or dropouts.
3. Test any subsystem that uses remote sensors or closed loops on the new stack.

## Rules
1. KEY: No software updates at the event unless the event requires one or a mentor approves. [Team rule]
2. Known issues for this season: [EDIT: list known bugs and workarounds].
