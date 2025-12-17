import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onboardingCurrent } from "./api";
import { useAuth } from "./auth";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type OnboardingStep1Draft = {
  legal_name: string;
  dba: string;
  ein: string;
  formation_date: string;
  formation_state: string;
  entity_type: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  industry: string;
  industry_other: string;
  website: string;
  description: string;
};

export type OnboardingStep2Draft = { role: "owner" | "authorized_rep" | ""; title: string };

export type OnboardingStep3Draft = { full_name: string; title: string; file?: File; file_id?: string; attestation: boolean };

export type OnboardingStep4Draft = { bank_name: string; account_number: string; ach_routing: string; wire_routing: string; swift: string };

export type OnboardingVerifyDraft = { otpMethod: "email" | "sms"; otpCode: string; selectedSlot: string };

type OnboardingContextValue = {
  session: any | null;
  currentStep: OnboardingStep;
  completedThrough: number;
  refreshSession: () => Promise<void>;

  step1: OnboardingStep1Draft;
  setStep1: React.Dispatch<React.SetStateAction<OnboardingStep1Draft>>;
  step2: OnboardingStep2Draft;
  setStep2: React.Dispatch<React.SetStateAction<OnboardingStep2Draft>>;
  step3: OnboardingStep3Draft;
  setStep3: React.Dispatch<React.SetStateAction<OnboardingStep3Draft>>;
  step4: OnboardingStep4Draft;
  setStep4: React.Dispatch<React.SetStateAction<OnboardingStep4Draft>>;
  verify: OnboardingVerifyDraft;
  setVerify: React.Dispatch<React.SetStateAction<OnboardingVerifyDraft>>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const DRAFT_KEY = "aplite_onboarding_draft_v1";
const PROGRESS_KEY = "aplite_onboarding_progress_v1";

function loadJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage failures
  }
}

export function normalizeEIN(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function normalizeRouting(raw: string, max = 34) {
  return raw.replace(/\D/g, "").slice(0, max);
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { token, ready } = useAuth();

  const [session, setSession] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [completedThrough, setCompletedThrough] = useState<number>(0);

  const [step1, setStep1] = useState<OnboardingStep1Draft>({
    legal_name: "",
    dba: "",
    ein: "",
    formation_date: "",
    formation_state: "",
    entity_type: "LLC",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    industry: "",
    industry_other: "",
    website: "",
    description: "",
  });
  const [step2, setStep2] = useState<OnboardingStep2Draft>({ role: "", title: "" });
  const [step3, setStep3] = useState<OnboardingStep3Draft>({ full_name: "", title: "", file: undefined, file_id: undefined, attestation: false });
  const [step4, setStep4] = useState<OnboardingStep4Draft>({ bank_name: "", account_number: "", ach_routing: "", wire_routing: "", swift: "" });
  const [verify, setVerify] = useState<OnboardingVerifyDraft>({ otpMethod: "email", otpCode: "", selectedSlot: "" });

  useEffect(() => {
    const saved = loadJson<Partial<OnboardingContextValue>>(DRAFT_KEY) as any;
    if (!saved) return;
    if (saved.step1) setStep1((prev) => ({ ...prev, ...saved.step1 }));
    if (saved.step2) setStep2((prev) => ({ ...prev, ...saved.step2 }));
    if (saved.step3) setStep3((prev) => ({ ...prev, ...saved.step3, file: undefined }));
    if (saved.step4) setStep4((prev) => ({ ...prev, ...saved.step4 }));
    if (saved.verify) setVerify((prev) => ({ ...prev, ...saved.verify }));
  }, []);

  useEffect(() => {
    saveJson(DRAFT_KEY, { step1, step2, step3: { ...step3, file: undefined }, step4, verify });
  }, [step1, step2, step3, step4, verify]);

  useEffect(() => {
    const saved = loadJson<{ completedThrough?: number }>(PROGRESS_KEY);
    if (saved?.completedThrough) setCompletedThrough(saved.completedThrough);
  }, []);

  useEffect(() => {
    saveJson(PROGRESS_KEY, { completedThrough });
  }, [completedThrough]);

  async function refreshSession() {
    if (!ready || !token) return;
    try {
      const current = await onboardingCurrent();
      setSession(current);
      const serverStep = Math.min(Math.max(Number(current.current_step || 1), 1), 5) as OnboardingStep;
      setCurrentStep(serverStep);
      setCompletedThrough((prev) => Math.max(prev, serverStep - 1));
    } catch {
      setSession(null);
      setCurrentStep(1);
    }
  }

  useEffect(() => {
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      session,
      currentStep,
      completedThrough,
      refreshSession,
      step1,
      setStep1,
      step2,
      setStep2,
      step3,
      setStep3,
      step4,
      setStep4,
      verify,
      setVerify,
    }),
    [session, currentStep, completedThrough, step1, step2, step3, step4, verify]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingWizard() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingWizard must be used within OnboardingProvider");
  return ctx;
}

