import type {
  LearningCheckType,
  LearningPathColor,
  LearningQuizQuestion,
  LearningResource,
} from "./learningDomain";

/**
 * Starter content for the Learning app, matching the 2026 pre-season
 * learning objectives doc. Loaded once from Learning > Manage; every skill
 * has a stable seedKey so loading again only adds what is missing.
 *
 * Resources point at material other teams already maintain (Spectrum 3847,
 * LYNK, WPILib, CTRE, FIRST). Nothing here re-creates their lessons.
 */

export type SeedSkill = {
  key: string;
  stage: string;
  title: string;
  successCriteria: string;
  practice?: string;
  checkType: LearningCheckType;
  estimatedMinutes: number;
  resources: LearningResource[];
  quiz?: LearningQuizQuestion[];
};

export type SeedPath = {
  slug: string;
  title: string;
  summary: string;
  color: LearningPathColor;
  skills: SeedSkill[];
};

// ---- Shared resources --------------------------------------------------

const lynkStrategy: LearningResource = {
  title: "LYNK: Strategy",
  url: "https://docs.lynkrobotics.org/strategy/index.html",
  kind: "reading",
  source: "LYNK",
};
const lynkDesign: LearningResource = {
  title: "LYNK: Design",
  url: "https://docs.lynkrobotics.org/design/index.html",
  kind: "reading",
  source: "LYNK",
};
const lynkBuild: LearningResource = {
  title: "LYNK: Build",
  url: "https://docs.lynkrobotics.org/build/index.html",
  kind: "reading",
  source: "LYNK",
};
const lynkElectrical: LearningResource = {
  title: "LYNK: Electrical",
  url: "https://docs.lynkrobotics.org/electrical/index.html",
  kind: "reading",
  source: "LYNK",
};
const lynkBusiness: LearningResource = {
  title: "LYNK: Business",
  url: "https://docs.lynkrobotics.org/business/index.html",
  kind: "reading",
  source: "LYNK",
};
const spectrumTraining: LearningResource = {
  title: "Spectrum 3847 training library",
  url: "https://spectrum3847.org/resources/training/",
  kind: "course",
  source: "Spectrum 3847",
};
const spectrumMotors: LearningResource = {
  title: "Motors and Power",
  url: "https://spectrum3847.org/training/motors/",
  kind: "interactive",
  source: "Spectrum 3847",
  minutes: 30,
};
const spectrumControlSystems: LearningResource = {
  title: "Control Systems",
  url: "https://spectrum3847.org/training/control-systems/",
  kind: "interactive",
  source: "Spectrum 3847",
  minutes: 32,
};
const spectrumCtreModes: LearningResource = {
  title: "CTRE Control Modes",
  url: "https://spectrum3847.org/training/ctre-control-modes/",
  kind: "interactive",
  source: "Spectrum 3847",
  minutes: 38,
};
const recalc: LearningResource = {
  title: "ReCalc mechanism calculators",
  url: "https://www.reca.lc/",
  kind: "tool",
  source: "ReCalc",
};
const frcDesign: LearningResource = {
  title: "FRCDesign.org learning course",
  url: "https://frcdesign.org/learning-course/",
  kind: "course",
  source: "FRCDesign.org",
};
const statbotics: LearningResource = {
  title: "Statbotics",
  url: "https://www.statbotics.io/",
  kind: "tool",
  source: "Statbotics",
};
const blueAlliance: LearningResource = {
  title: "The Blue Alliance (match video and results)",
  url: "https://www.thebluealliance.com/",
  kind: "tool",
  source: "The Blue Alliance",
};
const statusLights: LearningResource = {
  title: "Status Light Quick Reference",
  url: "https://docs.wpilib.org/en/latest/docs/hardware/hardware-basics/status-lights-ref.html",
  kind: "reading",
  source: "WPILib",
};
const talonFxReference: LearningResource = {
  title: "Talon FX hardware reference",
  url: "https://v6.docs.ctr-electronics.com/en/stable/docs/hardware-reference/talonfx/",
  kind: "reading",
  source: "CTRE",
};
const tunerX: LearningResource = {
  title: "Phoenix Tuner X documentation",
  url: "https://v6.docs.ctr-electronics.com/en/stable/docs/tuner/index.html",
  kind: "reading",
  source: "CTRE",
};
const wiringBestPractices: LearningResource = {
  title: "Wiring best practices",
  url: "https://docs.wpilib.org/en/latest/docs/hardware/hardware-basics/wiring-best-practices.html",
  kind: "reading",
  source: "WPILib",
};
const impactResources: LearningResource = {
  title: "FIRST Impact Award resources",
  url: "https://www.firstinspires.org/resource-library/FRC/first-impact-award-resources",
  kind: "reading",
  source: "FIRST",
};

