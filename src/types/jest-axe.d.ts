/**
 * Minimal ambient type declarations for `jest-axe`.
 *
 * The published `jest-axe` package does not ship its own type definitions and
 * `@types/jest-axe` is not installed, so this declares the small surface the
 * accessibility tests use: the `axe` runner and the `toHaveNoViolations`
 * matcher (registered via `expect.extend`).
 */
declare module 'jest-axe' {
  // The axe result shape is opaque to our tests; they only pass it to the
  // matcher, so `unknown` is sufficient here.
  export type AxeResults = unknown;

  /** Runs axe-core against a container/HTML and resolves with the results. */
  export function axe(
    html: Element | string,
    options?: Record<string, unknown>,
  ): Promise<AxeResults>;

  /** Jest matcher extension that asserts there are no accessibility violations. */
  export const toHaveNoViolations: {
    toHaveNoViolations(received: AxeResults): {
      pass: boolean;
      message(): string;
    };
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // Matches the @types/jest signature `Matchers<R, T = {}>` so the
    // augmentation merges with the existing interface.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
    interface Matchers<R, T = {}> {
      toHaveNoViolations(): R;
    }
  }
}

export {};
