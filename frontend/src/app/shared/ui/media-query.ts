import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Signal que refleja una media query (p. ej. '(min-width: 1024px)'). Debe llamarse en contexto de inyección. */
export function mediaQuery(query: string, fallback = true): Signal<boolean> {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return signal(fallback).asReadonly();
  }
  const media = window.matchMedia(query);
  const matches = signal(media.matches);
  const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
  media.addEventListener('change', listener);
  inject(DestroyRef).onDestroy(() => media.removeEventListener('change', listener));
  return matches.asReadonly();
}
