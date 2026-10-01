# Shop UI verification

Approved reference: `libfile_0da541ddc5b8819185906937c021bf3c`. Unchanged source PNG SHA-256: `e45f90ad20aaaf5d2d4c4447412a7a528e7a5f33bcb158f4e5c39c2d70b07280`.

Three real DOM product panels show 1 pack / 5 cards / 1,500 won, 5 packs / 25 cards / 5,900 won, and 10 packs / 50 cards / 9,900 won. Source crops supply pack artwork, logo, corner and button ornaments. All action labels, prices and counts are DOM text. Pack and logo crop aspect ratios remain intact on small screens.

Payments and inventory are not connected. A visible notice and accessible native dialogs explain this; no payment, pack granting, opening, deduction, login or account mutation occurs. Owned quantity is shown as unconnected rather than a fabricated zero. Existing Return and settings routes remain intact.

`test/shop.browser.cjs` passed in Chrome: product counts/prices, unavailable notices, unchanged storage, Escape/focus return, 1672x941 / 844x390 / 568x320 / 360x640, reachable 44px controls, touch, and Return. Independent reviewer rechecked corrected source proportions and found no release-blocking defects.

Visual limits: the clean portal background is shared with the main menu; composition, DOM typography and simplified frame/divider details approximate the approved shop reference. Native Steam wrapper and real commerce are outside this patch.
