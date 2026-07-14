const defaultAllowedHooks = new Set([
  'useActionState',
  'useFieldArray',
  'useForm',
  'useInfiniteQuery',
  'useMutation',
  'useQuery',
  'useReducer',
  'useState',
  'useSuspenseInfiniteQuery',
  'useSuspenseQuery',
  'useTransition'
]);

function hookName(node) {
  if (node?.type !== 'CallExpression') {
    return null;
  }

  if (node.callee.type === 'Identifier') {
    return /^use[A-Z]/.test(node.callee.name) ? node.callee.name : null;
  }

  if (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier'
  ) {
    return /^use[A-Z]/.test(node.callee.property.name)
      ? node.callee.property.name
      : null;
  }

  return null;
}

function destructuredPattern(node) {
  if (node.type === 'ArrayPattern' || node.type === 'ObjectPattern') {
    return node;
  }

  return node.type === 'AssignmentPattern' &&
    (node.left.type === 'ArrayPattern' || node.left.type === 'ObjectPattern')
    ? node.left
    : null;
}

function expectedVariable(name) {
  const value = name.slice(3);

  return value.charAt(0).toLowerCase() + value.slice(1);
}

export default {
  meta: {
    docs: {
      description:
        'Keep custom hook return values intact instead of destructuring them.'
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          allow: {
            items: { type: 'string' },
            type: 'array',
            uniqueItems: true
          }
        },
        type: 'object'
      }
    ],
    type: 'suggestion'
  },
  create(context) {
    const allowedHooks = new Set([
      ...defaultAllowedHooks,
      ...(context.options[0]?.allow ?? [])
    ]);

    return {
      VariableDeclarator(node) {
        const name = hookName(node.init);
        const pattern = destructuredPattern(node.id);

        if (name === null || pattern === null || allowedHooks.has(name)) {
          return;
        }

        context.report({
          message: `Keep the "${name}" result intact: "const ${expectedVariable(name)} = ${name}(...)".`,
          node: pattern
        });
      }
    };
  }
};
