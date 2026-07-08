import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'functions/lib/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
