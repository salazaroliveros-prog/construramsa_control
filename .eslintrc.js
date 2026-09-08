module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  globals: {
    // Variables globales específicas del proyecto
    CR_CONFIG: 'readonly',
    CR_Export: 'readonly',
    CR_TYPES: 'readonly',
    XLSX: 'readonly',
    ExcelJS: 'readonly',
    html2pdf: 'readonly',
    DOMPurify: 'readonly',
  },
  rules: {
    // Reglas de calidad de código (solo errores críticos)
    'no-console': 'off', // Permitir console para debugging
    'no-unused-vars': 'off', // Desactivado para código existente
    'no-undef': 'error', // Error crítico
    'no-var': 'off', // Desactivado para código existente
    'prefer-const': 'off', // Desactivado para código existente
    'prefer-arrow-callback': 'off', // Desactivado para compatibilidad
    'prefer-template': 'off', // Desactivado para código existente

    // Reglas de estilo (desactivadas para código existente)
    indent: 'off',
    quotes: 'off',
    semi: 'off',
    'comma-dangle': 'off',
    'object-curly-spacing': 'off',
    'array-bracket-spacing': 'off',

    // Reglas de mejores prácticas (solo errores críticos)
    eqeqeq: 'off', // Desactivado para código existente
    'no-eval': 'error', // Error crítico de seguridad
    'no-implied-eval': 'error', // Error crítico de seguridad
    'no-with': 'error', // Error crítico
    'no-new-func': 'warn', // Advertencia para Function constructor
    'no-return-await': 'off',
    'require-await': 'off',

    // Reglas de seguridad
    'no-script-url': 'error', // Error crítico de seguridad
    'no-inline-comments': 'off',

    // Reglas específicas para HTML inline
    'no-irregular-whitespace': [
      'error',
      {
        skipStrings: true,
        skipComments: true,
        skipRegExps: true,
        skipTemplates: true,
      },
    ],

    // Reglas adicionales para calidad
    'no-empty': 'warn', // Advertencia para bloques vacíos
    'no-constant-condition': 'warn', // Advertencia para condiciones constantes
    'no-case-declarations': 'off', // Desactivado para código existente
  },
  overrides: [
    {
      // Configuración específica para archivos de test
      files: [
        'test_*.js',
        '*.test.js',
        'e2e_*.js',
        'populate_test_data.js',
        'run_e2e_validation.js',
      ],
      env: {
        node: true,
        jest: false,
      },
      rules: {
        'no-console': 'off',
        'no-undef': 'off', // Permitir variables globales en tests
        'no-new-func': 'off', // Permitir Function constructor en tests
      },
    },
    {
      // Configuración específica para archivos src/
      files: ['src/**/*.js'],
      rules: {
        'no-console': 'off', // Permitir console en src
        'no-undef': 'off', // Permitir variables globales del navegador
      },
    },
    {
      // Configuración específica para scripts de utilidad
      files: [
        'check_inline.js',
        'comprehensive_audit.js',
        'verify_all_modules.js',
        'validador_datos_reales.js',
      ],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off',
        'no-undef': 'off', // Permitir variables globales
        'no-new-func': 'off', // Permitir Function constructor
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'vendor/', 'dist/', 'build/', '*.min.js', 'coverage/'],
};
