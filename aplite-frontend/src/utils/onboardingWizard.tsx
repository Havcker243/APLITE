/**
 * Onboarding wizard context and draft persistence.
 * Stores per-step form state in sessionStorage and syncs with server status.
 */

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onboardingCurrent } from "./api";
import { useAuth } from "./auth";

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

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

export type OnboardingStep3Draft = { full_name: string; title: string; phone: string; file?: File; file_id?: string; attestation: boolean };

export type OnboardingStep4Draft = { bank_name: string; account_number: string; ach_routing: string; wire_routing: string; swift: string };

// Session-only persistence; drafts are not synced to server until final submit.
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
const INITIAL_STEP3: OnboardingStep3Draft = { full_name: "", title: "", phone: "", file: undefined, file_id: undefined, attestation: false };
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
      // Avoid storing File objects; only keep file ids for uploaded docs.
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
      // Server tracks steps 1-5; step 6 is client-only call scheduling.
      const serverStep = Math.min(Math.max(Number(current.current_step || 1), 1), 5) as OnboardingStep;
      setCurrentStep(serverStep);

      const stepStatuses = current.step_statuses || {};
      const completedSteps = Array.isArray(stepStatuses.completed_steps) ? stepStatuses.completed_steps : [];
      const completedMax = completedSteps.length ? Math.max(...completedSteps) : Math.max(serverStep - 1, 0);
      setCompletedThrough((prev) => Math.max(prev, completedMax));

      const industries = new Set(["Software", "Fintech", "E-commerce", "Marketplace", "Other"]);
      const step1Draft = stepStatuses.step1 || null;
      const org = current.org || {};
      if (step1Draft || org) {
        const address = step1Draft?.address || org.address || {};
        const industryValue = step1Draft?.industry || org.industry || "";
        const isKnownIndustry = industries.has(industryValue);
        setStep1((prev) => ({
          ...prev,
          legal_name: step1Draft?.legal_name ?? org.legal_name ?? prev.legal_name,
          dba: step1Draft?.dba ?? org.dba ?? prev.dba,
          ein: step1Draft?.ein ?? org.ein ?? prev.ein,
          formation_date: step1Draft?.formation_date ?? org.formation_date ?? prev.formation_date,
          formation_state: step1Draft?.formation_state ?? org.formation_state ?? prev.formation_state,
          entity_type: step1Draft?.entity_type ?? org.entity_type ?? prev.entity_type,
          formation_documents: (step1Draft?.formation_documents || prev.formation_documents || []).map((doc: any) => ({
            doc_type: doc.doc_type,
            file_id: doc.file_id,
          })),
          street1: address.street1 ?? prev.street1,
          street2: address.street2 ?? prev.street2,
          city: address.city ?? prev.city,
          state: address.state ?? prev.state,
          zip: address.zip ?? prev.zip,
          country: address.country ?? prev.country,
          industry: isKnownIndustry ? industryValue : "Other",
          industry_other: isKnownIndustry ? prev.industry_other : industryValue,
          website: step1Draft?.website ?? org.website ?? prev.website,
          description: step1Draft?.description ?? org.description ?? prev.description,
        }));
      }

      const step2Draft = stepStatuses.step2 || stepStatuses.role || {};
      if (step2Draft.role || step2Draft.title) {
        setStep2((prev) => ({ ...prev, role: step2Draft.role || prev.role, title: step2Draft.title || prev.title }));
      }

      const step3Draft = stepStatuses.step3 || {};
      if (Object.keys(step3Draft).length) {
        setStep3((prev) => ({
          ...prev,
          full_name: step3Draft.full_name ?? prev.full_name,
          title: step3Draft.title ?? prev.title,
          phone: step3Draft.phone ?? prev.phone,
          file_id: step3Draft.id_document_id ?? prev.file_id,
          attestation: Boolean(step3Draft.attestation ?? prev.attestation),
          file: undefined,
        }));
      }

      const step4Draft = stepStatuses.step4 || {};
      if (Object.keys(step4Draft).length) {
        setStep4((prev) => ({
          ...prev,
          bank_name: step4Draft.bank_name ?? prev.bank_name,
          account_number: step4Draft.account_number ?? prev.account_number,
          ach_routing: step4Draft.ach_routing ?? prev.ach_routing,
          wire_routing: step4Draft.wire_routing ?? prev.wire_routing,
          swift: step4Draft.swift ?? prev.swift,
        }));
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
