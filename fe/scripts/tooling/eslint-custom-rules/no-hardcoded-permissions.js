const permissionFunctions = new Set([
  'hasAllPermissions',
  'hasAnyPermission',
  'hasPermission'
]);

function isPermissionCall(node) {
  if (node.callee.type === 'Identifier') {
    return permissionFunctions.has(node.callee.name);
  }

  return (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    permissionFunctions.has(node.callee.property.name)
  );
}

function checkArgument(context, argument) {
  if (argument.type === 'Literal' && typeof argument.value === 'string') {
    context.report({
      message: `Use a PERMISSIONS constant from "@diwan/shared" instead of "${argument.value}".`,
      node: argument
    });

    return;
  }

  if (argument.type === 'TemplateLiteral') {
    context.report({
      message:
        'Use a PERMISSIONS constant from "@diwan/shared" instead of a template literal.',
      node: argument
    });

    return;
  }

  if (argument.type === 'ArrayExpression') {
    for (const element of argument.elements) {
      if (element !== null) {
        checkArgument(context, element);
      }
    }
  }
}

export default {
  meta: {
    docs: {
      description: 'Require typed shared constants for permission checks.'
    },
    schema: [],
    type: 'problem'
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isPermissionCall(node)) {
          return;
        }

        for (const argument of node.arguments) {
          if (argument.type !== 'SpreadElement') {
            checkArgument(context, argument);
          }
        }
      }
    };
  }
};
