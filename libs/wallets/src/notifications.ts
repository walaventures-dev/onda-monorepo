import type { PassField, PassSpec } from './types';

/**
 * Anchor de notificaciones custom (docs WalletWallet → "Send a notification").
 * Vive en backFields; el orden del array debe permanecer estable entre POST y PUT.
 */
export const NOTIFICATION_ANCHOR_LABEL = 'Notificaciones';
export const NOTIFICATION_SEED_VALUE = ' ';
export const NOTIFICATION_CHANGE_MESSAGE = '%@';

export function createNotificationAnchor(
  value: string = NOTIFICATION_SEED_VALUE
): PassField {
  return {
    label: NOTIFICATION_ANCHOR_LABEL,
    value,
    changeMessage: NOTIFICATION_CHANGE_MESSAGE,
  };
}

/** Asegura que el anchor exista y quede al final de backFields. */
export function ensureNotificationAnchor(spec: PassSpec): PassSpec {
  const back = [...(spec.backFields ?? [])];
  const idx = back.findIndex((f) => f.label === NOTIFICATION_ANCHOR_LABEL);
  if (idx === -1) {
    back.push(createNotificationAnchor());
  } else {
    const existing = back[idx]!;
    back[idx] = {
      ...existing,
      changeMessage: existing.changeMessage ?? NOTIFICATION_CHANGE_MESSAGE,
      value: existing.value || NOTIFICATION_SEED_VALUE,
    };
  }
  return { ...spec, backFields: back };
}

/**
 * Bump del anchor para disparar banner en lock-screen.
 * El valor debe cambiar respecto a la versión anterior (mismo texto = no-op).
 */
export function withNotificationMessage(spec: PassSpec, message: string): PassSpec {
  const seeded = ensureNotificationAnchor(spec);
  const back = [...(seeded.backFields ?? [])];
  const idx = back.findIndex((f) => f.label === NOTIFICATION_ANCHOR_LABEL);
  if (idx === -1) {
    back.push(createNotificationAnchor(message));
  } else {
    back[idx] = createNotificationAnchor(message);
  }
  return { ...seeded, backFields: back };
}

/** Actualiza value (+ changeMessage opcional) del primer field que matchee label. */
export function patchFieldValue(
  fields: PassField[] | undefined,
  label: string,
  value: string,
  changeMessage?: string
): PassField[] {
  const list = [...(fields ?? [])];
  const idx = list.findIndex((f) => f.label === label);
  if (idx === -1) {
    list.push({ label, value, ...(changeMessage ? { changeMessage } : {}) });
    return list;
  }
  list[idx] = {
    ...list[idx]!,
    value,
    ...(changeMessage !== undefined ? { changeMessage } : {}),
  };
  return list;
}
