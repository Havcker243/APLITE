import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onboardingCurrent } from "./api";
import { useAuth } from "./auth";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type FormationDocType =
  | "articles_of_organization"
  | "certificate_of_formation"
  | "articles_of_incorporation"
  | "certificate_of_limited_partnership"
  | "partnership_equivalent";

export type OnboardingStep1Draft = {
  legal_name: string;
  dba: string;
  ein: string;
  formation_date: string;
  formation_state: string;
  entity_type: string;
  formation_documents: Array<{ doc_type: FormationDocType; file?: File; file_id?: string }>;
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

const STORAGE_KEY = "aplite_onboarding_session_v2";

type OnboardingContextValue = {
  session: any | null;
  currentStep: OnboardingStep;
  completedThrough: number;
  sessionReady: boolean;
  refreshSession: () => Promise<OnboardingStep>;
  touchStep: (step: OnboardingStep) => void;
  markStepComplete: (step: OnboardingStep) => void;
  clearDraft: () => void;

  step1: OnboardingStep1Draft;
  setStep1: React.Dispatch<React.SetStateAction<OnboardingStep1Draft>>;
  step2: OnboardingStep2Draft;
  setStep2: React.Dispatch<React.SetStateAction<OnboardingStep2Draft>>;
  step3: OnboardingStep3Draft;
  setStep3: React.Dispatch<React.SetStateAction<OnboardingStep3Draft>>;
  step4: OnboardingStep4Draft;
  setStep4: React.Dispatch<React.SetStateAction<OnboardingStep4Draft>>;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function normalizeEIN(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

export function normalizeRouting(raw: string, max = 34) {
  return raw.replace(/\D/g, "").slice(0, max);
}

const INITIAL_STEP1: OnboardingStep1Draft = {
  legal_name: "",
  dba: "",
  ein: "",
  formation_date: "",
  formation_state: "",
  entity_type: "LLC",
  formation_documents: [],
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
};
const INITIAL_STEP2: OnboardingStep2Draft = { role: "", title: "" };
const INITIAL_STEP3: OnboardingStep3Draft = { full_name: "", title: "", file: undefined, file_id: undefined, attestation: false };
const INITIAL_STEP4: OnboardingStep4Draft = { bank_name: "", account_number: "", ach_routing: "", wire_routing: "", swift: "" };

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();

  const [session, setSession] = useState<any | null>(null);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [completedThrough, setCompletedThrough] = useState<number>(0);
  const [sessionReady, setSessionReady] = useState(false);

  const [step1, setStep1] = useState<OnboardingStep1Draft>(INITIAL_STEP1);
  const [step2, setStep2] = useState<OnboardingStep2Draft>(INITIAL_STEP2);
  const [step3, setStep3] = useState<OnboardingStep3Draft>(INITIAL_STEP3);
  const [step4, setStep4] = useState<OnboardingStep4Draft>(INITIAL_STEP4);

  // Local drafts live in sessionStorage; server state is only checked for VERIFIED.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<OnboardingContextValue> & { step3?: any; step4?: any; completedThrough?: number };
      if (saved.step1) setStep1((prev) => ({ ...prev, ...saved.step1 }));
      if (saved.step2) setStep2((prev) => ({ ...prev, ...saved.step2 }));
      if (saved.step3) setStep3((prev) => ({ ...prev, ...saved.step3, file: undefined }));
      if (saved.step4) setStep4((prev) => ({ ...prev, ...saved.step4 }));
      if (typeof saved.completedThrough === "number") {
        setCompletedThrough((prev) => Math.max(prev, saved.completedThrough || 0));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const sanitizedStep1 = {
        ...step1,
        formation_documents: step1.formation_documents.map((doc) => ({
          doc_type: doc.doc_type,
          file_id: doc.file_id,
        })),
      };
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step1: sanitizedStep1, step2, step3: { ...step3, file: undefined }, step4, completedThrough })
      );
    } catch {
      // ignore storage errors
    }
  }, [step1, step2, step3, step4, completedThrough]);

  const clearDraft = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Reset onboarding state when the user logs out (token disappears).
  useEffect(() => {
    if (!token) {
      setSession(null);
      setCurrentStep(1);
      setCompletedThrough(0);
      setStep1(INITIAL_STEP1);
      setStep2(INITIAL_STEP2);
      setStep3(INITIAL_STEP3);
      setStep4(INITIAL_STEP4);
      clearDraft();
    }
  }, [token, clearDraft]);

  const refreshSession = React.useCallback(async (): Promise<OnboardingStep> => {
    if (loading || !token) return 1;
    try {
      const current = await onboardingCurrent();
      setSession(current);
      const serverStep = Math.min(Math.max(Number(current.current_step || 1), 1), 5) as OnboardingStep;
      // Only override local progress if server is already verified; otherwise stay client-driven.
      if (current.state === "VERIFIED") {
        setCurrentStep(serverStep);
        setCompletedThrough((prev) => Math.max(prev, serverStep - 1));
      }
      const roleInfo = current.step_statuses?.role || {};
      if (roleInfo.role && (!step2.role || step2.role !== roleInfo.role)) {
        setStep2((prev) => ({ ...prev, role: roleInfo.role, title: roleInfo.title || "" }));
      }
      return serverStep;
    } catch {
      // If no active session, keep local progress; onboarding is client-driven until final submit.
      setSession(null);
      setCurrentStep(1);
      return 1;
    } finally {
      setSessionReady(true);
    }
  }, [loading, token]);

  useEffect(() => {
    if (loading || !token) return;
    // Only fetch once to see if onboarding is already VERIFIED; otherwise rely on local flow.
    void refreshSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  const touchStep = React.useCallback((step: OnboardingStep) => {
    setCompletedThrough((prev) => Math.max(prev, step - 1));
  }, []);

  const markStepComplete = React.useCallback((step: OnboardingStep) => {
    setCompletedThrough((prev) => Math.max(prev, step));
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      session,
      currentStep,
      completedThrough,
      sessionReady,
      refreshSession,
      touchStep,
      markStepComplete,
      clearDraft,
      step1,
      setStep1,
      step2,
      setStep2,
      step3,
      setStep3,
      step4,
      setStep4,
    }),
    [session, currentStep, completedThrough, sessionReady, step1, step2, step3, step4]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingWizard() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingWizard must be used within OnboardingProvider");
  return ctx;
}
