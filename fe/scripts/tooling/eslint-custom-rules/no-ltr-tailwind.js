const physicalToLogical = {
  'border-l': 'border-s',
  'border-r': 'border-e',
  'clear-left': 'clear-start',
  'clear-right': 'clear-end',
  'float-left': 'float-start',
  'float-right': 'float-end',
  ml: 'ms',
  mr: 'me',
  pl: 'ps',
  pr: 'pe',
  'rounded-bl': 'rounded-es',
  'rounded-br': 'rounded-ee',
  'rounded-l': 'rounded-s',
  'rounded-r': 'rounded-e',
  'rounded-tl': 'rounded-ss',
  'rounded-tr': 'rounded-se',
  'scroll-ml': 'scroll-ms',
  'scroll-mr': 'scroll-me',
  'scroll-pl': 'scroll-ps',
  'scroll-pr': 'scroll-pe',
  'text-left': null,
  'text-right': 'text-end'
};
const physicalNames = Object.keys(physicalToLogical).sort(
  (left, right) => right.length - left.length
);
const physicalPattern = new RegExp(
  `(?:^|\\s|:)(${physicalNames
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})(?=-|\\s|$)`,
  'g'
);
const textStartPattern = /(?:^|\s|:)text-start(?=-|\s|$)/;
const classFunctions = new Set(['clsx', 'cn', 'cva', 'twJoin', 'twMerge']);

function isClassContext(node) {
  let current = node.parent;

  while (current != null) {
    if (
      current.type === 'JSXAttribute' &&
      (current.name.name === 'class' || current.name.name === 'className')
    ) {
      return true;
    }

    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      classFunctions.has(current.callee.name)
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkValue(context, node, value) {
  if (textStartPattern.test(value)) {
    context.report({
      message:
        'Remove "text-start"; text alignment inherits the document direction.',
      node
    });
  }

  physicalPattern.lastIndex = 0;
  const reported = new Set();
  let match;

  while ((match = physicalPattern.exec(value)) !== null) {
    const physical = match[1];

    if (reported.has(physical)) {
      continue;
    }

    reported.add(physical);
    const logical = physicalToLogical[physical];

    context.report({
      fix(fixer) {
        if (node.type !== 'Literal' || logical === null) {
          return null;
        }

        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const raw = sourceCode.getText(node);
        const token = new RegExp(
          `(^|[\\s:])${escaped(physical)}(?=-|\\s|["'\`]|$)`,
          'g'
        );

        return fixer.replaceText(
          node,
          raw.replace(token, (_, prefix) => `${prefix}${logical}`)
        );
      },
      message:
        logical === null
          ? 'Remove physical "text-left" to inherit RTL start alignment, or use "text-end" when end alignment is intentional.'
          : `Use logical "${logical}" instead of physical "${physical}" for RTL.`,
      node
    });
  }
}

export default {
  meta: {
    docs: {
      description:
        'Require logical Tailwind direction utilities in the Arabic RTL interface.'
    },
    fixable: 'code',
    schema: [],
    type: 'problem'
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value === 'string' && isClassContext(node)) {
          checkValue(context, node, node.value);
        }
      },
      TemplateLiteral(node) {
        if (!isClassContext(node)) {
          return;
        }

        for (const quasi of node.quasis) {
          checkValue(context, quasi, quasi.value.raw);
        }
      }
    };
  }
};
