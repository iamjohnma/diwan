import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon } from '@phosphor-icons/react';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/common/cn';

export interface FullScreenButtonProps {
  isFullScreen?: boolean;
  onFullScreenToggle?: () => void;
}

export function FullScreenButton(props: FullScreenButtonProps) {
  const { t } = useTranslation();
  const tooltipText = props.isFullScreen
    ? t('common.tooltips.exitFullscreen')
    : t('common.tooltips.enterFullscreen');

  return (
    <IconButton
      aria-label={tooltipText}
      variant="outline"
      size="equal"
      icon={
        props.isFullScreen ? (
          <ArrowsInSimpleIcon className="size-5 text-secondary-foreground" />
        ) : (
          <ArrowsOutSimpleIcon className="size-5 text-text-secondary" />
        )
      }
      tooltip={tooltipText}
      className={cn(
        'size-10',
        props.isFullScreen &&
          'bg-primary/10 hover:bg-primary/15 border-primary/20'
      )}
      onClick={props.onFullScreenToggle}
    />
  );
}
