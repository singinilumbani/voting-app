import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePhoneList } from "./use-phone-list";

function PhoneListResult({ input }: Readonly<{ input: string }>) {
  const { entries, valid, invalid } = usePhoneList(input);
  return (
    <output>{`${entries.length}/${valid.length}/${invalid.length}`}</output>
  );
}

describe("usePhoneList", () => {
  it("parses a delimited host phone list into valid and invalid entries", () => {
    render(<PhoneListResult input={"0991234567\nnot a phone;0881234567"} />);

    expect(screen.getByText("3/2/1")).toBeInTheDocument();
  });
});
