import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import ForgeEditDialog from "../src/components/forge-edit-dialog";

describe("ForgeEditDialog", () => {
  it("renders a shared dialog shell with title, close button, content, and footer actions", () => {
    const handleClose = vi.fn();
    const handleDragStart = vi.fn();

    render(
      <ForgeEditDialog
        ariaLabel="编辑技能包"
        draggable
        footer={<button type="button">保存修改</button>}
        onClose={handleClose}
        onHeaderMouseDown={handleDragStart}
        title="编辑技能包"
        variant="centered"
      >
        <label>
          技能包名称
          <input aria-label="技能包名称" type="text" value="客服增强包" readOnly />
        </label>
      </ForgeEditDialog>
    );

    expect(screen.getByRole("dialog", { name: /编辑技能包/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /编辑技能包/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/技能包名称/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /保存修改/i })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("heading", { name: /编辑技能包/i }).closest("div") as HTMLElement);
    expect(handleDragStart).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /关闭编辑技能包/i }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("keeps long centered dialogs inside the viewport and makes the body scrollable", () => {
    render(
      <ForgeEditDialog ariaLabel="系统设置" onClose={() => {}} title="系统设置" variant="centered">
        <div>很长的内容</div>
      </ForgeEditDialog>
    );

    expect(screen.getByRole("dialog", { name: /系统设置/i })).toHaveStyle({
      maxHeight: "calc(var(--app-viewport-height) - 48px - var(--app-safe-bottom))"
    });
    expect(screen.getByTestId("forge-edit-dialog-body")).toHaveStyle({
      overflowY: "auto"
    });
  });
});
