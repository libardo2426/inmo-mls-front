const COMPARISON_OPERATORS = new Set(['===', '!==', '==', '!=']);

function isRoleReference(node) {
  if (node.type === 'Identifier') return node.name === 'role';
  if (node.type === 'MemberExpression' && !node.computed) {
    return node.property.type === 'Identifier' && node.property.name === 'role';
  }
  return false;
}

function isStringLiteral(node) {
  return node.type === 'Literal' && typeof node.value === 'string';
}

/** Prohíbe decidir lógica comparando el rol con un literal: la autorización va por permisos. */
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      noRole: 'No compares el rol: decide con permisos (`can(...)`) o `allowedActions`.',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        const { left, right } = node;
        if (
          (isRoleReference(left) && isStringLiteral(right)) ||
          (isStringLiteral(left) && isRoleReference(right))
        ) {
          context.report({ node, messageId: 'noRole' });
        }
      },
    };
  },
};
