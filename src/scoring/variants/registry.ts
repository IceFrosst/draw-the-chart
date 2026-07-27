import type { ScoringVariant, ComponentName } from './types.js';

const REGISTRY = new Map<ComponentName, ScoringVariant[]>();

export function registerVariant(variant: ScoringVariant): void {
  const key = variant.component;
  if (!REGISTRY.has(key)) REGISTRY.set(key, []);
  REGISTRY.get(key)!.push(variant);
}

export function getVariantsForComponent(component: ComponentName): ScoringVariant[] {
  return REGISTRY.get(component) ?? [];
}

export function getVariantById(id: string): ScoringVariant | undefined {
  for (const variants of REGISTRY.values()) {
    const found = variants.find((v) => v.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getAllVariants(): ScoringVariant[] {
  return Array.from(REGISTRY.values()).flat();
}

export function getVariantIds(component: ComponentName): string[] {
  return getVariantsForComponent(component).map((v) => v.id);
}

// Import all variant modules to trigger registration
export function initializeRegistry(): void {
  // Dynamic imports would be cleaner but static is simpler for bundling
  // Each variant index.ts calls registerVariant on import
}
