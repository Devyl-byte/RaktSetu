export const dynamicParams = false;

export function generateStaticParams() {
  return [
    "sign-in",
    "register",
    "verify-otp",
    "onboarding",
    "staff",
    "donor",
    "account",
  ].map((path) => ({ path: [path] }));
}

export { default } from "../page";
