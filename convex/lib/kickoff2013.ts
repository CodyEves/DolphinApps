/**
 * The 2013 ULTIMATE ASCENT mock kickoff rules quiz.
 *
 * Shared by the cheat-sheet page (src/pages/kickoff-2013.tsx) and the Learning
 * starter content, so the page's question order always matches the saved
 * skill and scores can be checked on the server with learning.submitQuiz.
 * If you change these questions, run "Load starter skills" again only for a
 * fresh database; an existing skill keeps the quiz it was loaded with, so
 * edit it in Learning > Manage too.
 */

export const KICKOFF_2013_SKILL_KEY = "mech-2013-rules";
export const KICKOFF_2013_PATH = "/training/kickoff/2013";

export type KickoffQuizQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  /** Rule references shown with the explanation, e.g. "G22" or "R03, G23". */
  rules: string;
};

export const KICKOFF_2013_QUIZ: KickoffQuizQuestion[] = [
  { prompt: "How long is AUTO in ULTIMATE ASCENT?", options: ["10 seconds", "15 seconds", "20 seconds", "30 seconds"], correctIndex: 1, explanation: "AUTO is the first 15 seconds of a 2:15 match.", rules: "3.1.2" },
  { prompt: "A disc goes in the HIGH GOAL during AUTO. How many points?", options: ["3", "4", "5", "6"], correctIndex: 3, explanation: "HIGH is 6 in AUTO and 3 in TELEOP.", rules: "3.1.5.1" },
  { prompt: "Where are your alliance's HIGH and MIDDLE goals?", options: ["Above your own driver station", "Above the opponent's alliance wall", "On top of your PYRAMID", "On the side walls"], correctIndex: 1, explanation: "You load at your own wall and shoot at goals over the opponent's wall.", rules: "2.2.3" },
  { prompt: "Which discs score in your PYRAMID GOAL?", options: ["Any disc", "White discs only", "Your alliance's colored discs only", "Opponent colored discs"], correctIndex: 2, explanation: "Only discs that match the pyramid's color, 5 points each, TELEOP only.", rules: "3.1.5.1" },
  { prompt: "What's the most discs a robot may control at once?", options: ["2", "3", "4", "No limit"], correctIndex: 2, explanation: "4. Each extra disc is a FOUL.", rules: "G24" },
  { prompt: "How tall may a robot be while crossing the middle of the field?", options: ["54 in", "60 in", "84 in", "No limit"], correctIndex: 1, explanation: "60 in, unless it's in its AUTO ZONE or touching its PYRAMID, where 84 in is allowed.", rules: "G22" },
  { prompt: "The robot must always fit inside a circle of what diameter?", options: ["36 in", "48 in", "54 in", "60 in"], correctIndex: 2, explanation: "54 in, including anything that extends.", rules: "R03, G23" },
  { prompt: "What's the max frame perimeter?", options: ["100 in", "112 in", "120 in", "128 in"], correctIndex: 1, explanation: "112 in, e.g. 28 × 28 in.", rules: "R03" },
  { prompt: "A robot's lowest point is above the 30 in rung but below the 60 in rung. What level?", options: ["Level 1", "Level 2", "Level 3", "No climb"], correctIndex: 1, explanation: "Level 2: 20 points.", rules: "3.1.5.2" },
  { prompt: "Can a robot reach straight from the floor to the 60 in rung and skip Level 2?", options: ["Yes", "No, levels must go in order, touching no more than two at once", "Only in AUTO", "Only with a belay"], correctIndex: 1, explanation: "A climb is sequential and may never touch more than two levels at once.", rules: "3.1.5.2" },
  { prompt: "How many points does a TECHNICAL FOUL give the opponent?", options: ["3", "5", "10", "20"], correctIndex: 3, explanation: "FOUL = 3, TECHNICAL FOUL = 20.", rules: "3.1.4" },
  { prompt: "You touch an opponent who is climbing their PYRAMID. What happens?", options: ["Nothing, defense is legal", "A FOUL", "A TECHNICAL FOUL, and they can get Level 3 points", "You lose your climb"], correctIndex: 2, explanation: "Robots touching their PYRAMID are protected.", rules: "G30" },
  { prompt: "How many discs may a robot preload if it starts outside its AUTO ZONE?", options: ["1", "2", "3", "4"], correctIndex: 2, explanation: "3 outside the AUTO ZONE, 2 inside it.", rules: "G06" },
  { prompt: "In AUTO, a robot drives across the CENTER LINE. What happens?", options: ["Nothing", "A FOUL (TECHNICAL FOUL if it hits someone)", "It's disabled", "Its discs don't count"], correctIndex: 1, explanation: "Robots must stay on their starting half in AUTO.", rules: "G19" },
  { prompt: "What's the max robot weight?", options: ["100 lb", "120 lb with battery", "120 lb without battery and bumpers", "150 lb"], correctIndex: 2, explanation: "120 lb, not counting battery and BUMPERS.", rules: "R05" },
];
