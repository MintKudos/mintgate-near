module.exports = {
  preset: 'ts-jest',
  testEnvironment: './test/test_environment.ts',
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  testTimeout: 500000,
  verbose: true,
};
