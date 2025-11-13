/* eslint-env node */
import eslint from '@eslint/js';
import pluginTsEslint from 'typescript-eslint';
import pluginStylistic from '@stylistic/eslint-plugin';
import pluginImport from 'eslint-plugin-import';
import pluginMocha from 'eslint-plugin-mocha';
import pluginPreferArrow from 'eslint-plugin-prefer-arrow';
import pluginTinymce from '@tinymce/eslint-plugin';

export default [
  // Global ignores
  {
    // IMPORTANT - DO NOT ADD OTHER PROPERTIES HERE OR THIS WILL NOT BE A GLOBAL IGNORES LIST
    ignores: [
      'dist',
      'rollup.config.ts',
      // eslint includes these by default, we only want typescript
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },
  // Files to be scanned
  {
    files: [ 'src/**/*.ts' ]
  },
  // Rules to apply after this point...
  eslint.configs.recommended,
  ...pluginTsEslint.configs.recommendedTypeChecked,
  // This defines the overall org-wide settings that
  // we'd probably want for the TinyMCE Eslint plugin
  // when we update it to support the Eslint v9.
  {
    plugins: {
      '@stylistic': pluginStylistic,
      'import': pluginImport,
      'mocha': pluginMocha,
      'prefer-arrow': pluginPreferArrow,
      '@tinymce': pluginTinymce,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@stylistic/brace-style': 'error',
      '@stylistic/comma-spacing': 'error',
      '@stylistic/function-call-spacing': 'error',
      '@stylistic/indent': [ 'error', 2, {
        FunctionDeclaration: { parameters: 'first' },
        FunctionExpression: { parameters: 'first' },
        SwitchCase: 1
      }],
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/member-delimiter-style': [ 'error', {
        multiline: { delimiter: 'semi', requireLast: true },
        singleline: { delimiter: 'semi', requireLast: false }
      }],
      '@stylistic/object-curly-spacing': [ 'error', 'always', { objectsInObjects: false }],
      '@stylistic/quotes': [ 'error', 'single', { allowTemplateLiterals: 'always' }],
      '@stylistic/semi': [ 'error', 'always' ],
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-before-function-paren': [ 'error', { anonymous: 'always', named: 'never' }],
      '@stylistic/space-infix-ops': 'error',
      '@stylistic/type-annotation-spacing': 'error',

      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/consistent-type-definitions': 'error',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': [ 'error', { accessibility: 'explicit' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeLike',
          format: [ 'PascalCase' ]
        }
      ],
      'import/no-duplicates': 'error',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-for-in-array': 'error',
      '@typescript-eslint/no-implied-eval': 'error',
      '@typescript-eslint/no-inferrable-types': [ 'error', { ignoreParameters: true, ignoreProperties: true }],
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/parameter-properties': 'error',
      '@typescript-eslint/no-shadow': [ 'error', { hoist: 'all' }],
      '@typescript-eslint/no-unused-vars': [ 'warn', {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: true,
        argsIgnorePattern: '^_'
      }],
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/unified-signatures': 'error',

      // TODO: Enable once we no longer support IE 11
      '@typescript-eslint/prefer-includes': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',

      // TODO: Investigate if these rules should be enabled
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'off', // Needs StrictNullChecks
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // to be investigated, produces different results on a uncompiled environment
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off', // Needs StrictNullChecks

      'array-bracket-spacing': [ 'error', 'always', { objectsInArrays: false, arraysInArrays: false }],
      'arrow-body-style': 'error',
      'arrow-parens': [ 'error', 'always' ],
      'arrow-spacing': 'error',
      'comma-dangle': 'off',
      'complexity': 'off',
      'computed-property-spacing': 'error',
      'constructor-super': 'error',
      'curly': 'error',
      'dot-location': [ 'error', 'property' ],
      'dot-notation': 'error',
      'eol-last': 'off',
      'eqeqeq': [ 'error', 'smart' ],
      'guard-for-in': 'error',
      'id-blacklist': 'error',
      'id-match': 'error',
      'import/order': 'off',
      'key-spacing': [ 'error', { beforeColon: false, afterColon: true, mode: 'strict' }],
      'max-classes-per-file': [ 'error', 1 ],
      'max-len': [ 'warn', 160 ],
      'mocha/no-exclusive-tests': 'error',
      'mocha/no-identical-title': 'error',
      'new-parens': 'error',
      'no-bitwise': 'error',
      'no-caller': 'error',
      'no-cond-assign': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'no-empty': 'error',
      'no-eval': 'error',
      'no-fallthrough': 'error',
      'no-invalid-this': 'off',
      'no-multi-spaces': [ 'error', { ignoreEOLComments: true }],
      'no-multiple-empty-lines': [ 'error', { max: 1 }],
      'no-nested-ternary': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-trailing-spaces': 'error',
      'no-undef-init': 'error',
      'no-underscore-dangle': 'error',
      'no-unsafe-finally': 'error',
      'no-unused-expressions': [ 'error', { allowTernary: true }],
      'no-unused-labels': 'error',
      'no-whitespace-before-property': 'error',
      'object-shorthand': 'error',
      'one-var': [ 'error', 'never' ],
      'prefer-arrow-callback': 'off', // Covered by prefer-arrow-functions
      'prefer-arrow/prefer-arrow-functions': 'error',
      'quote-props': [ 'error', 'consistent-as-needed' ],
      'radix': 'error',
      'rest-spread-spacing': 'error',
      'semi-spacing': 'error',
      'spaced-comment': 'error',
      'space-unary-ops': 'error',
      'switch-colon-spacing': 'error',
      'template-curly-spacing': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'off',  // Disabled as it's handled by TypeScript

      // Disabled since we're using the equivalent typescript-eslint rule
      'no-shadow': 'off',

      '@tinymce/no-direct-editor-events': 'off',
      '@tinymce/no-direct-editor-options': 'off',
      '@tinymce/no-direct-imports': 'error',
      '@tinymce/no-enums-in-export-specifier': 'error',
      '@tinymce/no-main-module-imports': 'error',
      '@tinymce/no-path-alias-imports': 'error',
      '@tinymce/no-publicapi-module-imports': 'error',
      '@tinymce/no-unimported-promise': 'off',
      // '@tinymce/no-implicit-dom-globals': 'error', // "TypeError: context.getScope is not a function"
      // '@tinymce/prefer-fun': 'error', // "TypeError: context.getScope is not a function"
      '@tinymce/prefer-mcagar-tiny-assertions': 'off',
      '@tinymce/prefer-mcagar-tiny-dom': 'off',
    }
  },
  // These are overrides for the org-wide rules that we'd want for this repo.
  {
    rules: {
      "arrow-body-style": "off",
      "import/order": "error",
    }
  }
];
