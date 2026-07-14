import { Button } from '@/components/ui';

interface ProfileCopyButtonProps {
  onClick: () => void;
  label: string;
}

export function ProfileCopyButton(props: ProfileCopyButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0 px-3 text-sm md:h-10 md:px-6"
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}
