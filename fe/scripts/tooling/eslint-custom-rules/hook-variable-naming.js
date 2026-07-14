const defaultIgnoredHooks = new Set([
  'useActionState',
  'useCallback',
  'useContext',
  'useController',
  'useDebugValue',
  'useDeferredValue',
  'useEffect',
  'useFieldArray',
  'useForm',
  'useFormContext',
  'useId',
  'useImperativeHandle',
  'useInfiniteQuery',
  'useInsertionEffect',
  'useLayoutEffect',
  'useMemo',
  'useMutation',
  'useQuery',
  'useReducer',
  'useRef',
  'useState',
  'useSuspenseInfiniteQuery',
  'useSuspenseQuery',
  'useSyncExternalStore',
  'useTransition',
  'useWatch'
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

function expectedVariable(name) {
  const value = name.slice(3);

  return value.charAt(0).toLowerCase() + value.slice(1);
}

export default {
  meta: {
    docs: {
      description:
        'Name intact custom-hook results after the hook without its use prefix.'
    },
    schema: [
      {
        additionalProperties: false,
        properties: {
          ignore: {
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
    const ignoredHooks = new Set([
      ...defaultIgnoredHooks,
      ...(context.options[0]?.ignore ?? [])
    ]);

    return {
      VariableDeclarator(node) {
        if (
          node.id.type !== 'Identifier' ||
          node.init?.type !== 'CallExpression'
        ) {
          return;
        }

        const name = hookName(node.init);

        if (
          name === null ||
          ignoredHooks.has(name) ||
          name.endsWith('Store') ||
          node.init.arguments.length > 0
        ) {
          return;
        }

        const expected = expectedVariable(name);

        if (node.id.name !== expected) {
          context.report({
            message: `Name this result "${expected}" to match "${name}".`,
            node: node.id
          });
        }
      }
    };
  }
};
