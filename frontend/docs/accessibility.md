# Accessibility Audit

Date: 2026-11-24

## Automated tests

- `vitest-axe` remains in the Vitest suite.
- Added axe assertions for Billing, the Payment Gate dialog, the voter Ballot
  experience, and the shared 404 status page.
- Existing reusable component axe coverage remains in
  `src/components/ui/components.test.tsx`.
- All Vitest axe assertions pass.

## Keyboard and focus

- All dialogs use the shared `M3ModalDialog` focus trap and restore focus to the
  previously focused element when closed.
- Dialog Escape, backdrop, and close behavior remains keyboard accessible.
- Focus-visible rules use a three-pixel Pacific Cyan outline with an offset.
- Form fields retain visible labels and associate helper/error text through
  `aria-describedby` and `aria-invalid`.
- Reduced-motion rules disable transitions and animations at the global,
  analytics, and voter-ballot layers.

## Contrast results

| Pair | Ratio | Result |
| --- | ---: | --- |
| Pacific Cyan / Carbon Black | 6.46:1 | Passes AA for normal text |
| Pacific Cyan / white | 2.51:1 | Fails; never used for text |
| Carbon / Platinum | 14.76:1 | Passes AA |
| Carbon / Alabaster Grey | 12.06:1 | Passes AA |
| Red Ochre / Platinum | 4.62:1 | Passes AA |
| Red Ochre / white | 5.08:1 | Passes AA |

Text on Pacific Cyan is Carbon Black in the button system. White is not used
with Pacific Cyan for text.

## Lighthouse

Mobile Lighthouse reports produced locally against the production server:

| Route | Performance | Accessibility | Best practices | SEO |
| --- | ---: | --- | ---: | ---: |
| `/` | 76 | 81 | 96 | 100 |
| `/s/mock/register` | 76 | 69 | 96 | 80 |
| `/s/mock/ballot` | 72 | 69 | 96 | 80 |

The public-route Lighthouse runs used placeholder mock IDs because browser MSW
mocks do not initialize the server layout's public-config fetch. The routes
returned their loading/not-found shell in this local run. The root layout,
document title, and lang attribute are verified in the final HTML; public-route
mocking of the server config should be provided for a production-equivalent
Lighthouse rerun.
