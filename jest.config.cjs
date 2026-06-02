/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__mocks__/styleMock.cjs',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          esModuleInterop: true,
          // Tests use CommonJS so ts-jest can transform without ESM config.
          module: 'CommonJS',
          verbatimModuleSyntax: false,
          // ts-jest type-checks each test file in isolation, so the global
          // jest-dom matcher augmentation (e.g. toBeInTheDocument) must be
          // loaded explicitly here. Listing `types` requires re-declaring the
          // other ambient type packages the tests rely on.
          types: ['node', 'jest', '@testing-library/jest-dom'],
        },
      },
    ],
  },
  testMatch: ['<rootDir>/src/**/*.test.(ts|tsx)'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
