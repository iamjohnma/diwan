const componentWrappers = new Set(['forwardRef', 'memo']);

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function isComponentWrapper(node) {
  if (node == null || node.type !== 'CallExpression') {
    return false;
  }

  if (node.callee.type === 'Identifier') {
    return componentWrappers.has(node.callee.name);
  }

  return (
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    componentWrappers.has(node.callee.property.name)
  );
}

function functionName(node) {
  if (node.type === 'FunctionDeclaration' && node.id !== null) {
    return node.id.name;
  }

  let current = node;

  while (current.parent != null && isComponentWrapper(current.parent)) {
    current = current.parent;
  }

  const parent = current.parent;

  return parent?.type === 'VariableDeclarator' &&
    parent.id.type === 'Identifier'
    ? parent.id.name
    : null;
}

function objectPattern(parameter) {
  if (parameter?.type === 'ObjectPattern') {
    return parameter;
  }

  return parameter?.type === 'AssignmentPattern' &&
    parameter.left.type === 'ObjectPattern'
    ? parameter.left
    : null;
}

function checkFunction(context, node) {
  const name = functionName(node);
  const pattern = objectPattern(node.params[0]);

  if (name === null || !isPascalCase(name) || pattern === null) {
    return;
  }

  context.report({
    message: `Component "${name}" must receive one props object. Use "props: ${name}Props" and read "props.value" inside the component.`,
    node: pattern
  });
}

export default {
  meta: {
    docs: {
      description:
        'Disallow destructuring React component props in function signatures.'
    },
    schema: [],
    type: 'suggestion'
  },
  create(context) {
    return {
      ArrowFunctionExpression(node) {
        checkFunction(context, node);
      },
      FunctionDeclaration(node) {
        checkFunction(context, node);
      },
      FunctionExpression(node) {
        checkFunction(context, node);
      }
    };
  }
};
