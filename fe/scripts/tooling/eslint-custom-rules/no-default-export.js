export default {
  meta: {
    docs: {
      description:
        'Require named exports so module references remain searchable.'
    },
    messages: {
      forbidden:
        'Use a named export. Default exports are reserved for tool-required configuration files.'
    },
    schema: [],
    type: 'problem'
  },
  create(context) {
    function report(node) {
      context.report({ messageId: 'forbidden', node });
    }

    return {
      ExportDefaultDeclaration(node) {
        report(node);
      },
      ExportNamedDeclaration(node) {
        for (const specifier of node.specifiers) {
          const exported = specifier.exported;
          const name =
            exported.type === 'Identifier' ? exported.name : exported.value;

          if (name === 'default') {
            report(specifier);
          }
        }
      }
    };
  }
};
