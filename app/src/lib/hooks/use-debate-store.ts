import { create } from "zustand";

export interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: number;
  phase: string;
  isFinal: boolean;
}

export interface AiIntervention {
  timestamp: number;
  type: string;
  message: string;
  targetStudent: string;
}

export type DebatePhase =
  | "waiting"
  | "consent"
  | "opening_a"
  | "opening_b"
  | "crossexam_a"
  | "crossexam_b"
  | "rebuttal_a"
  | "rebuttal_b"
  | "closing_a"
  | "closing_b"
  | "completed";

export const PHASE_CONFIG: Record<
  DebatePhase,
  { label: string; duration: number; next: DebatePhase | null }
> = {
  waiting: { label: "Waiting", duration: 0, next: "consent" },
  consent: { label: "Consent", duration: 0, next: "opening_a" },
  opening_a: { label: "Opening — Student A", duration: 120, next: "opening_b" },
  opening_b: { label: "Opening — Student B", duration: 120, next: "crossexam_a" },
  crossexam_a: { label: "Cross-Examination — A asks B", duration: 180, next: "crossexam_b" },
  crossexam_b: { label: "Cross-Examination — B asks A", duration: 180, next: "rebuttal_a" },
  rebuttal_a: { label: "Rebuttal — Student A", duration: 60, next: "rebuttal_b" },
  rebuttal_b: { label: "Rebuttal — Student B", duration: 60, next: "closing_a" },
  closing_a: { label: "Closing — Student A", duration: 30, next: "closing_b" },
  closing_b: { label: "Closing — Student B", duration: 30, next: "completed" },
  completed: { label: "Debate Complete", duration: 0, next: null },
};

const GRACE_PERIOD = 10; // seconds

interface DebateStore {
  sessionId: string | null;
  pairingId: string | null;
  phase: DebatePhase;
  timeRemaining: number;
  isGracePeriod: boolean;
  transcript: TranscriptEntry[];
  interventions: AiIntervention[];
  connectionStatus: "disconnected" | "connecting" | "connected";
  consentA: boolean;
  consentB: boolean;
  studentRole: "A" | "B" | null;
  showPhaseOverlay: boolean;

  setSession: (sessionId: string, pairingId: string) => void;
  setPhase: (phase: DebatePhase) => void;
  advancePhase: () => void;
  tick: () => void;
  addTranscript: (entry: TranscriptEntry) => void;
  updateInterimTranscript: (speaker: string, text: string, phase: string) => void;
  addIntervention: (intervention: AiIntervention) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  setConsent: (student: "A" | "B", value: boolean) => void;
  setStudentRole: (role: "A" | "B") => void;
  setShowPhaseOverlay: (show: boolean) => void;
}

export const useDebateStore = create<DebateStore>((set, get) => ({
  sessionId: null,
  pairingId: null,
  phase: "waiting",
  timeRemaining: 0,
  isGracePeriod: false,
  transcript: [],
  interventions: [],
  connectionStatus: "disconnected",
  consentA: false,
  consentB: false,
  studentRole: null,
  showPhaseOverlay: false,

  setSession: (sessionId, pairingId) => set({ sessionId, pairingId }),

  setPhase: (phase) => {
    const config = PHASE_CONFIG[phase];
    set({
      phase,
      timeRemaining: config.duration,
      isGracePeriod: false,
      showPhaseOverlay: phase !== "waiting" && phase !== "consent" && phase !== "completed",
    });
    // Auto-hide overlay after 3 seconds
    if (phase !== "waiting" && phase !== "consent" && phase !== "completed") {
      setTimeout(() => set({ showPhaseOverlay: false }), 3000);
    }
  },

  advancePhase: () => {
    const { phase } = get();
    const config = PHASE_CONFIG[phase];
    if (config.next) {
      get().setPhase(config.next);
    }
  },

  tick: () => {
    const { timeRemaining, isGracePeriod, phase } = get();
    if (phase === "waiting" || phase === "consent" || phase === "completed") return;

    if (timeRemaining > 0) {
      set({ timeRemaining: timeRemaining - 1 });
    } else if (!isGracePeriod) {
      set({ isGracePeriod: true, timeRemaining: GRACE_PERIOD });
    } else if (timeRemaining <= 0) {
      // Grace period expired, advance
      get().advancePhase();
    }
  },

  addTranscript: (entry) =>
    set((state) => ({
      transcript: [...state.transcript.filter((t) => t.isFinal || t.speaker !== entry.speaker), entry],
    })),

  updateInterimTranscript: (speaker, text, phase) =>
    set((state) => {
      const filtered = state.transcript.filter(
        (t) => t.isFinal || t.speaker !== speaker
      );
      return {
        transcript: [
          ...filtered,
          { speaker, text, timestamp: Date.now(), phase, isFinal: false },
        ],
      };
    }),

  addIntervention: (intervention) =>
    set((state) => ({
      interventions: [...state.interventions, intervention],
    })),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setConsent: (student, value) =>
    set(student === "A" ? { consentA: value } : { consentB: value }),

  setStudentRole: (role) => set({ studentRole: role }),

  setShowPhaseOverlay: (show) => set({ showPhaseOverlay: show }),
}));