/** In-app interactive lesson (opens inside DolphinApps). */
const motorRatioLesson: LearningResource = {
  title: "Interactive lesson: Pick a motor and gear ratio",
  url: "/training/labs/motor-ratio",
  kind: "interactive",
  source: "Robot Dolphins",
  minutes: 30,
};

function youtube(query: string): LearningResource {
  return {
    title: `Find videos: ${query}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    kind: "video",
    source: "YouTube",
  };
}

// ---- Paths -----------------------------------------------------------

const mechanical: SeedPath = {
  slug: "mechanical-design",
  title: "Mechanical & Design",
  summary:
    "Take a game from manual to working prototype: analyze it, pick a strategy, sketch on paper, test the unknowns, and build fast.",
  color: "blue",
  skills: [
    {
      key: "mech-game-summary",
      stage: "Game analysis",
      title: "I can break a game manual into scoring, match timeline, and key rules",
      successCriteria:
        "A one-page summary with every scoring action and its point value, done in under 2 hours.",
      practice:
        "Pick a past game none of you built for. Read the manual and write the one-page summary without looking at anyone else's.",
      checkType: "self",
      estimatedMinutes: 120,
      resources: [lynkStrategy, blueAlliance, youtube("FRC game reveal animation")],
    },
    {
      key: "mech-score-estimate",
      stage: "Game analysis",
      title: "I can estimate what a strong robot scores per match",
      successCriteria:
        "A points-per-match estimate for auto, teleop, and endgame, with the assumptions written down.",
      practice:
        "Estimate cycle time for one scoring action, then multiply out for a full teleop period. Compare your number to real results on Statbotics.",
      checkType: "self",
      estimatedMinutes: 45,
      resources: [statbotics, blueAlliance],
    },
    {
      key: "mech-design-rules",
      stage: "Game analysis",
      title: "I can find the rules that limit robot design",
      successCriteria:
        "A list of size, height, extension, and interaction rules with their rule numbers.",
      practice: "Go through the robot rules section and list every rule that would change what you build.",
      checkType: "self",
      estimatedMinutes: 45,
      resources: [lynkStrategy],
    },
    {
      key: "mech-rank-actions",
      stage: "Strategy",
      title: "I can rank robot actions by value and difficulty",
      successCriteria:
        "A ranked list the group agrees on, with points per second for each action.",
      practice: "For each scoring action, divide points by the seconds it takes. Rank them, then argue about the top three.",
      checkType: "quiz",
      estimatedMinutes: 40,
      resources: [lynkStrategy, youtube("Effective FIRST Strategies Karthik")],
      quiz: [
        {
          prompt:
            "Action A scores 6 points and takes 12 seconds. Action B scores 2 points and takes 3 seconds. Which earns more points per second?",
          options: ["Action A", "Action B", "They are the same"],
          correctIndex: 1,
          explanation: "A earns 0.5 points per second. B earns about 0.67 points per second.",
        },
        {
          prompt: "When ranking actions, why look at difficulty as well as points?",
          options: [
            "Difficult actions are always worth more",
            "An action the team can't build reliably in time scores nothing",
            "Judges award points for difficulty",
          ],
          correctIndex: 1,
          explanation: "A mechanism that never works in matches is worth zero, however many points it could score.",
        },
        {
          prompt: "What should drive robot design?",
          options: ["The strategy", "The coolest mechanism idea", "Whatever won last year"],
          correctIndex: 0,
          explanation: "Strategy decides what the robot must do. Design follows from that.",
        },
      ],
    },
    {
      key: "mech-requirements",
      stage: "Strategy",
      title: "I can turn a strategy into robot requirements",
      successCriteria:
        "Written requirements such as \"scores 3 game pieces in auto,\" not a mechanism name.",
      practice: "Write 5 requirements for your chosen strategy. If one names a mechanism, rewrite it as what the robot must do.",
      checkType: "mentor",
      estimatedMinutes: 40,
      resources: [lynkStrategy, lynkDesign],
    },
    {
      key: "mech-brainstorm",
      stage: "Sketching",
      title: "I can brainstorm many ideas before picking one",
      successCriteria:
        "At least 10 rough sketches for one function in 15 minutes, with no judging during the brainstorm.",
      practice: "Set a 15-minute timer. Sketch 10 different ways to pick up the game piece. Quantity over quality.",
      checkType: "self",
      estimatedMinutes: 20,
      resources: [lynkDesign, youtube("FRC intake design ideas")],
    },
    {
      key: "mech-buildable-sketch",
      stage: "Sketching",
      title: "I can draw a mechanism clearly enough for someone else to build",
      successCriteria:
        "A sketch with a side view, key dimensions, motor location, and range of motion.",
      practice: "Take your best brainstorm idea and redraw it with a side view, dimensions, and where the motor goes. Hand it to a teammate and ask them to explain it back.",
      checkType: "mentor",
      estimatedMinutes: 45,
      resources: [lynkDesign, spectrumTraining],
    },
    {
      key: "mech-decision-matrix",
      stage: "Sketching",
      title: "I can compare ideas with a decision matrix",
      successCriteria:
        "A weighted matrix with criteria from the requirements, and a choice the group can defend.",
      practice: "Score your top 3 ideas on 4 weighted criteria taken from your requirements.",
      checkType: "quiz",
      estimatedMinutes: 30,
      resources: [lynkDesign, youtube("weighted decision matrix engineering")],
      quiz: [
        {
          prompt: "Where should the criteria in a decision matrix come from?",
          options: ["The robot requirements", "Whatever is easiest to score", "The mentor's favorite idea"],
          correctIndex: 0,
          explanation: "Criteria should measure how well each idea meets the requirements.",
        },
        {
          prompt:
            "Reliability has weight 3 and cost has weight 1. Idea X scores 4 on reliability and 2 on cost. What is its weighted total?",
          options: ["6", "8", "14"],
          correctIndex: 2,
          explanation: "4 × 3 + 2 × 1 = 14.",
        },
        {
          prompt: "Two ideas tie in the matrix. What is the best next step?",
          options: ["Flip a coin", "Prototype to test the unknown that separates them", "Pick the one that looks cooler"],
          correctIndex: 1,
          explanation: "A tie usually means you are missing information. A prototype can get it.",
        },
      ],
    },
    {
      key: "mech-prototype-question",
      stage: "Prototyping",
      title: "I can name the unknown a prototype must answer",
      successCriteria: "One question per prototype, such as \"What compression grips the ball best?\"",
      practice: "For your chosen design, list everything you don't know yet. Circle the one that could sink the design.",
      checkType: "quiz",
      estimatedMinutes: 20,
      resources: [spectrumTraining, lynkDesign],
      quiz: [
        {
          prompt: "Which is the best question for a prototype to answer?",
          options: [
            "Can we build an intake?",
            "How much compression on the wheels grips the game piece without stalling the motor?",
            "Will the robot be good?",
          ],
          correctIndex: 1,
          explanation: "A good prototype question is specific and can be measured.",
        },
        {
          prompt: "Why build a prototype at all?",
          options: [
            "To learn something you can't figure out on paper",
            "To have something to show visitors",
            "Because every subteam should build something",
          ],
          correctIndex: 0,
          explanation: "A prototype is an experiment. If you already know the answer, don't build it.",
        },
      ],
    },
    {
      key: "mech-test-card",
      stage: "Prototyping",
      title: "I can plan a prototype as an experiment",
      successCriteria:
        "A filled-in test card: question, variable changed, what is measured, and what counts as success.",
      practice: "Fill in a prototype test card before cutting any material: question, variable, measurement, success, results table, decision.",
      checkType: "mentor",
      estimatedMinutes: 25,
      resources: [spectrumTraining],
    },
    {
      key: "mech-run-trials",
      stage: "Prototyping",
      title: "I can run trials and record results honestly",
      successCriteria: "At least 5 trials per setting, with results in a table, including failures.",
      practice: "Run your prototype at 3 settings, 5 trials each. Record every result, including the bad ones.",
      checkType: "quiz",
      estimatedMinutes: 60,
      resources: [youtube("FRC prototype testing")],
      quiz: [
        {
          prompt: "Why run at least 5 trials at each setting?",
          options: ["One good result could be luck", "It takes up time", "The rules require it"],
          correctIndex: 0,
          explanation: "Repeated trials show whether a result is consistent.",
        },
        {
          prompt: "You're testing wheel compression. What should stay the same between trials?",
          options: [
            "Everything except the compression",
            "Nothing, change as much as possible",
            "Only the motor",
          ],
          correctIndex: 0,
          explanation: "Change one variable at a time so you know what caused the difference.",
        },
        {
          prompt: "A trial fails in a strange way. What do you do with that result?",
          options: ["Leave it out", "Record it and note what happened", "Redo it until it works"],
          correctIndex: 1,
          explanation: "Failures are data. They often show the problem you need to solve.",
        },
      ],
    },
    {
      key: "mech-conclusion",
      stage: "Prototyping",
      title: "I can draw a conclusion and decide what to test next",
      successCriteria: "A short write-up of what the data showed and the next decision, in 3–5 sentences.",
      practice: "Write 3–5 sentences: what the data shows, how sure you are, and the next decision or test.",
      checkType: "mentor",
      estimatedMinutes: 20,
      resources: [lynkDesign],
    },
    {
      key: "mech-fast-rig",
      stage: "Fast build",
      title: "I can build a test rig quickly from scrap and COTS parts",
      successCriteria: "A working rig in one session using wood, polycarb, or extrusion, not polished parts.",
      practice: "Build the simplest rig that answers your prototype question in one class session.",
      checkType: "mentor",
      estimatedMinutes: 90,
      resources: [lynkBuild, spectrumTraining, youtube("FRC prototyping wood polycarbonate")],
    },
    {
      key: "mech-tool-signoff",
      stage: "Fast build",
      title: "I can use shop tools safely for prototyping",
      successCriteria: "A current sign-off on each tool you use, per the team handbook.",
      practice: "Check which tools you're signed off on in Shop Tools. Get trained on the ones your prototype needs.",
      checkType: "mentor",
      estimatedMinutes: 60,
      resources: [lynkBuild],
    },
    {
      key: "mech-ratios",
      stage: "Design",
      title: "I can pick a gear or belt ratio for a target speed or force",
      successCriteria: "A ratio with the math shown, checked against a motor's speed and torque.",
      practice:
        "Work through the interactive lesson, then pick a ratio for an arm or elevator from one of your prototypes and check it in ReCalc.",
      checkType: "quiz",
      estimatedMinutes: 45,
      resources: [motorRatioLesson, recalc, spectrumMotors, frcDesign],
      quiz: [
        {
          prompt: "A 4:1 reduction (4 motor turns for 1 output turn) does what to output speed and torque?",
          options: ["Speed ÷ 4, torque × 4", "Speed × 4, torque ÷ 4", "Both stay the same"],
          correctIndex: 0,
          explanation: "A reduction trades speed for torque. Ignoring losses, speed drops by 4 and torque rises by 4.",
        },
        {
          prompt: "A motor spins at 6,000 RPM with no load. Through a 10:1 reduction, what is the output free speed?",
          options: ["60 RPM", "600 RPM", "60,000 RPM"],
          correctIndex: 1,
          explanation: "6,000 ÷ 10 = 600 RPM.",
        },
        {
          prompt: "An arm holds still at horizontal. If you double the gear reduction, the current each motor draws to hold it…",
          options: ["Roughly halves", "Doubles", "Stays the same"],
          correctIndex: 0,
          explanation: "Twice the reduction means each motor needs half the torque, and current follows torque.",
        },
        {
          prompt: "Your elevator gets slower when you raise the ratio from 8:1 to 20:1. Why?",
          options: [
            "Its top speed drops, and it now spends most of the trip at that lower top speed",
            "The motor runs out of current",
            "Higher ratios always stall",
          ],
          correctIndex: 0,
          explanation: "Past the sweet spot, extra reduction only lowers top speed. Below it, the mechanism accelerates too slowly.",
        },
        {
          prompt: "A mechanism holds a load near the motor's stall torque for several seconds. What happens?",
          options: [
            "The motor heats up fast and can trip its breaker",
            "Nothing, holding still uses no power",
            "The motor speeds up",
          ],
          correctIndex: 0,
          explanation: "Near stall, current is huge and all of it turns into heat.",
        },
        {
          prompt: "Under a motor limit you want one motor to do the job of two on an elevator. What is the usual trade?",
          options: [
            "Use more reduction, so it is slower but still lifts and holds",
            "Use less reduction so it is faster",
            "Raise the current limit until it works",
          ],
          correctIndex: 0,
          explanation: "One motor has half the torque, so you need more reduction to lift the same load, which costs speed.",
        },
      ],
    },
    {
      key: "mech-onshape",
      stage: "Design",
      title: "I can move a proven sketch into Onshape",
      successCriteria: "A simple part studio or assembly that matches the tested sketch.",
      practice: "Model your tested prototype in Onshape: the frame, the moving part, and where the motor mounts.",
      checkType: "self",
      estimatedMinutes: 120,
      resources: [frcDesign, lynkDesign],
    },
    {
      key: "mech-design-review",
      stage: "Design",
      title: "I can present a design and take feedback",
      successCriteria:
        "A 5-minute review where you explain the requirement, the test data, and the choice.",
      practice: "Prepare 3 slides or sketches: the requirement, what testing showed, and the design you chose.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [lynkDesign],
    },
  ],
};

const electrical: SeedPath = {
  slug: "electrical-controls",
  title: "Electrical & Control Systems",
  summary:
    "Choose motors, make reliable connections, wire a clean robot, read status lights, and configure CTRE devices in Phoenix Tuner X.",
  color: "amber",
  skills: [
    {
      key: "elec-motor-basics",
      stage: "Motors",
      title: "I can explain free speed, stall torque, and stall current",
      successCriteria:
        "Read a motor curve and explain why a motor near stall gets hot and trips breakers.",
      practice: "Work through Spectrum's Motors and Power tutorial, then explain a motor curve to a teammate.",
      checkType: "quiz",
      estimatedMinutes: 40,
      resources: [spectrumMotors, spectrumTraining],
      quiz: [
        {
          prompt: "What is a motor's free speed?",
          options: [
            "How fast it spins with no load",
            "How fast it spins at maximum torque",
            "The speed limit set in code",
          ],
          correctIndex: 0,
          explanation: "Free speed is the speed with nothing attached and no load.",
        },
        {
          prompt: "When a motor is stalled (powered but not turning), current is…",
          options: ["At its lowest", "At its highest", "Zero"],
          correctIndex: 1,
          explanation: "Stall current is the most current the motor draws, which is why stalls heat motors and trip breakers.",
        },
        {
          prompt: "As load on a motor increases, its speed…",
          options: ["Goes up", "Goes down", "Stays the same"],
          correctIndex: 1,
          explanation: "More load means less speed and more current, until it stalls.",
        },
      ],
    },
    {
      key: "elec-motor-compare",
      stage: "Motors",
      title: "I can compare the motors the team uses",
      successCriteria: "Name each motor's strengths and the controller it needs.",
      practice: "Make a quick table of the motors in our inventory: free speed, stall torque, controller, and where we use each.",
      checkType: "self",
      estimatedMinutes: 30,
      resources: [spectrumMotors, recalc],
    },
    {
      key: "elec-motor-select",
      stage: "Motor selection",
      title: "I can pick a motor and ratio for a mechanism",
      successCriteria:
        "For a given load and speed, pick a motor and gear ratio and show the math or a calculator result.",
      practice: "Choose a motor and ratio for an elevator from a past robot. Check it in ReCalc and explain your choice.",
      checkType: "mentor",
      estimatedMinutes: 60,
      resources: [motorRatioLesson, recalc, spectrumMotors],
    },
    {
      key: "elec-motor-limit",
      stage: "Motor selection",
      title: "I can decide where motors matter most under a motor limit",
      successCriteria:
        "Explain which mechanisms could share a motor or use a smaller one, and the trade-off.",
      practice: "Take a past robot and cut its motor count by two. Which mechanisms change, and what do you lose?",
      checkType: "self",
      estimatedMinutes: 30,
      resources: [
        {
          title: "2027 Event & Robot Rule Preview, Part 1",
          url: "https://www.firstinspires.org/community-blog/2026-event-robot-rule-preview-for-2027-season-part-1",
          kind: "reading",
          source: "FIRST",
        },
      ],
    },
    {
      key: "elec-crimp",
      stage: "Crimping",
      title: "I can crimp Powerpole and ferrule connections correctly",
      successCriteria: "5 crimps in a row that pass a pull test and visual inspection.",
      practice: "Crimp 5 Powerpoles and 5 ferrules. Pull test each one before showing a mentor.",
      checkType: "mentor",
      estimatedMinutes: 45,
      resources: [lynkElectrical, youtube("FRC Powerpole crimping"), youtube("wire ferrule crimping")],
    },
    {
      key: "elec-bad-crimp",
      stage: "Crimping",
      title: "I can spot a bad crimp",
      successCriteria: "Pick out the failures from a set of good and bad crimps and say why each failed.",
      practice: "Ask a mentor for the bad-crimp sample board and find every failure.",
      checkType: "quiz",
      estimatedMinutes: 20,
      resources: [lynkElectrical],
      quiz: [
        {
          prompt: "Which is a sign of a bad crimp?",
          options: [
            "Insulation caught inside the crimp barrel",
            "Bare wire fully inside the barrel with no stray strands",
            "The wire holds when you pull on it",
          ],
          correctIndex: 0,
          explanation: "Insulation in the barrel means the metal isn't making good contact.",
        },
        {
          prompt: "What does a pull test check?",
          options: ["That the crimp holds the wire mechanically", "The wire's color", "The battery voltage"],
          correctIndex: 0,
          explanation: "A firm tug should never pull the wire out of a good crimp.",
        },
        {
          prompt: "A few wire strands stick out of the barrel. What do you do?",
          options: ["Leave it", "Cut it off and redo the crimp", "Cover it with tape"],
          correctIndex: 1,
          explanation: "Stray strands can short to nearby parts. Redo it.",
        },
      ],
    },
    {
      key: "elec-wire-gauge",
      stage: "Wiring",
      title: "I can match wire gauge to breaker size",
      successCriteria: "State the right gauge for each common breaker, from the current game manual.",
      practice: "Find the wire gauge table in the robot rules and make a cheat sheet for the practice board.",
      checkType: "quiz",
      estimatedMinutes: 20,
      resources: [spectrumControlSystems, wiringBestPractices],
      quiz: [
        {
          prompt: "As the AWG number gets smaller (for example 18 → 12), the wire gets…",
          options: ["Thinner", "Thicker", "Longer"],
          correctIndex: 1,
          explanation: "Smaller AWG numbers mean thicker wire that carries more current.",
        },
        {
          prompt: "A circuit gets a bigger breaker. What happens to the wire gauge it needs?",
          options: ["It needs thicker wire", "It needs thinner wire", "No change"],
          correctIndex: 0,
          explanation: "More current needs thicker wire so it doesn't overheat before the breaker trips.",
        },
        {
          prompt: "Where do you find the official wire gauge rules each season?",
          options: ["The robot rules in the game manual", "A forum post", "Last year's robot"],
          correctIndex: 0,
          explanation: "Rules can change, so always check the current manual.",
        },
      ],
    },
    {
      key: "elec-can-chain",
      stage: "Wiring",
      title: "I can wire a CAN chain correctly",
      successCriteria:
        "A working chain with every device seen in Tuner, correct termination, and no loose connectors.",
      practice: "Wire 4 devices into a CAN chain on the practice board and confirm all of them show up in Tuner.",
      checkType: "mentor",
      estimatedMinutes: 60,
      resources: [spectrumControlSystems, wiringBestPractices],
    },
    {
      key: "elec-service-layout",
      stage: "Wiring",
      title: "I can lay out wiring so it can be serviced",
      successCriteria:
        "A practice board with labeled wires, strain relief, and every connector reachable without removing parts.",
      practice: "Lay out a practice board as if it were on the robot, then swap a motor controller in under 5 minutes.",
      checkType: "mentor",
      estimatedMinutes: 90,
      resources: [wiringBestPractices, lynkElectrical],
    },
    {
      key: "elec-multimeter",
      stage: "Wiring",
      title: "I can use a multimeter to find a fault",
      successCriteria: "Find an open, a short, or low voltage on a test board.",
      practice: "Measure battery voltage, check continuity on a cable, and find the planted fault on the test board.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [lynkElectrical, youtube("how to use a multimeter continuity voltage")],
    },
    {
      key: "elec-read-lights",
      stage: "Status lights",
      title: "I can read status lights on our motor controllers, PDH, and controller",
      successCriteria: "Explain what each light pattern means using the vendor docs, and what to do next.",
      practice: "Power up the practice board, look at each device's lights, and look up what each one means.",
      checkType: "self",
      estimatedMinutes: 30,
      resources: [statusLights, talonFxReference],
    },
    {
      key: "elec-diagnose-lights",
      stage: "Status lights",
      title: "I can diagnose a robot from its lights",
      successCriteria: "Given a robot with a planted fault, find it from the lights before using a laptop.",
      practice: "Have a teammate plant a fault (loose CAN wire, duplicate ID, tripped breaker). Find it from the lights alone.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [statusLights, talonFxReference],
    },
    {
      key: "elec-tuner-firmware",
      stage: "Phoenix Tuner X",
      title: "I can find devices and update firmware in Phoenix Tuner X",
      successCriteria: "Connect, see every CAN device, and bring firmware up to date.",
      practice: "Connect to the practice board, list every device, and update anything that's out of date.",
      checkType: "self",
      estimatedMinutes: 30,
      resources: [tunerX, spectrumCtreModes],
    },
    {
      key: "elec-tuner-ids",
      stage: "Phoenix Tuner X",
      title: "I can set CAN IDs and names without conflicts",
      successCriteria: "Set IDs to the team's numbering plan, with no duplicates.",
      practice: "Renumber the practice board devices to the team's ID plan and give each a clear name.",
      checkType: "mentor",
      estimatedMinutes: 20,
      resources: [tunerX],
    },
    {
      key: "elec-tuner-run",
      stage: "Phoenix Tuner X",
      title: "I can run a motor and read live data in Phoenix Tuner X",
      successCriteria:
        "Spin a motor safely from Tuner, then read velocity, current, and temperature in a plot.",
      practice: "With a mentor present, run a motor from Tuner and plot velocity and current as you load it by hand.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [tunerX, spectrumCtreModes],
    },
    {
      key: "elec-tuner-snapshot",
      stage: "Phoenix Tuner X",
      title: "I can save and restore device configs",
      successCriteria: "Take a snapshot and explain how to swap a failed motor in the pits.",
      practice: "Write the steps for replacing a dead motor at competition, from unplugging it to verifying the new one.",
      checkType: "self",
      estimatedMinutes: 20,
      resources: [tunerX],
    },
    {
      key: "elec-batteries",
      stage: "Batteries",
      title: "I can handle, charge, and test batteries safely",
      successCriteria: "Follow the battery procedure and log a reading in the DolphinApps battery tool.",
      practice: "Test a battery with the Beak and log the reading in Batteries.",
      checkType: "mentor",
      estimatedMinutes: 20,
      resources: [lynkElectrical],
    },
    {
      key: "elec-systemcore",
      stage: "Systemcore",
      title: "I can explain what changes from the roboRIO in 2027",
      successCriteria:
        "List the main changes, including the new power and CAN connectors and multiple CAN buses.",
      practice: "Read the Systemcore introduction and list three things that change for our wiring.",
      checkType: "quiz",
      estimatedMinutes: 30,
      resources: [
        {
          title: "Systemcore introduction",
          url: "https://docs.wpilib.org/en/latest/docs/software/systemcore-info/systemcore-introduction.html",
          kind: "reading",
          source: "WPILib",
        },
        {
          title: "Systemcore pricing and availability",
          url: "https://www.firstinspires.org/community-blog/2026-systemcore-pricing-and-availability",
          kind: "reading",
          source: "FIRST",
        },
      ],
      quiz: [
        {
          prompt: "What does Systemcore replace in 2027?",
          options: ["The roboRIO", "The PDH", "The radio"],
          correctIndex: 0,
          explanation: "Systemcore replaces the roboRIO as the robot controller and is required for 2027.",
        },
        {
          prompt: "Which is new with Systemcore?",
          options: ["Support for multiple CAN buses", "Only one CAN bus allowed", "No CAN support"],
          correctIndex: 0,
          explanation: "Systemcore supports multiple CAN buses, plus an onboard IMU.",
        },
        {
          prompt: "How do teams get their first Systemcore?",
          options: [
            "It comes in the 2027 Kickoff Kit",
            "Teams must buy it from a vendor",
            "It is optional in 2027",
          ],
          correctIndex: 0,
          explanation: "Every team receives one in the Kickoff Kit and must use it in 2027.",
        },
      ],
    },
  ],
};

const business: SeedPath = {
  slug: "business-media",
  title: "Business, Media & Outreach",
  summary:
    "Document the team's impact, help raise money, make media that follows team rules, and speak for the team.",
  color: "violet",
  skills: [
    {
      key: "biz-impact-judging",
      stage: "Impact Award",
      title: "I can explain what Impact Award judges look for",
      successCriteria: "Summarize the judging guidelines and use the official award definitions correctly.",
      practice: "Read the judging guidelines and definitions, then explain the award to a teammate in 2 minutes.",
      checkType: "quiz",
      estimatedMinutes: 40,
      resources: [impactResources, lynkBusiness],
      quiz: [
        {
          prompt: "What is the Impact Award?",
          options: [
            "FIRST's most prestigious award, for a team that is a model for others",
            "An award for the highest-scoring robot",
            "An award for the best team video",
          ],
          correctIndex: 0,
          explanation: "It honors the team that best represents a model for other teams and best embodies FIRST's mission.",
        },
        {
          prompt: "What makes an Impact claim strong?",
          options: ["A number or a documented event behind it", "Big adjectives", "Mentioning many programs briefly"],
          correctIndex: 0,
          explanation: "Judges look for measurable impact you can back up.",
        },
        {
          prompt: "Why does FIRST publish award definitions?",
          options: [
            "So teams use common terms the same way",
            "To limit the essay length",
            "They are only for judges",
          ],
          correctIndex: 0,
          explanation: "Teams are responsible for using defined terms correctly.",
        },
      ],
    },
    {
      key: "biz-past-winners",
      stage: "Impact Award",
      title: "I can learn from past winning submissions",
      successCriteria: "Read two winning submissions and list how each backs claims with numbers.",
      practice: "Read two past winners and highlight every claim backed by a number.",
      checkType: "self",
      estimatedMinutes: 45,
      resources: [impactResources],
    },
    {
      key: "biz-impact-draft",
      stage: "Impact Award",
      title: "I can draft a submission section backed by evidence",
      successCriteria:
        "A draft section in the current format where every claim cites a logged event or number.",
      practice: "Draft one section from the outreach log. Have a teammate mark any claim without evidence.",
      checkType: "mentor",
      estimatedMinutes: 90,
      resources: [impactResources],
    },
    {
      key: "biz-outreach-log",
      stage: "Outreach records",
      title: "I can keep the outreach log complete",
      successCriteria: "Every event this school year logged with date, people reached, and students involved.",
      practice: "Add every outreach event from this school year to the log, starting with Beach Blitz.",
      checkType: "self",
      estimatedMinutes: 45,
      resources: [impactResources],
    },
    {
      key: "biz-sponsor-research",
      stage: "Sponsors",
      title: "I can research potential sponsors",
      successCriteria: "5 local companies with a STEM link and a named contact path, added to the sponsor tracker.",
      practice: "Find 5 local companies that support STEM and add them to the tracker with how to reach them.",
      checkType: "self",
      estimatedMinutes: 60,
      resources: [lynkBusiness],
    },
    {
      key: "biz-sponsor-email",
      stage: "Sponsors",
      title: "I can write a sponsor email a mentor would send",
      successCriteria: "A draft that names a specific ask and is approved by a mentor before sending.",
      practice: "Draft an email to one company from your research with one specific ask.",
      checkType: "mentor",
      estimatedMinutes: 40,
      resources: [lynkBusiness],
    },
    {
      key: "biz-sponsor-rules",
      stage: "Sponsors",
      title: "I can follow the rules for working with sponsors",
      successCriteria: "Explain why students never promise anything to a sponsor without adult approval.",
      checkType: "quiz",
      estimatedMinutes: 10,
      resources: [lynkBusiness],
      quiz: [
        {
          prompt: "A sponsor asks if their logo can go on the robot. What do you say?",
          options: [
            "Yes, of course",
            "That a mentor will follow up, then tell a mentor",
            "No, never",
          ],
          correctIndex: 1,
          explanation: "Students don't make promises to sponsors without adult approval.",
        },
        {
          prompt: "Why track every sponsor contact?",
          options: [
            "So no company gets contacted twice or forgotten",
            "To count how many emails you sent",
            "It isn't needed",
          ],
          correctIndex: 0,
          explanation: "Tracking keeps outreach organized and professional.",
        },
      ],
    },
    {
      key: "biz-media-rules",
      stage: "Media",
      title: "I can follow the media approval and privacy rules",
      successCriteria:
        "Check the do-not-photograph list and get approval from the media lead and an adult before posting.",
      checkType: "quiz",
      estimatedMinutes: 10,
      resources: [lynkBusiness],
      quiz: [
        {
          prompt: "Before posting a team photo, what must you check?",
          options: [
            "The do-not-photograph list, plus approval from the media lead and an adult",
            "Only that the photo looks good",
            "Nothing, team photos are always fine",
          ],
          correctIndex: 0,
          explanation: "The handbook requires both approvals and a check of the do-not-photograph list.",
        },
        {
          prompt: "Which is never okay to post?",
          options: [
            "A student's phone number or home address",
            "A photo of the robot at an event",
            "A thank-you to a sponsor",
          ],
          correctIndex: 0,
          explanation: "Never post personal information like phone numbers, addresses, grades, or schedules.",
        },
      ],
    },
    {
      key: "biz-video",
      stage: "Media",
      title: "I can shoot and edit a short team video",
      successCriteria: "A 30–60 second video about one subteam, approved for posting.",
      practice: "Shoot and edit a 30–60 second video about one subteam, then submit it for approval.",
      checkType: "mentor",
      estimatedMinutes: 120,
      resources: [spectrumTraining, youtube("short video editing basics phone")],
    },
    {
      key: "biz-photos",
      stage: "Media",
      title: "I can take usable event photos",
      successCriteria: "10 well-framed photos from one session or event, with names and privacy checked.",
      practice: "Take 20 photos during one class, then pick your best 10.",
      checkType: "self",
      estimatedMinutes: 45,
      resources: [youtube("event photography tips phone")],
    },
    {
      key: "biz-pitch",
      stage: "Speaking",
      title: "I can give a 2-minute team pitch",
      successCriteria: "Explain the team, its outreach, and last season's robot without notes, to a mentor.",
      practice: "Practice your pitch with a teammate three times, then time yourself.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [lynkBusiness],
    },
    {
      key: "biz-judge-qa",
      stage: "Speaking",
      title: "I can answer judge-style questions",
      successCriteria: "Answer 5 practice questions with specific examples and numbers.",
      practice: "Have a teammate ask you 5 judge-style questions. Answer each with one example and one number.",
      checkType: "mentor",
      estimatedMinutes: 30,
      resources: [impactResources, lynkBusiness],
    },
  ],
};

export const learningSeedPaths: SeedPath[] = [mechanical, electrical, business];
