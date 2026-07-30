// 루트 ESLint flat config. 각 앱(apps/server, apps/mobile)은 프레임워크 CLI가 생성한
// 자체 설정을 사용하며, 이 파일은 packages/shared 등 앱에 속하지 않는 코드에 적용된다.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      'ai/dataset/**',
      'ai/export/**',
      'apps/mobile/**',
      'apps/server/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
);
