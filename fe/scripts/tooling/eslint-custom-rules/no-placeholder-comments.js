const placeholderPatterns = [
  /^\.{3}(?:\s|$)/,
  /^(?:fixme|hack|todo|xxx)\b/i,
  /\bimplementation (?:goes )?here\b/i,
  /\bplaceholder\b/i,
  /\bstub\b/i,
  /\b(?:add|insert|put) .+ here\b/i,
  /\b(?:more|remaining|rest of) (?:the )?code\b/i
];

const allowedPatterns = [
  /^!$/,
  /^@(?:copyright|deprecated|example|license|param|returns|see|ts-|type)\b/,
  /^eslint-(?:disable|enable)/
];

export default {
  meta: {
    docs: {
      description: 'Reject placeholder comments that hide incomplete work.'
    },
    fixable: 'code',
    schema: [],
    type: 'problem'
  },
  create(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();

        for (const comment of sourceCode.getAllComments()) {
          if (comment.type === 'Block' && comment.value.startsWith('*')) {
            continue;
          }

          const text = comment.value.trim();

          if (
            allowedPatterns.some((pattern) => pattern.test(text)) ||
            !placeholderPatterns.some((pattern) => pattern.test(text))
          ) {
            continue;
          }

          context.report({
            fix(fixer) {
              if (comment.range === undefined) {
                return null;
              }

              const [start, end] = comment.range;
              const fullText = sourceCode.getText();
              const lineStart = fullText.lastIndexOf('\n', start - 1) + 1;
              const nextLine = fullText.indexOf('\n', end);
              const lineEnd = nextLine === -1 ? fullText.length : nextLine + 1;
              const beforeComment = fullText.slice(lineStart, start).trim();

              return beforeComment === ''
                ? fixer.removeRange([lineStart, lineEnd])
                : fixer.replaceTextRange([start, end], ' ');
            },
            message: `Remove placeholder comment "${text}".`,
            node: comment
          });
        }
      }
    };
  }
};
