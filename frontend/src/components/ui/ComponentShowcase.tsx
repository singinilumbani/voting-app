"use client";

import { useState } from "react";
import {
  AuthCard,
  Checkbox,
  Chip,
  CopyLinkField,
  DateTimeField,
  EmptyState,
  M3Banner,
  M3Button,
  M3Card,
  M3Select,
  M3TextField,
  NumberField,
  PageHeader,
  PasswordField,
  ProgressBar,
  SkeletonLoader,
  StatusBadge,
  Tabs,
  Toggle,
} from "./primitives";
import { Icon } from "./Icon";
import {
  ConfirmDialog,
  FormDialog,
  M3ModalDialog,
  NoticeDialog,
  BottomSheet,
  TypedConfirmDialog,
  Snackbar,
  SnackbarProvider,
  useSnackbar,
} from "./dialogs";
import messages from "@/locales/en.json";

const copy = messages.dev;

function SnackbarExample() {
  const snackbar = useSnackbar();
  return (
    <>
      <M3Button onClick={() => snackbar.show(copy.feedback.snackbar)}>
        {copy.feedback.showSnackbar}
      </M3Button>
      <Snackbar message={copy.feedback.snackbar} />
    </>
  );
}

function ComponentShowcaseContent() {
  const [dialog, setDialog] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);

  return (
    <main className="component-sheet">
      <PageHeader title={copy.title} description={copy.description} />

      <section className="component-sheet__section">
        <h2>{copy.buttons.title}</h2>
        <div className="component-sheet__row">
          <M3Button variant="filled" leadingIcon={<Icon name="check_circle" />}>
            {copy.buttons.filled}
          </M3Button>
          <M3Button variant="tonal">{copy.buttons.tonal}</M3Button>
          <M3Button
            variant="outlined"
            trailingIcon={<Icon name="arrow_forward" />}
          >
            {copy.buttons.outlined}
          </M3Button>
          <M3Button variant="text">{copy.buttons.text}</M3Button>
          <M3Button variant="destructive">{copy.buttons.destructive}</M3Button>
          <M3Button variant="fab" aria-label={copy.buttons.floating}>
            <Icon name="add" />
          </M3Button>
          <M3Button loading>{copy.buttons.loading}</M3Button>
          <M3Button disabled>{copy.buttons.disabled}</M3Button>
          <M3Button leadingIcon={<Icon name="add" />}>
            {copy.buttons.leading}
          </M3Button>
          <M3Button trailingIcon={<Icon name="arrow_forward" />}>
            {copy.buttons.trailing}
          </M3Button>
        </div>
      </section>

      <section className="component-sheet__section">
        <h2>{copy.fields.title}</h2>
        <div className="component-sheet__grid">
          <M3TextField
            label={copy.fields.name}
            helperText={copy.fields.nameHelp}
          />
          <M3TextField
            label={copy.fields.name}
            error={copy.fields.nameError}
            aria-invalid="true"
          />
          <PasswordField
            label={copy.fields.password}
            showPasswordLabel={copy.fields.showPassword}
            hidePasswordLabel={copy.fields.hidePassword}
          />
          <NumberField label={copy.fields.number} min={0} />
          <DateTimeField label={copy.fields.dateTime} />
          <M3Select
            label={copy.fields.select}
            placeholder={copy.fields.selectPlaceholder}
            options={[
              { value: "public", label: copy.fields.publicPoll },
              { value: "closed", label: copy.fields.closedVote },
            ]}
          />
          <Toggle
            label={copy.fields.toggle}
            description={copy.fields.toggleHelp}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
          <Toggle
            label={copy.fields.toggle}
            checked={false}
            onCheckedChange={() => undefined}
            disabled
          />
          <Checkbox
            label={copy.fields.checkbox}
            error={copy.fields.checkboxError}
          />
          <M3TextField label={copy.fields.disabled} disabled />
        </div>
      </section>

      <section className="component-sheet__section">
        <h2>{copy.dialogs.title}</h2>
        <div className="component-sheet__row">
          <M3Button onClick={() => setDialog("confirm")}>
            {copy.dialogs.openConfirm}
          </M3Button>
          <M3Button onClick={() => setDialog("notice")}>
            {copy.dialogs.openNotice}
          </M3Button>
          <M3Button onClick={() => setDialog("form")}>
            {copy.dialogs.openForm}
          </M3Button>
          <M3Button onClick={() => setDialog("typed")}>
            {copy.dialogs.openTyped}
          </M3Button>
          <M3Button onClick={() => setDialog("sheet")}>
            {copy.dialogs.openSheet}
          </M3Button>
          <M3Button onClick={() => setDialog("modal")}>
            {copy.dialogs.modalTitle}
          </M3Button>
        </div>
        <ConfirmDialog
          open={dialog === "confirm"}
          onClose={() => setDialog(null)}
          onConfirm={() => setDialog(null)}
          title={copy.dialogs.confirmTitle}
          description={copy.dialogs.confirmDescription}
          cancelLabel={copy.dialogs.cancel}
          confirmLabel={copy.dialogs.confirm}
        />
        <NoticeDialog
          open={dialog === "notice"}
          onClose={() => setDialog(null)}
          title={copy.dialogs.noticeTitle}
          closeLabel={copy.dialogs.close}
        >
          <p>{copy.dialogs.noticeBody}</p>
        </NoticeDialog>
        <FormDialog
          open={dialog === "form"}
          onClose={() => setDialog(null)}
          title={copy.dialogs.formTitle}
          actions={
            <M3Button onClick={() => setDialog(null)}>
              {copy.dialogs.close}
            </M3Button>
          }
        >
          <M3TextField label={copy.fields.name} />
        </FormDialog>
        <TypedConfirmDialog
          open={dialog === "typed"}
          onClose={() => setDialog(null)}
          onConfirm={() => setDialog(null)}
          title={copy.dialogs.typedTitle}
          description={copy.dialogs.typedDescription}
          word={copy.dialogs.typedWord}
          inputLabel={copy.dialogs.typedInput}
          cancelLabel={copy.dialogs.cancel}
          confirmLabel={copy.dialogs.confirm}
        />
        <BottomSheet
          open={dialog === "sheet"}
          onClose={() => setDialog(null)}
          title={copy.dialogs.sheetTitle}
          actions={
            <M3Button onClick={() => setDialog(null)}>
              {copy.dialogs.close}
            </M3Button>
          }
        >
          <p>{copy.dialogs.sheetBody}</p>
        </BottomSheet>
        <M3ModalDialog
          open={dialog === "modal"}
          onClose={() => setDialog(null)}
          title={copy.dialogs.modalTitle}
          actions={
            <M3Button onClick={() => setDialog(null)}>
              {copy.dialogs.close}
            </M3Button>
          }
        >
          <p>{copy.dialogs.modalBody}</p>
        </M3ModalDialog>
      </section>

      <section className="component-sheet__section">
        <h2>{copy.feedback.title}</h2>
        <div className="component-sheet__grid">
          <M3Card>
            <h3>{copy.feedback.cardTitle}</h3>
            <p>{copy.feedback.cardBody}</p>
          </M3Card>
          <M3Banner variant="info">{copy.feedback.info}</M3Banner>
          <M3Banner variant="warning">{copy.feedback.warning}</M3Banner>
          <M3Banner variant="error">{copy.feedback.error}</M3Banner>
          <div className="component-sheet__row">
            <StatusBadge status="neutral">
              {copy.feedback.statusNeutral}
            </StatusBadge>
            <StatusBadge status="success">
              {copy.feedback.statusSuccess}
            </StatusBadge>
            <StatusBadge status="warning">
              {copy.feedback.statusWarning}
            </StatusBadge>
            <StatusBadge status="error">
              {copy.feedback.statusError}
            </StatusBadge>
          </div>
          <Chip
            selected
            onClick={() => undefined}
            onRemove={() => undefined}
            removeLabel={copy.feedback.chipRemove}
          >
            {copy.feedback.chip}
          </Chip>
          <SkeletonLoader label={copy.feedback.skeleton} count={3} />
          <EmptyState
            title={copy.feedback.emptyTitle}
            description={copy.feedback.emptyDescription}
            icon={<Icon name="inbox" />}
          />
          <ProgressBar value={65} label={copy.feedback.progress} />
          <SnackbarProvider>
            <SnackbarExample />
          </SnackbarProvider>
          <CopyLinkField
            label={copy.feedback.copyLabel}
            value={copy.feedback.copyUrl}
            copyLabel={copy.feedback.copy}
            copiedLabel={copy.feedback.copied}
            copyErrorLabel={copy.feedback.copyError}
          />
        </div>
      </section>

      <section className="component-sheet__section">
        <h2>{copy.navigation.title}</h2>
        <Tabs
          label={copy.navigation.tabs}
          tabs={[
            {
              id: "overview",
              label: copy.navigation.firstTab,
              content: copy.navigation.firstContent,
            },
            {
              id: "details",
              label: copy.navigation.secondTab,
              content: copy.navigation.secondContent,
            },
          ]}
        />
        <PageHeader
          title={copy.navigation.pageTitle}
          description={copy.navigation.pageDescription}
          actions={<M3Button>{copy.navigation.pageAction}</M3Button>}
        />
        <AuthCard
          title={copy.navigation.authTitle}
          description={copy.navigation.authDescription}
          footer={copy.navigation.authFooter}
        >
          <M3TextField label={copy.navigation.authField} />
        </AuthCard>
      </section>

      <section className="component-sheet__section">
        <h2>{copy.icons.title}</h2>
        <div className="component-sheet__row">
          <Icon name="check_circle" label={copy.icons.check} />
          <Icon name="visibility" label={copy.icons.visibility} />
          <Icon name="content_copy" label={copy.icons.copy} />
        </div>
      </section>
    </main>
  );
}

export function ComponentShowcase() {
  return (
    <SnackbarProvider>
      <ComponentShowcaseContent />
    </SnackbarProvider>
  );
}
