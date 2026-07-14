import { useEffect, useState } from 'react';
import { UserIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TruncateText } from '@/components/common/truncate-text';
import { DialogWrapper } from '@/components/dialogts/common/dialog-wrapper';
import {
  SettingsDescriptionRow,
  SettingsValueRow
} from '@/components/pages/_app/settings/settings-row';
import { ProfileCopyButton } from '@/components/pages/_app/settings/tab-profile/profile-copy-button';
import { Button, Input, Skeleton, UserAvatar } from '@/components/ui';
import type { SettingsProfileHook } from '@/hooks/pages/_app/settings';

function EditNameDialog(props: { profile: SettingsProfileHook }) {
  const translation = useTranslation();
  const t = translation.t;
  const [name, setName] = useState(props.profile.profile?.name ?? '');

  useEffect(() => {
    if (props.profile.isEditNameOpen) {
      setName(props.profile.profile?.name ?? '');
    }
  }, [props.profile.isEditNameOpen, props.profile.profile?.name]);

  const submit = () => {
    void props.profile.updateName(name).catch(() => undefined);
  };

  return (
    <DialogWrapper
      open={props.profile.isEditNameOpen}
      onOpenChange={props.profile.setIsEditNameOpen}
      title={t('settings.editNameDialog.title')}
      icon={UserIcon}
      cancelLabel={t('common.cancel')}
      confirmLabel={t('common.save')}
      onConfirm={submit}
      onEnterSubmit={submit}
      confirmDisabled={name.trim().length < 2}
      isLoading={props.profile.isUpdatingName}
    >
      <div className="grid gap-2 px-6">
        <label className="text-sm font-medium" htmlFor="settings-profile-name">
          {t('settings.editNameDialog.nameLabel')}
        </label>
        <Input
          id="settings-profile-name"
          value={name}
          maxLength={80}
          placeholder={t('settings.editNameDialog.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
    </DialogWrapper>
  );
}

interface ProfileTabProps {
  profile: SettingsProfileHook;
}

export function ProfileTab(props: ProfileTabProps) {
  const translation = useTranslation();
  const t = translation.t;
  const data = props.profile.profile;

  if (props.profile.isLoading) {
    return (
      <div className="flex flex-col gap-3 py-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const name = data?.name || t('settings.profile.noName');
  const copyLabel = t('settings.profile.copy');

  return (
    <>
      <div className="flex flex-col">
        <div className="flex min-w-0 items-center gap-x-3 overflow-hidden border-b border-border-default py-2.5 md:gap-x-4 md:py-4">
          <UserAvatar name={name} imageUrl={data?.image} size="2xl" />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <TruncateText className="text-sm font-medium text-text-primary md:text-base">
              {name}
            </TruncateText>
            <span className="text-xs text-text-secondary md:text-sm">
              {t('settings.profile.accountPhoto')}
            </span>
          </div>
        </div>
        <SettingsValueRow
          label={t('settings.profile.fullName')}
          value={name}
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 md:h-10 md:px-6"
              onClick={() => props.profile.setIsEditNameOpen(true)}
            >
              {t('settings.profile.change')}
            </Button>
          }
        />
        <SettingsValueRow
          label={t('settings.profile.userId')}
          value={
            data?.id ? (
              <span className="rounded bg-background-surface px-2 py-1 font-mono text-xs">
                {data.id.slice(0, 8)}...{data.id.slice(-4)}
              </span>
            ) : (
              '-'
            )
          }
          action={
            data?.id ? (
              <ProfileCopyButton
                label={copyLabel}
                onClick={() => {
                  void props.profile.copy(
                    data.id,
                    t('settings.profile.idCopied')
                  );
                }}
              />
            ) : undefined
          }
        />
        <SettingsValueRow
          label={t('settings.profile.email')}
          value={data?.email || '-'}
          action={
            data?.email ? (
              <ProfileCopyButton
                label={copyLabel}
                onClick={() => {
                  void props.profile.copy(
                    data.email,
                    t('settings.profile.emailCopied')
                  );
                }}
              />
            ) : undefined
          }
        />
        <SettingsValueRow
          label={t('settings.profile.role')}
          value={String(
            t(`settings.profile.roles.${data?.role ?? 'member'}` as never)
          )}
        />
        <SettingsDescriptionRow
          title={t('settings.password.label')}
          description={t('settings.password.description')}
          bordered
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 px-3 text-sm md:h-10 md:px-6"
          >
            {t('settings.password.changeAction')}
          </Button>
        </SettingsDescriptionRow>
      </div>
      <EditNameDialog profile={props.profile} />
    </>
  );
}
