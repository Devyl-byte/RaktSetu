export type VerificationChallenge = {
  challengeId: string;
  message: string;
};

export type VerificationResult = {
  verified: true;
  provider: "demo-aadhaar";
  subjectToken: string;
  personId: string;
};

export interface IdentityVerificationProvider {
  startVerification(testSubjectId: string): Promise<VerificationChallenge>;
  completeVerification(
    challengeId: string,
    testSubjectId: string,
  ): Promise<VerificationResult>;
}

const syntheticPeople: Record<string, { subjectToken: string; personId: string }> = {
  "aarav-demo": {
    subjectToken: "demo-subject-7f4a2",
    personId: "RS-P-50742",
  },
};

export const demoAadhaarProvider: IdentityVerificationProvider = {
  async startVerification(testSubjectId) {
    if (!syntheticPeople[testSubjectId]) {
      throw new Error("Unknown synthetic identity");
    }
    return {
      challengeId: `demo-challenge-${testSubjectId}`,
      message: "Synthetic consent and OTP challenge created.",
    };
  },

  async completeVerification(challengeId, testSubjectId) {
    const person = syntheticPeople[testSubjectId];
    if (!person || challengeId !== `demo-challenge-${testSubjectId}`) {
      throw new Error("Synthetic verification could not be completed");
    }
    return {
      verified: true,
      provider: "demo-aadhaar",
      ...person,
    };
  },
};

