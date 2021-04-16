module.exports = {
  preset: 'ts-jest',
  testEnvironment: './test/test_environment.ts',
  globalSetup: './test/setup.ts',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  testTimeout: 500000,
  verbose: true,
  maxWorkers: 1,
  testRunner: 'jest-circus/runner',
};
