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

// Phases that skip ready check (first phase and last transition)
const SKIP_READY_CHECK: Set<string> = new Set(["consent", "closing_b"]);

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

  // Ready check state
  readyCheck: boolean;
  readyCheckMessage: string;
  readyCheckNextPhase: DebatePhase | null;
  readyA: boolean;
  readyB: boolean;

  setSession: (sessionId: string, pairingId: string) => void;
  setPhase: (phase: DebatePhase) => void;
  syncPhase: (phase: DebatePhase, elapsed: number) => void;
  advancePhase: () => void;
  tick: () => void;
  addTranscript: (entry: TranscriptEntry) => void;
  updateInterimTranscript: (speaker: string, text: string, phase: string) => void;
  addIntervention: (intervention: AiIntervention) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  setConsent: (student: "A" | "B", value: boolean) => void;
  setStudentRole: (role: "A" | "B") => void;
  setShowPhaseOverlay: (show: boolean) => void;

  // Time extension
  addTime: (seconds: number) => void;

  // Ready check methods
  startReadyCheck: (message: string, nextPhase: DebatePhase) => void;
  updateReadyState: (readyA: boolean, readyB: boolean) => void;
  clearReadyCheck: () => void;
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

  // Ready check state
  readyCheck: false,
  readyCheckMessage: "",
  readyCheckNextPhase: null,
  readyA: false,
  readyB: false,

  setSession: (sessionId, pairingId) => set({ sessionId, pairingId }),

  setPhase: (phase) => {
    const config = PHASE_CONFIG[phase];
    set({
      phase,
      timeRemaining: config.duration,
      isGracePeriod: false,
      showPhaseOverlay: phase !== "waiting" && phase !== "consent" && phase !== "completed",
      // Clear ready check state on phase change
      readyCheck: false,
      readyCheckMessage: "",
      readyCheckNextPhase: null,
      readyA: false,
      readyB: false,
    });
    if (phase !== "waiting" && phase !== "consent" && phase !== "completed") {
      setTimeout(() => set({ showPhaseOverlay: false }), 3000);
    }
  },

  syncPhase: (phase, elapsed) => {
    const config = PHASE_CONFIG[phase];
    const remaining = Math.max(0, config.duration - elapsed);
    set({
      phase,
      timeRemaining: remaining,
      isGracePeriod: false,
      showPhaseOverlay: false,
    });
  },

  advancePhase: () => {
    const { phase } = get();
    const config = PHASE_CONFIG[phase];
    if (config.next) {
      get().setPhase(config.next);
    }
  },

  tick: () => {
    const { timeRemaining, isGracePeriod, phase, readyCheck } = get();
    if (phase === "waiting" || phase === "consent" || phase === "completed") return;
    // Pause timer during ready check
    if (readyCheck) return;

    if (timeRemaining > 1) {
      set({ timeRemaining: timeRemaining - 1 });
    } else if (timeRemaining === 1) {
      set({ timeRemaining: 0 });
    } else if (!isGracePeriod) {
      set({ isGracePeriod: true, timeRemaining: GRACE_PERIOD });
    } else {
      // Grace period expired — trigger ready check instead of immediate advance
      const config = PHASE_CONFIG[phase];
      if (config.next && !SKIP_READY_CHECK.has(phase)) {
        // Don't advance yet; the WS handler will initiate the ready check
        // Set a flag so the debate-session component knows to send ready_check_start
        set({
          readyCheck: true,
          readyCheckNextPhase: config.next,
          readyCheckMessage: "",
          readyA: false,
          readyB: false,
        });
      } else {
        get().advancePhase();
      }
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

  // Time extension
  addTime: (seconds) => {
    const { phase, timeRemaining, isGracePeriod } = get();
    if (phase === "waiting" || phase === "consent" || phase === "completed") return;
    if (isGracePeriod) {
      // Cancel grace period and restore with the added time
      set({ timeRemaining: seconds, isGracePeriod: false });
    } else {
      set({ timeRemaining: timeRemaining + seconds });
    }
  },

  // Ready check methods
  startReadyCheck: (message, nextPhase) =>
    set({
      readyCheck: true,
      readyCheckMessage: message,
      readyCheckNextPhase: nextPhase,
      readyA: false,
      readyB: false,
    }),

  updateReadyState: (readyA, readyB) =>
    set({ readyA, readyB }),

  clearReadyCheck: () =>
    set({
      readyCheck: false,
      readyCheckMessage: "",
      readyCheckNextPhase: null,
      readyA: false,
      readyB: false,
    }),
}));
