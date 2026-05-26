/**
 * Benchmark Task Definitions
 *
 * Each task is a self-contained test case that ALL frameworks must implement.
 * The same description is given to each framework's prompt template.
 */
import type { BenchmarkTask } from '../types/index.js';

export const tasks: BenchmarkTask[] = [
  {
    id: 'login_register_01',
    title: 'Login & Registration Page',
    description:
      'Build a login/registration page with two tabs (Login / Register), form validation, and API fetch simulation.',
    requirements: [
      'Two-tab interface: Login tab and Register tab',
      'Login form: email + password fields, "Login" button, "Forgot password?" link',
      'Register form: username + email + password + confirm-password fields, "Register" button',
      'Form validation: required fields, email format, password min length (8), password match',
      'Simulated API call on submit: show loading state, then success/error toast',
      'Toggle between Login and Register tabs without page reload',
      'Responsive layout: centered card on desktop, full-width on mobile',
    ],
    acceptanceCriteria: [
      'Page renders without console errors',
      'Both tabs are visible and switchable',
      'Login form has email and password inputs',
      'Register form has username, email, password, confirm-password inputs',
      'Validation shows error messages for invalid input',
      'Submit button triggers loading state',
      'Success/error feedback appears after simulated API call',
    ],
    editPrompt:
      'Change the layout: move the tab switcher from top of the card to a sidebar on the left side. Keep all form functionality identical.',
    complexity: 'medium',
    tags: ['form', 'validation', 'tabs', 'auth', 'api-fetch'],
  },
];

export function getTaskById(id: string): BenchmarkTask | undefined {
  return tasks.find((t) => t.id === id);
}

export function getTasksByComplexity(complexity: BenchmarkTask['complexity']): BenchmarkTask[] {
  return tasks.filter((t) => t.complexity === complexity);
}
