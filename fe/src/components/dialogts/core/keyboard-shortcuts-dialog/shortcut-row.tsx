import { Kbd, KbdGroup } from '@/components/ui/kbd';

interface ShortcutRowProps {
  shortcutRow: {
    label: string;
    keys: string[];
  };
}

export function ShortcutRow(props: ShortcutRowProps) {
  const { shortcutRow } = props;

  return (
    <div className="flex items-center justify-between py-2.5 px-1">
      <span className="text-sm text-text-primary">{shortcutRow.label}</span>
      <KbdGroup>
        {shortcutRow.keys.map((key, index) => (
          <Kbd
            key={`${key}-${index}`}
            keyId={key}
            variant="outline"
            size="md"
          />
        ))}
      </KbdGroup>
    </div>
  );
}
