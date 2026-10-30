import { create } from 'zustand';

/**
 * A small cross-platform replacement for window.prompt (Alert.prompt is iOS only).
 * Mount <PromptHost /> once; call ask() or choose() from anywhere.
 */
export type AskOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  numeric?: boolean;
  secure?: boolean;
  okLabel?: string;
  /** If given, shows these as buttons instead of a text box. */
  choices?: { label: string; value: string }[];
};

type Pending = AskOptions & { resolve: (v: string | null) => void };
type State = { current: Pending | null; open: (p: Pending) => void; close: (v: string | null) => void };

export const usePromptStore = create<State>((set, get) => ({
  current: null,
  open: (p) => {
    get().current?.resolve(null);
    set({ current: p });
  },
  close: (v) => {
    const c = get().current;
    set({ current: null });
    c?.resolve(v);
  },
}));

/** Ask for a line of text. Resolves to null if cancelled. */
export const ask = (o: AskOptions) => new Promise<string | null>(resolve => usePromptStore.getState().open({ ...o, resolve }));

/** Ask the person to pick one option. Resolves to the value, or null if cancelled. */
export const choose = (title: string, choices: { label: string; value: string }[], message?: string) =>
  ask({ title, message, choices });
