<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI: modals, dialogs, and popups

Whenever you build or edit a modal, dialog, or popover, always give the content proper inner spacing so nothing touches the edges (titles, text, and buttons must never run to the border):

- The body wrapper inside `<DialogContent>` must use **`px-6 pb-6`** (add `pt-2` when it directly follows a `DialogHeader`). **Never** use `px-1`/`px-2` or a bare `py-2` for a modal body — that is exactly what makes buttons and text touch the edges.
- `<DialogContent>` itself ships with **no padding by design**. Spacing comes from `DialogHeader` (`px-6 pt-6`), `DialogFooter` (`px-6 pb-6`), and your own body wrapper. Every block must share the same `px-6` so the title, body, and buttons line up on the left edge.
- If you set `p-0` on `DialogContent` (e.g. for a full-bleed image/header), the content section below it must add its own `px-6 pb-6`.
- For custom (non-Radix) modals built from `fixed inset-0`, give the panel `p-6` (or `px-6 py-6`).
