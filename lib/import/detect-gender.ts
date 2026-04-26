import genderDetection from "gender-detection";

type GenderResult = "M" | "F" | null;

/** Confidence: "sure" = male/female, "likely" = mostly_male/mostly_female, null = unknown */
export type GenderDetection = {
  gender: GenderResult;
  confidence: "sure" | "likely" | null;
};

export function detectGender(firstName: string): GenderDetection {
  if (!firstName.trim()) return { gender: null, confidence: null };

  // gender-detection takes the first word of compound names (e.g. "Max Johannes" → "Max")
  const first = firstName.trim().split(/\s+/)[0];
  const raw: string = genderDetection.detect(first);

  switch (raw) {
    case "male":
      return { gender: "M", confidence: "sure" };
    case "mostly_male":
      return { gender: "M", confidence: "likely" };
    case "female":
      return { gender: "F", confidence: "sure" };
    case "mostly_female":
      return { gender: "F", confidence: "likely" };
    default:
      return { gender: null, confidence: null };
  }
}
