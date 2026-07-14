export interface ShortcutGroup {
  titleKey: string;
  shortcuts: Array<{
    labelKey: string;
    keys: string[];
  }>;
}
