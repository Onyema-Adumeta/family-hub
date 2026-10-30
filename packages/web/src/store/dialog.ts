import { create } from 'zustand';

/**
 * Proper form dialogs instead of window.prompt(): password fields are masked,
 * numbers get a number keyboard, and choices are buttons, not typed words.
 * <DialogHost /> is mounted once in App; call form(), ask() or choose() anywhere.
 */
export type Field = {
  name: string;
  label: string;
  type?: 'text' | 'password' | 'email' | 'number';
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** Number fields: smallest allowed value. */
  min?: number;
  /** Number fields: allow cents, e.g. 2.50. */
  decimals?: boolean;
  /** The value must equal this exactly (e.g. typing the family name to confirm a delete). */
  mustEqual?: string;
};
export type DialogOptions = {
  title: string;
  message?: string;
  fields?: Field[];
  choices?: { label: string; value: string }[];
  okLabel?: string;
  danger?: boolean;
};
type Pending = DialogOptions & { resolve: (v: Record<string, string> | null) => void };
type State = { current: Pending | null; open: (p: Pending) => void; close: (v: Record<string, string> | null) => void };

export const useDialog = create<State>((set, get) => ({
  current: null,
  open: (p) => { get().current?.resolve(null); set({ current: p }); },
  close: (v) => { const c = get().current; set({ current: null }); c?.resolve(v); },
}));

/** A form with one or more fields. Resolves to the values by field name, or null if cancelled. */
export const form = (o: DialogOptions) => new Promise<Record<string, string> | null>(resolve => useDialog.getState().open({ ...o, resolve }));

/** One field. Resolves to its value, or null if cancelled. */
export async function ask(title: string, field: Omit<Field, 'name' | 'label'> & { label?: string }, extra: Omit<DialogOptions, 'title' | 'fields'> = {}) {
  const r = await form({ title, ...extra, fields: [{ name: 'v', label: field.label || '', ...field }] });
  return r ? r.v : null;
}

/** Pick one of several buttons. Resolves to its value, or null if cancelled. */
export async function choose(title: string, choices: { label: string; value: string }[], message?: string) {
  const r = await form({ title, message, choices });
  return r ? r.choice : null;
}
