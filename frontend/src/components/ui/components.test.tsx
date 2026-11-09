import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { Icon } from "./Icon";
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
import {
  BottomSheet,
  ConfirmDialog,
  FormDialog,
  M3ModalDialog,
  NoticeDialog,
  Snackbar,
  SnackbarProvider,
  TypedConfirmDialog,
  useSnackbar,
} from "./dialogs";

describe("Icon", () => {
  it("renders a named Material Symbol with an accessible label", () => {
    render(<Icon name="check_circle" label="Complete" />);
    expect(screen.getByRole("img", { name: "Complete" })).toHaveTextContent(
      "check_circle",
    );
  });
});

describe("M3Button", () => {
  it("supports all variants, icons, loading, and disabled state", () => {
    const variants = [
      "filled",
      "tonal",
      "outlined",
      "text",
      "destructive",
      "fab",
    ] as const;
    render(
      <>
        {variants.map((variant) => (
          <M3Button key={variant} variant={variant} aria-label={variant}>
            {variant}
          </M3Button>
        ))}
        <M3Button loading>Working</M3Button>
        <M3Button disabled>Unavailable</M3Button>
        <M3Button
          leadingIcon={<Icon name="add" />}
          trailingIcon={<Icon name="check" />}
        >
          Icons
        </M3Button>
      </>,
    );
    for (const variant of variants) {
      expect(screen.getByRole("button", { name: variant })).toHaveClass(
        `ui-button--${variant}`,
      );
    }
    expect(screen.getByRole("button", { name: "Working" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Icons" })).toHaveTextContent(
      "add",
    );
  });
});

describe("M3TextField", () => {
  it("renders a floating label, helper text, and described error state", () => {
    render(
      <M3TextField
        label="Name"
        helperText="A helper"
        error="Required"
        required
      />,
    );
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
    expect(screen.getByText("A helper")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("PasswordField", () => {
  it("toggles visibility and keeps the current-password autocomplete value", () => {
    render(
      <PasswordField
        label="Password"
        showPasswordLabel="Show password"
        hidePasswordLabel="Hide password"
      />,
    );
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "current-password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });
});

describe("NumberField and DateTimeField", () => {
  it("renders the appropriate input types and disabled state", () => {
    render(
      <>
        <NumberField label="Count" disabled />
        <DateTimeField label="Starts at" />
      </>,
    );
    expect(screen.getByLabelText("Count")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Count")).toBeDisabled();
    expect(screen.getByLabelText("Starts at")).toHaveAttribute(
      "type",
      "datetime-local",
    );
  });
});

describe("M3Select", () => {
  it("renders its labelled options and error state", () => {
    render(
      <M3Select
        label="Mode"
        options={[
          { value: "public", label: "Public" },
          { value: "closed", label: "Closed" },
        ]}
        error="Choose a mode"
      />,
    );
    expect(screen.getByRole("combobox", { name: "Mode" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("option", { name: "Public" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a mode");
  });
});

describe("Toggle", () => {
  it("supports keyboard activation and disabled state", () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Toggle
          label="Mobile"
          checked={false}
          onCheckedChange={onCheckedChange}
        />
        <Toggle
          label="Locked"
          checked={false}
          onCheckedChange={onCheckedChange}
          disabled
        />
      </>,
    );
    const toggle = screen.getByRole("switch", { name: "Mobile" });
    toggle.focus();
    fireEvent.keyDown(toggle, { key: " " });
    fireEvent.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch", { name: "Locked" })).toBeDisabled();
  });
});

describe("Checkbox", () => {
  it("renders checked, disabled, and validation states", () => {
    render(
      <Checkbox label="Accept" defaultChecked disabled error="Required" />,
    );
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Accept" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("M3Card and M3Banner", () => {
  it("renders reusable surfaces and info, warning, and error variants", () => {
    render(
      <>
        <M3Card>
          <h2>Card title</h2>
        </M3Card>
        <M3Banner variant="info">Information</M3Banner>
        <M3Banner variant="warning">Warning</M3Banner>
        <M3Banner variant="error">Problem</M3Banner>
      </>,
    );
    expect(screen.getByRole("article")).toHaveClass("ui-card");
    expect(screen.getByText("Information")).toHaveAttribute("role", "status");
    expect(screen.getByRole("alert")).toHaveTextContent("Problem");
    expect(screen.getByText("Warning")).toHaveClass("ui-banner--warning");
  });
});

describe("StatusBadge and Chip", () => {
  it("renders status and interactive selection/removal controls", () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    render(
      <>
        <StatusBadge status="success">Active</StatusBadge>
        <Chip
          selected
          onClick={onClick}
          onRemove={onRemove}
          removeLabel="Remove filter"
        >
          Filter
        </Chip>
      </>,
    );
    expect(screen.getByText("Active")).toHaveClass("ui-status--success");
    const chip = screen.getByRole("button", { name: "Filter" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("SkeletonLoader and EmptyState", () => {
  it("announces loading and renders empty-state content and action", () => {
    render(
      <>
        <SkeletonLoader label="Loading records" count={2} />
        <EmptyState
          title="No records"
          description="Try again later."
          action={<M3Button>Retry</M3Button>}
        />
      </>,
    );
    expect(
      screen.getByRole("status", { name: "Loading records" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getAllByRole("status", { name: "Loading records" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "No records" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("ProgressBar", () => {
  it("reports bounded accessible values", () => {
    render(<ProgressBar value={120} max={100} label="Progress" />);
    expect(
      screen.getByRole("progressbar", { name: "Progress" }),
    ).toHaveAttribute("aria-valuenow", "100");
  });
});

describe("Tabs", () => {
  it("supports selection and arrow-key navigation", () => {
    render(
      <Tabs
        label="Sections"
        tabs={[
          { id: "one", label: "One", content: "First panel" },
          { id: "two", label: "Two", content: "Second panel" },
        ]}
      />,
    );
    const first = screen.getByRole("tab", { name: "One" });
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Second panel");
  });
});

describe("PageHeader and AuthCard", () => {
  it("composes title, actions, form content, and footer", () => {
    render(
      <>
        <PageHeader title="Page title" actions={<M3Button>New</M3Button>} />
        <AuthCard title="Sign in" footer="Footer text">
          <M3TextField label="Username" />
        </AuthCard>
      </>,
    );
    expect(
      screen.getByRole("heading", { name: "Page title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByText("Footer text")).toBeInTheDocument();
  });
});

describe("CopyLinkField", () => {
  it("copies its value and exposes the copied state", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <CopyLinkField
        label="Share link"
        value="https://example.test"
        copyLabel="Copy"
        copiedLabel="Copied"
        copyErrorLabel="Copy failed"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("https://example.test");
    expect(
      await screen.findByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
  });

  it("announces clipboard failures", () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    render(
      <CopyLinkField
        label="Share link"
        value="https://example.test"
        copyLabel="Copy"
        copiedLabel="Copied"
        copyErrorLabel="Copy failed"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Copy failed");
  });
});

describe("M3ModalDialog", () => {
  it("traps focus, closes on Escape, and returns focus", () => {
    const onClose = vi.fn();
    const { rerender } = render(<button type="button">Open dialog</button>);
    const opener = screen.getByRole("button", { name: "Open dialog" });
    opener.focus();
    rerender(
      <>
        <button type="button">Open dialog</button>
        <M3ModalDialog
          open
          onClose={onClose}
          title="Dialog title"
          actions={<button type="button">Last action</button>}
        >
          <button type="button">First action</button>
        </M3ModalDialog>
      </>,
    );
    const dialog = screen.getByRole("dialog", { name: "Dialog title" });
    const first = within(dialog).getByRole("button", { name: "First action" });
    const last = within(dialog).getByRole("button", { name: "Last action" });
    expect(first).toHaveFocus();
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("restores focus after closing", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Open dialog</button>
        <M3ModalDialog open onClose={onClose} title="Dialog title">
          Dialog body
        </M3ModalDialog>
      </>,
    );
    const opener = screen.getByRole("button", { name: "Open dialog" });
    opener.focus();
    rerender(
      <>
        <button type="button">Open dialog</button>
        <M3ModalDialog open={false} onClose={onClose} title="Dialog title">
          Dialog body
        </M3ModalDialog>
      </>,
    );
    expect(opener).toHaveFocus();
  });
});

describe("dialog variants", () => {
  it("renders confirmation, notice, form, typed confirmation, and bottom sheet", () => {
    const actions = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        onClose={actions}
        onConfirm={actions}
        title="Confirm"
        description="Confirm action"
        cancelLabel="Cancel"
        confirmLabel="Continue"
      />,
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(actions).toHaveBeenCalled();

    rerender(
      <NoticeDialog open onClose={actions} title="Notice" closeLabel="Close">
        Notice content
      </NoticeDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Notice" })).toBeInTheDocument();

    rerender(
      <FormDialog open onClose={actions} title="Form">
        <M3TextField label="Name" />
      </FormDialog>,
    );
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();

    rerender(
      <TypedConfirmDialog
        open
        onClose={actions}
        onConfirm={actions}
        title="Type word"
        description="Type the word"
        word="REMOVE"
        inputLabel="Confirmation"
        cancelLabel="Cancel"
        confirmLabel="Remove"
      />,
    );
    expect(screen.getByRole("button", { name: "Remove" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Confirmation" }), {
      target: { value: "REMOVE" },
    });
    expect(screen.getByRole("button", { name: "Remove" })).toBeEnabled();

    rerender(
      <BottomSheet open onClose={actions} title="Sheet">
        Sheet content
      </BottomSheet>,
    );
    expect(screen.getByRole("dialog", { name: "Sheet" })).toHaveClass(
      "ui-dialog--sheet",
    );
  });
});

describe("Snackbar and SnackbarProvider", () => {
  it("renders a snackbar and announces provider messages", () => {
    function Trigger() {
      const { show } = useSnackbar();
      return <button onClick={() => show("Saved")}>Show message</button>;
    }
    render(
      <>
        <Snackbar message="Standalone message" />
        <SnackbarProvider>
          <Trigger />
        </SnackbarProvider>
      </>,
    );
    expect(screen.getByText("Standalone message")).toHaveAttribute(
      "role",
      "status",
    );
    fireEvent.click(screen.getByRole("button", { name: "Show message" }));
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent("Saved");
  });
});

describe("component accessibility", () => {
  it("has no automated accessibility violations for labelled primitives", async () => {
    const { container } = render(
      <main>
        <h1>Voting options</h1>
        <M3Card>
          <h2>Polling mode</h2>
          <M3TextField label="Station name" helperText="A public name" />
          <Checkbox label="Accept terms" />
          <M3Button>Continue</M3Button>
        </M3Card>
      </main>,
    );
    const results = await axe(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toHaveLength(0);
  });

  it("keeps Carbon Black text readable on Pacific Cyan", async () => {
    const stylesheet = await readFile(
      resolve(process.cwd(), "src/styles/globals.css"),
      "utf8",
    );
    function token(name: string) {
      const match = stylesheet.match(
        new RegExp(`--color-${name}:\\s*(#[\\da-f]{6});`, "i"),
      );
      const value = match?.[1];
      if (!value) throw new Error();
      return value;
    }

    function luminance(hex: string) {
      const channels = [1, 3, 5].map((index) => {
        const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const [red, green, blue] = channels;
      if (red === undefined || green === undefined || blue === undefined) {
        throw new Error();
      }
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }

    const values = [luminance(token("carbon")), luminance(token("pacific"))];
    const contrast =
      (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});
