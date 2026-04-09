```markdown
# learn-claude-code Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches the core development patterns and conventions used in the `learn-claude-code` repository, a TypeScript codebase with no detected framework. You'll learn how to structure files, write imports/exports, and follow the project's conventions for maintainable and consistent code. Testing patterns and suggested commands for common workflows are also documented.

## Coding Conventions

### File Naming
- Use **kebab-case** for all filenames.
  - Example:  
    ```
    user-profile.ts
    utils/helpers.ts
    ```

### Import Style
- Use **relative imports** for referencing other files.
  - Example:
    ```typescript
    import { fetchData } from './utils/fetch-data';
    ```

### Export Style
- Use **named exports** for all exported functions, types, or constants.
  - Example:
    ```typescript
    // In utils/math.ts
    export function add(a: number, b: number): number {
      return a + b;
    }

    // In another file
    import { add } from './utils/math';
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict prefixes), average length ~50 characters.
  - Example:
    ```
    Add initial implementation for user authentication
    ```

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature or module  
**Command:** `/add-feature`

1. Create a new file using kebab-case (e.g., `new-feature.ts`).
2. Use relative imports to include any dependencies.
3. Export all functions/types using named exports.
4. Write or update corresponding test files (`*.test.ts`).
5. Commit with a clear, descriptive message.

### Refactoring Code
**Trigger:** When improving or restructuring existing code  
**Command:** `/refactor`

1. Identify code to refactor.
2. Update file and variable names to match kebab-case and other conventions.
3. Ensure all imports are relative and exports are named.
4. Update or add tests as needed.
5. Commit changes with a descriptive message.

### Writing Tests
**Trigger:** When adding or updating tests  
**Command:** `/write-test`

1. Create or update a test file following the `*.test.ts` pattern.
2. Write tests for all exported functions/types.
3. Use the project's preferred (unknown) testing framework.
4. Run tests to ensure correctness.
5. Commit test changes.

## Testing Patterns

- Test files use the `*.test.ts` naming pattern.
- Each exported function/type should have corresponding tests.
- The testing framework is not specified; use standard TypeScript testing practices.
- Example test file:
  ```typescript
  // math.test.ts
  import { add } from './math';

  test('adds two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
  ```

## Commands

| Command        | Purpose                                      |
|----------------|----------------------------------------------|
| /add-feature   | Scaffold and implement a new feature/module  |
| /refactor      | Refactor existing code to match conventions  |
| /write-test    | Add or update test files for code            |
```