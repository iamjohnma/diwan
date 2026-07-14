import {
  StepsDialog,
  StepsDialogBodyWithIndexProvider,
  StepsDialogContent
} from '@/components/dialogts/common/steps-dialog';
import { CreateCaseBasicsStep } from '@/components/dialogts/pages/_app/cases/create-case-dialog/create-case-basics-step';
import { CreateCasePartiesStep } from '@/components/dialogts/pages/_app/cases/create-case-dialog/create-case-parties-step';
import { CreateCaseReviewStep } from '@/components/dialogts/pages/_app/cases/create-case-dialog/create-case-review-step';
import type { CreateCaseDialogHook } from '@/hooks/pages/_app/cases';

interface CreateCaseDialogProps {
  createCaseDialog: CreateCaseDialogHook;
}

export function CreateCaseDialog(props: CreateCaseDialogProps) {
  const dialog = props.createCaseDialog;

  return (
    <StepsDialog
      open={dialog.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          dialog.closeDialog();
        }
      }}
    >
      <StepsDialogContent className="md:max-w-[520px]" showCloseButton>
        <StepsDialogBodyWithIndexProvider
          measureKey={dialog.isOpen ? 'open' : 'closed'}
        >
          <CreateCaseBasicsStep createCaseDialog={dialog} />
          <CreateCasePartiesStep createCaseDialog={dialog} />
          <CreateCaseReviewStep createCaseDialog={dialog} />
        </StepsDialogBodyWithIndexProvider>
      </StepsDialogContent>
    </StepsDialog>
  );
}
