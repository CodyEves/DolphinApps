type ProfileContentField = "displayName" | "bio";

export type ProfileContentIssue = {
  field: ProfileContentField;
  message: string;
};

const blockedTerms = [
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bullshit",
  "chink",
  "cock",
  "cunt",
  "damn",
  "dick",
  "douchebag",
  "fag",
  "faggot",
  "fuck",
  "fucked",
  "fucker",
  "fucking",
  "gook",
  "kike",
  "nigga",
  "nigger",
  "piss",
  "pussy",
  "retard",
  "retarded",
  "shit",
  "shitty",
  "slut",
  "spic",
  "tranny",
  "twat",
  "wetback",
  "whore",
];

const characterSwaps: Record<string, string> = {
  "!": "i",
  "$": "s",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "|": "i",
};

const blockedPatterns = blockedTerms.map((term) => {
  const spacedLetters = [...term].join("\\s*");

  return new RegExp(`(^|\\s)${spacedLetters}(\\s|$)`);
});

function normalizeProfileContent(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!$013457@|]/g, (character) => characterSwaps[character] ?? character)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function containsProhibitedProfileLanguage(value: string) {
  const normalized = normalizeProfileContent(value);

  if (!normalized) {
    return false;
  }

  return blockedPatterns.some((pattern) => pattern.test(normalized));
}

export function validateProfileContent(input: {
  displayName: string;
  bio: string;
}): ProfileContentIssue | null {
  if (containsProhibitedProfileLanguage(input.displayName)) {
    return {
      field: "displayName",
      message: "Display name contains language that is not allowed on student profiles.",
    };
  }

  if (containsProhibitedProfileLanguage(input.bio)) {
    return {
      field: "bio",
      message: "Bio contains language that is not allowed on student profiles.",
    };
  }

  return null;
}
