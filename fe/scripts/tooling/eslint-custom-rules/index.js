import hookVariableNaming from './hook-variable-naming.js';
import noDefaultExport from './no-default-export.js';
import noDestructuredHookReturn from './no-destructured-hook-return.js';
import noDestructuredProps from './no-destructured-props.js';
import noHardcodedPermissions from './no-hardcoded-permissions.js';
import noLtrTailwind from './no-ltr-tailwind.js';
import noPlaceholderComments from './no-placeholder-comments.js';

export const rules = {
  'hook-variable-naming': hookVariableNaming,
  'no-default-export': noDefaultExport,
  'no-destructured-hook-return': noDestructuredHookReturn,
  'no-destructured-props': noDestructuredProps,
  'no-hardcoded-permissions': noHardcodedPermissions,
  'no-ltr-tailwind': noLtrTailwind,
  'no-placeholder-comments': noPlaceholderComments
};
