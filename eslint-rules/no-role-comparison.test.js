import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import rule from './no-role-comparison.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-role-comparison', rule, {
  valid: [
    "can('property.read')",
    'const label = membership.role',
    'role === otherVariable',
    "membership.status === 'active'",
  ],
  invalid: [
    { code: "membership.role === 'broker'", errors: [{ messageId: 'noRole' }] },
    { code: 'user.role !== "admin"', errors: [{ messageId: 'noRole' }] },
    { code: "role == 'agent'", errors: [{ messageId: 'noRole' }] },
    { code: "'agent' === membership.role", errors: [{ messageId: 'noRole' }] },
  ],
});
