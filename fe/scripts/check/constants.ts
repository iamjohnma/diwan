const colorEnabled = process.env.NO_COLOR === undefined;

function color(value: string): string {
  return colorEnabled ? value : '';
}

export const COLORS = {
  bold: color('\u001b[1m'),
  cyan: color('\u001b[36m'),
  dim: color('\u001b[2m'),
  green: color('\u001b[32m'),
  red: color('\u001b[31m'),
  reset: color('\u001b[0m'),
  yellow: color('\u001b[33m')
} as const;
