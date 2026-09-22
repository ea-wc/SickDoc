import { test as base, expect } from "@playwright/test";
import { DEMO_UI } from "./helpers";

/**
 * `test` + `expect` for the SickDoc e2e suite. When DEMO_UI=true (i.e.
 * `pnpm test:e2e:demo`), every page renders a mouse indicator that follows the
 * pointer — visual only, no behavior change.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    if (DEMO_UI) {
      await page.addInitScript(() => {
        const mount = () => {
          const style = document.createElement("style");
          style.textContent = `
            #sickdoc-mouse-indicator {
              position: fixed;
              left: 0;
              top: 0;
              z-index: 2147483646;
              width: 24px;
              height: 24px;
              margin: -12px 0 0 -12px;
              border: 2px solid #7c3aed;
              border-radius: 50%;
              background: rgba(124, 58, 237, 0.18);
              box-shadow: 0 0 0 6px rgba(124, 58, 237, 0.12);
              pointer-events: none;
              display: none;
              transition: left 80ms linear, top 80ms linear, transform 120ms ease;
            }
            #sickdoc-mouse-indicator.clicking {
              transform: scale(0.65);
            }
          `;
          document.head.appendChild(style);

          if (!document.getElementById("sickdoc-mouse-indicator")) {
            const cursor = document.createElement("div");
            cursor.id = "sickdoc-mouse-indicator";
            document.body.appendChild(cursor);

            document.addEventListener("mousemove", (event) => {
              cursor.style.display = "block";
              cursor.style.left = `${event.clientX}px`;
              cursor.style.top = `${event.clientY}px`;
            });
            document.addEventListener("mousedown", () => cursor.classList.add("clicking"));
            document.addEventListener("mouseup", () => cursor.classList.remove("clicking"));
          }
        };
        if (document.readyState === "loading") {
          window.addEventListener("DOMContentLoaded", mount);
        } else {
          mount();
        }
      });
    }
    await use(page);
  },
});

export { expect };
