// Vorlesen für Kinder, die noch nicht gut lesen können (Sprachausgabe des iPads, geht ohne Netz).
const KEY = 'mint2go3d-vorlesen';

export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Automatisch vorlesen? (Standard: ja; wird je Gerät gemerkt) */
export function autoSpeak(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'aus';
  } catch {
    return true;
  }
}

export function setAutoSpeak(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'an' : 'aus');
  } catch {
    /* egal */
  }
  if (!on) stopSpeaking();
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** Text auf Deutsch vorlesen (ein laufender Text wird unterbrochen). Emojis und ✓ werden nicht mitgesprochen. */
export function speak(text: string): void {
  if (!canSpeak()) return;
  const clean = text
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/✓/g, 'Haken')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'de-DE';
  u.rate = 0.9;
  u.pitch = 1.05;
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de'));
  if (voice) u.voice = voice;
  synth.speak(u);
}
