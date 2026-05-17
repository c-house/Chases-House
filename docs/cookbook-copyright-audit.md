# Cookbook Copyright Audit

**Document type**: Compliance review against U.S. copyright law
**Subject**: `cookbook/` section of chases.house (17 recipes, mixed provenance)
**Date**: 2026-05-12
**Assessor**: In-house review using `legal:compliance-check` + `legal:legal-risk-assessment` frameworks
**Privileged**: No (working document)

---

## 1. Executive Summary

### Overall Risk Posture

The cookbook is a non-commercial personal site publishing 17 recipes spanning four provenance buckets: (a) original family recipes, (b) recipes attributed to published cookbook authors and major media personalities, (c) recipes lifted from food-blogger sites with substantial original prose, and (d) recipes from user-submitted recipe communities. Stock photography is sourced from Unsplash with one locally hosted AI-generated image; several recipes use locally hosted images whose CC0 status has not yet been verified file-by-file.

The recipes themselves — ingredient lists and functional preparation steps — are not protectable as facts and procedures under U.S. copyright law (*Publications International v. Meredith Corp.*, 88 F.3d 473 (7th Cir. 1996)). The exposure sits almost entirely in three places: (1) headnote prose and "notes" sections that carry creative expression from named sources, (2) direct quoted material from named personalities, and (3) image provenance where verification has not been completed per asset. Attribution is present throughout, which is courtesy — not a license — and does not cure infringement of expressive content.

The site's compilation (selection + arrangement of recipes) appears to be original and does not mirror any single source cookbook's structure, so compilation-copyright exposure is minimal.

### Risk Count by Severity

| Risk Level | Count | Recipes |
|---|---|---|
| RED (Critical, 16-25) | 0 | — |
| ORANGE (High, 10-15) | 2 | Thomas Keller's Roast Chicken; Grilled Salmon with Maple-Ginger Glaze (Al Roker) |
| YELLOW (Medium, 5-9) | 6 | Mississippi Pot Roast (Brandie); Inside-Out Cordon Bleu (Betty Crocker); Candied Carrots (Steve Cylka); Blueberry Ice Cream (Riverside Len / Food.com); Pot Roast for Two (Chef Jean-Pierre); Sunday Roast Chicken (likely-borrowed phrasing) |
| GREEN (Low, 1-4) | 9 | Lemon Garlic Tenderloin; Wanda's Lasagna; Family Chili; Brown Butter Cookies; Buttermilk Pancakes; Banana Bread; Three-Cheese Mac; Fried Artichoke Hearts; Yum Yum Sauce |

### Top-line Recommendations

The site is in a defensible position with three categories of cleanup: (a) rewrite or strip the chatty/expressive headnotes and "notes" sections on the six named-source recipes so only ingredients and functional steps remain attributed to the source while everything expressive becomes original commentary; (b) remove the direct verbatim quotation from Al Roker, which is the single clearest infringement in the cookbook; (c) complete per-image CC0 verification on all twelve locally hosted assets and document the source for each. These three changes, plus light remediation of two minor headnotes, move the entire cookbook to GREEN.

---

## 2. Per-Recipe Findings

The table below evaluates each recipe across five dimensions: instruction text, headnotes/prose, selection/arrangement, image provenance, and attribution. Severity uses the 1-5 scale (1=Negligible, 5=Critical); Likelihood uses 1-5 (1=Remote, 5=Almost Certain). Risk score = S × L.

| # | Recipe | Dimension | Issue | Sev | Lik | Score | Recommended Action |
|---|---|---|---|---|---|---|---|
| 1 | Lemon Garlic Baked Tenderloin (Genevieve Pavlik) | Headnote | "Inspired by … reimagined bright with lemon and garlic" — clearly transformative framing | 1 | 1 | 1 GREEN | None. Family source, transformative use. |
| 1 | Lemon Garlic Baked Tenderloin | Instructions | Functional steps only; no expressive borrowing visible | 1 | 1 | 1 GREEN | None. |
| 1 | Lemon Garlic Baked Tenderloin | Image | Unsplash hotlink — verify the specific photo carries the Unsplash License | 2 | 2 | 4 GREEN | Confirm photo ID `1432139509613-...` is on Unsplash and snapshot license terms. |
| 1 | Lemon Garlic Baked Tenderloin | Attribution | Author credited; "adapted from" framing present | 1 | 1 | 1 GREEN | None. |
| 2 | Wanda's Lasagna (Wanda Hankus) | Headnote | "rich meat sauce, creamy ricotta, plenty of mozzarella" — original short prose | 1 | 1 | 1 GREEN | None. |
| 2 | Wanda's Lasagna | Instructions | The note "The original recipe lists salt, pepper, and Romano 'to taste'" references but does not reproduce source language | 1 | 1 | 1 GREEN | None. |
| 2 | Wanda's Lasagna | Image | Unsplash hotlink | 2 | 2 | 4 GREEN | Verify Unsplash license on photo ID `1709429790175-...`. |
| 2 | Wanda's Lasagna | Attribution | Family source attributed by name; implied family license | 1 | 1 | 1 GREEN | None. |
| 3 | Sunday Roast Chicken ("Family favorite") | Headnote | Notes opens with "Hello my friends!" — the signature catchphrase of Chef Jean-Pierre, who is credited on the *Pot Roast for Two* recipe in the same cookbook. Possible inadvertent borrowing of his persona/voice. | 2 | 3 | 6 YELLOW | Rewrite the notes opening to a neutral voice. Catchphrases are generally not protectable but the cross-pollination with another credited author in the same compilation is a tell — clean it up. |
| 3 | Sunday Roast Chicken | Instructions | Functional steps; "This is non-negotiable" is original tone | 1 | 1 | 1 GREEN | None. |
| 3 | Sunday Roast Chicken | Image | Unsplash hotlink | 2 | 2 | 4 GREEN | Verify Unsplash license. |
| 4 | Thomas Keller's Roast Chicken with Root Vegetables | Headnote | "From Ad Hoc at Home — a perfectly bronzed bird nested over leeks, rutabagas, turnips, and potatoes that caramelize in the rendered chicken fat" — descriptive but likely original phrasing; "Don't skimp on the rutabagas or leeks — they're what make this dinner special" is close in spirit to Keller's own headnote in the published cookbook | 3 | 3 | 9 YELLOW | Confirm by reading Keller's headnote in *Ad Hoc at Home* (2009, Artisan). If the phrasing overlaps, rewrite in original voice. |
| 4 | Thomas Keller's Roast Chicken | Instructions | The recipe is highly detailed and method-specific (e.g., "cut out the wishbone — this makes carving easier", "Truss the chicken", precise 475°F→400°F temperature regime, 20-minute rest). The functional steps are not protectable — but the specific combination of expressive choices (the wishbone aside, the precise rest time, the "make a nest" phrasing) tracks the cookbook closely. Substantial similarity is a real question if the instructions read line-by-line against the published recipe. | 4 | 3 | 12 ORANGE | Compare the instructions verbatim against *Ad Hoc at Home*. Where individual sentences match in expressive choice (not just procedural fact), rewrite them. Keller's publisher (Artisan / Workman / Hachette) is one of the more actively-enforced cookbook houses; this is the most exposed recipe in the cookbook. |
| 4 | Thomas Keller's Roast Chicken | Image | Local — `images/keller-chicken/image1.png` (plus image2–4 in the directory). **Per-image CC0 verification required.** If these were generated, scraped, or otherwise lifted, they are the highest-risk image in the entire cookbook. | 4 | 3 | 12 ORANGE | Verify provenance immediately. If from a CC0 library, document the URL and license snapshot. If AI-generated, note that explicitly. If unknown, replace. |
| 4 | Thomas Keller's Roast Chicken | Attribution | "Adapted from *Ad Hoc at Home* (2009)" — credit present | 2 | 4 | 8 YELLOW | Attribution is good practice but does not license the borrowed expression. Pair with rewrites above. |
| 5 | Fried Artichoke Hearts (Tasty Kitchen) | Headnote | "Frozen artichoke hearts dipped in egg and Romano-spiked bread crumbs, pan-fried crispy, served with lemony garlic aioli" — original concise restatement | 1 | 1 | 1 GREEN | None. |
| 5 | Fried Artichoke Hearts | Instructions | Functional. Note: "Thaw the artichoke hearts fully and pat them very dry" is generic technique. | 1 | 1 | 1 GREEN | None. |
| 5 | Fried Artichoke Hearts | Image | Local image — verify per-image CC0 status | 2 | 3 | 6 YELLOW | Document provenance of `images/fried-artichoke-hearts/image1.png`. |
| 5 | Fried Artichoke Hearts | Attribution | Tasty Kitchen (Pioneer Woman community site) credited. Tasty Kitchen's terms historically required user submitters to license content to TPK — uncertain whether they re-license downstream. | 2 | 2 | 4 GREEN | Read Tasty Kitchen's current ToS for personal/non-commercial republication policy. |
| 6 | Yum Yum Sauce (Jason's BBQ Adventures) | Headnote | "The pale pink Japanese steakhouse sauce — Sakura Sauce, White Sauce, whatever you call it" — original colorful framing | 1 | 1 | 1 GREEN | None. |
| 6 | Yum Yum Sauce | Instructions | Mix-and-chill, fully functional | 1 | 1 | 1 GREEN | None. |
| 6 | Yum Yum Sauce | Image | Local image — verify CC0 | 2 | 3 | 6 YELLOW | Document provenance. |
| 6 | Yum Yum Sauce | Attribution | Credited to Jason's BBQ Adventures (the recipe is widely circulated on AllRecipes under this name) | 1 | 2 | 2 GREEN | None. |
| 7 | Weeknight Family Chili ("Dad") | All dimensions | Original family recipe, original headnote prose, Unsplash photo | 1 | 1 | 1 GREEN | Verify Unsplash photo license. |
| 8 | Blueberry Ice Cream (Riverside Len / Food.com) | Headnote | "Deep purple summer blueberries simmered with sugar, strained to satin, and folded into half-and-half" — original | 1 | 1 | 1 GREEN | None. |
| 8 | Blueberry Ice Cream | Instructions | Functional. Notes explicitly references "The original card also notes: 'Try strawberry'" — a direct two-word quote from the Food.com submission. De minimis but flagged. | 2 | 2 | 4 GREEN | Replace the quotation with paraphrase: "The original suggests the same method works with strawberries." |
| 8 | Blueberry Ice Cream | Image | Local image — verify CC0 | 2 | 3 | 6 YELLOW | Document provenance. |
| 8 | Blueberry Ice Cream | Attribution | Riverside Len + Food.com both credited. Food.com Terms of Use (sec. 4–5 historically) grant Food.com a license from submitters but restrict third-party scraping; personal republication with attribution is a gray area. | 2 | 3 | 6 YELLOW | Read Food.com current ToS for republication. |
| 9 | Brown Butter Chocolate Chip Cookies ("Mom") | All dimensions | Original family recipe, original headnote, Unsplash photo | 1 | 1 | 1 GREEN | Verify Unsplash license. |
| 10 | Tall Buttermilk Pancakes ("Grandpa Joe") | All dimensions | Original family recipe, original headnote, Unsplash photo | 1 | 1 | 1 GREEN | Verify Unsplash license. |
| 11 | Banana Bread ("Family favorite") | Headnote | "The classic loaf — sweet, moist, and a way to rescue bananas just past their prime" — original | 1 | 1 | 1 GREEN | None. |
| 11 | Banana Bread | Instructions | Notes mention "The original recipe calls for ⅓ cup shortening; the handwritten family note swaps in vegetable or canola oil" — references a family card. If the underlying card was itself copied from a mid-century cookbook (Betty Crocker / Better Homes were the standard sources for banana bread in this format), there may be unknown provenance. Pre-1930 works are public domain; banana bread published 1930-onward (which most family-card sources are) is still under copyright in the U.S. depending on registration/renewal. | 1 | 2 | 2 GREEN | Low practical risk — ingredients + steps are facts. No action required, but be aware the recipe likely traces to a mid-century commercial source. |
| 11 | Banana Bread | Image | Unsplash hotlink | 2 | 2 | 4 GREEN | Verify Unsplash license. |
| 12 | Three-Cheese Baked Mac ("Aunt Mary") | All dimensions | Original family attribution, original headnote, Unsplash photo | 1 | 1 | 1 GREEN | Verify Unsplash license. |
| 13 | Grilled Salmon with Maple-Ginger Glaze (Al Roker) | Headnote | "Al Roker's Wednesday-night dinner" — original framing | 1 | 1 | 1 GREEN | None. |
| 13 | Grilled Salmon | Instructions | Functional. | 1 | 1 | 1 GREEN | None. |
| 13 | Grilled Salmon | Notes | **Direct verbatim quotation** of Al Roker: "I've been making this dish for at least 10 years. Salmon's a flavorful fish, and it stands up well to other flavors." This is original expression, copyrighted, used without license. Attribution does not cure the copying. Fair use analysis (Section 107) is weak: commercial-or-not factor cuts in favor, but the quote is the "heart" of his commentary and substitutes for reading his column. | 4 | 3 | 12 ORANGE | **Remove the verbatim quote.** Either delete the quoted sentence entirely or paraphrase ("Roker has spoken about making this dish for years and how well salmon stands up to bold flavors"). |
| 13 | Grilled Salmon | Image | Unsplash hotlink | 2 | 2 | 4 GREEN | Verify Unsplash license. |
| 13 | Grilled Salmon | Attribution | "Adapted from Al Roker's column for Parade" — credited | 2 | 3 | 6 YELLOW | Good attribution; pair with quote removal above. |
| 14 | Candied Carrots (Steve Cylka, The Black Peppercorn) | Headnote | "Baby carrots simmered tender, then tossed in a glossy butter-honey-brown-sugar glaze" — original phrasing | 1 | 1 | 1 GREEN | None. |
| 14 | Candied Carrots | Instructions | Functional. Step phrasing is concise and procedural. | 2 | 2 | 4 GREEN | Spot-check against blackpeppercorn.com for any sentence-level overlap; if so, rewrite. |
| 14 | Candied Carrots | Notes | "The cayenne is the secret: just enough heat to balance the sweetness without registering as spicy" — possibly close to Cylka's headnote phrasing on his blog. | 2 | 3 | 6 YELLOW | Verify against source; rewrite if substantially similar. |
| 14 | Candied Carrots | Image | Unsplash hotlink | 2 | 2 | 4 GREEN | Verify Unsplash license. |
| 14 | Candied Carrots | Attribution | "From Steve Cylka at The Black Peppercorn" — credited | 1 | 2 | 2 GREEN | None. |
| 15 | Inside-Out Cordon Bleu (Betty Crocker / General Mills) | Headnote | "The classic cordon bleu, deconstructed — panko-crusted chicken cutlets stacked with Swiss and ham, then bubbled under the broiler" — original | 1 | 1 | 1 GREEN | None. |
| 15 | Inside-Out Cordon Bleu | Instructions | The phrasing "Heat oven to 400°F. In a 10-inch ovenproof skillet, heat … Meanwhile, in a shallow bowl, stir together … In a second shallow bowl, beat … In a third shallow bowl, place …" tracks Betty Crocker's house style very closely. Specific procedural sequencing of "first / second / third shallow bowl" is a known BettyCrocker.com pattern. Functional steps are not protectable, but the cumulative expressive choices and specific transitional phrasing may be. | 3 | 3 | 9 YELLOW | Rewrite the instructions in original voice. Keep the procedure; vary the phrasing. General Mills is corporate IP and has the resources to send takedowns, though enforcement against personal sites is rare. |
| 15 | Inside-Out Cordon Bleu | Notes | "'Inside-out' means the cheese-and-ham stack is layered on top instead of rolled inside the chicken — much faster than the classic version" — original explanatory prose | 1 | 1 | 1 GREEN | None. |
| 15 | Inside-Out Cordon Bleu | Image | Local image — verify CC0 | 2 | 3 | 6 YELLOW | Document provenance. |
| 15 | Inside-Out Cordon Bleu | Attribution | "Betty Crocker" as author field. Acceptable as attribution; not a license. | 2 | 2 | 4 GREEN | None beyond rewrite above. |
| 16 | Pot Roast for Two (Chef Jean-Pierre) | Headnote | "Adapted from Chef Jean-Pierre — a weeknight-sized chuck roast braised with red wine, mushrooms, and root vegetables" — original | 1 | 1 | 1 GREEN | None. |
| 16 | Pot Roast for Two | Instructions | Functional. Asides like "On glass or ceramic cooktops, never exceed medium-high" and "you want tiny bubbles, not a rolling boil" sound like Chef Jean-Pierre's instructional voice from his YouTube videos. These specific phrasings may carry over from his transcribed video content. | 2 | 3 | 6 YELLOW | Spot-check against Chef Jean-Pierre's video transcripts / website. Rewrite borrowed asides in original voice. |
| 16 | Pot Roast for Two | Image | Local — `images/pot-roast/image1.png` — verify CC0 | 2 | 3 | 6 YELLOW | Document provenance. |
| 16 | Pot Roast for Two | Attribution | "Adapted from Chef Jean-Pierre" — credited | 1 | 2 | 2 GREEN | None. |
| 17 | Crock Pot Mississippi Pot Roast (Brandie @ The Country Cook) | Headnote | "Brandie's slow-cooker chuck roast — a packet of ranch dressing mix, a packet of dry onion soup mix, a stick of butter, and a handful of pepperoncini. Eight hours later it shreds with a fork." — original framing; the ingredient enumeration is factual. | 1 | 1 | 1 GREEN | None. |
| 17 | Mississippi Pot Roast | Instructions | Step phrasing is conventional ("Sear undisturbed until a deep crust forms", "Transfer the seared roast", "Pile onto plates over mashed potatoes, or onto hard rolls with melted provolone or mozzarella"). The serving suggestion echoes Brandie's published serving suggestion. | 2 | 2 | 4 GREEN | Spot-check phrasing against thecountrycook.net; minor rewrites if needed. |
| 17 | Mississippi Pot Roast | Notes | The "notes" reads as a paraphrase of Brandie's published tips — skip-browning shortcut, butter-not-margarine, sodium-sensitive swap, and the "leftovers on a sub roll with mozzarella" suggestion are all signature Brandie content. The phrasing here ("the leftovers on a sub roll with mozzarella and a few sliced peppers the next day are heavenly") is close enough to her voice that it reads as borrowed expression rather than original commentary. | 3 | 3 | 9 YELLOW | Rewrite the notes in fully original voice. Either remove the "Brandie says…" attributional framing and paraphrase as the site owner's own commentary, or shorten dramatically to functional tips only. |
| 17 | Mississippi Pot Roast | Image | **AI-generated**, inspired by a reference photo, with distinct composition per site-owner note. Under current U.S. Copyright Office guidance (*Thaler*, 2023; *Zarya of the Dawn*, 2023), AI-generated images are not copyrightable to the user but are also not per se infringing unless they reproduce protected expression from a specific source work. A "distinct composition and layout" is the right framing to avoid derivative-work exposure, but if the reference photo was a specific copyrighted image (e.g., Brandie's own photo from her blog) and the AI output is substantially similar in composition, lighting, and styling, infringement risk remains. | 3 | 3 | 9 YELLOW | Document which reference photo was used and capture a side-by-side comparison to confirm distinctness. If the reference was Brandie's own photo and the AI output reads as a copy, regenerate from a different reference or replace. |
| 17 | Mississippi Pot Roast | Attribution | "Recipe from thecountrycook.net" + author "Brandie @ The Country Cook" — credited | 2 | 3 | 6 YELLOW | Good attribution. Read The Country Cook's terms (most food blogs prohibit republication of full recipes even with attribution — they prefer "link to the recipe" or "ingredients + your own steps"). |

### Selection and Arrangement (Compilation Copyright)

The cookbook's selection of 17 recipes spans original family material, attributed cookbook authors, attributed media personalities, and attributed food bloggers — no evidence of mirroring any single source cookbook's table of contents. Categories (Mains / Sides / Appetizers / Sauces / Breakfast / Desserts) are functional taxonomy, not creative arrangement. **Compilation copyright risk: GREEN (1×1=1)**. No action required.

---

## 3. Priority Remediation Queue

Ordered by risk score and ease of fix.

1. **Remove the verbatim Al Roker quote (Recipe 13, Notes).** Single sentence; the quotation is the clearest infringement in the cookbook. Replace with paraphrase. **5-minute fix.**
2. **Verify all 12 locally hosted images.** Confirm CC0 license per file for the Unsplash hotlinks (URL-based, easy to audit) and document the source/license for each `cookbook/images/<recipe>/*.png` asset. The Keller chicken folder (4 images) is the highest-priority subset. **30-60 min.**
3. **Rewrite Thomas Keller instruction text (Recipe 4).** Pull *Ad Hoc at Home* (2009), compare line-by-line, paraphrase any sentence that tracks the published version expressively. Keep the procedure, change the words. **45-60 min.**
4. **Rewrite Mississippi Pot Roast notes (Recipe 17).** Strip the "Brandie says…" framing and replace with original commentary in the site owner's voice, or shorten to functional tips only. **15 min.**
5. **Rewrite Inside-Out Cordon Bleu instruction phrasing (Recipe 15).** Vary the "first shallow bowl / second shallow bowl / third shallow bowl" cadence and other Betty-Crocker-house-style transitions. **20 min.**
6. **Verify Mississippi Pot Roast AI-image distinctness (Recipe 17).** Confirm the reference photo and capture a side-by-side comparison to support the "distinct composition" representation. **15 min.**
7. **Clean up Sunday Roast Chicken notes (Recipe 3).** Rewrite "Hello my friends!" opener to avoid Chef Jean-Pierre voice cross-pollination. **2 min.**
8. **Spot-check Steve Cylka, Chef Jean-Pierre, and Brandie source phrasing.** Compare individual sentences against the source blogs/videos and rewrite any close-tracking expression. **30-45 min combined.**
9. **Read each named source's site terms.** Food.com, The Country Cook, The Black Peppercorn, Tasty Kitchen — confirm personal/non-commercial republication-with-attribution stance. **30 min.**
10. **Paraphrase "Try strawberry" two-word quote in Blueberry Ice Cream notes (Recipe 8).** De minimis but trivial to fix. **30 seconds.**

Completing items 1-7 moves the cookbook from "two ORANGE + six YELLOW" to "all-GREEN, all-YELLOW image-verification queue."

---

## 4. Green-Lit Inventory

The following items are already in the clear and require no remediation beyond the standard Unsplash license verification noted in the priority queue.

| Item | Reasoning |
|---|---|
| **Recipe ingredient lists, all 17 recipes** | Bare ingredient lists are unprotectable facts (*Publications International v. Meredith Corp.*, 88 F.3d 473 (7th Cir. 1996)). |
| **Recipe functional preparation steps, all 17 recipes** | Procedural steps are unprotectable methods. Expressive instruction wording is a separate issue addressed per-recipe above. |
| **Selection and arrangement of the 17 recipes** | Original compilation; no mirroring of a source cookbook's structure. Compilation copyright clean. |
| **Lemon Garlic Baked Tenderloin (Recipe 1)** | Family source + transformative ("reimagined bright with lemon and garlic"). |
| **Wanda's Lasagna (Recipe 2)** | Family source; original prose. |
| **Weeknight Family Chili (Recipe 7)** | Original family recipe. |
| **Brown Butter Chocolate Chip Cookies (Recipe 9)** | Original family recipe. |
| **Tall Buttermilk Pancakes (Recipe 10)** | Original family recipe. |
| **Banana Bread (Recipe 11)** | Functional ingredients/steps; family card; no expressive borrowing visible. |
| **Three-Cheese Baked Mac (Recipe 12)** | Original family recipe. |
| **Fried Artichoke Hearts headnote and instructions (Recipe 5)** | Original prose; functional steps. Image is the only open dimension. |
| **Yum Yum Sauce headnote and instructions (Recipe 6)** | Original prose; trivial method. Image is the only open dimension. |
| **Tag taxonomy (`Protein / Vegetable / Pantry / Brightness`)** | Functional categorization, not creative expression. |
| **Recipe-card UI design (rustic aesthetic, fonts, layout)** | Original site design; no derivative-design concerns identified. |

---

## 5. Escalation Flags — Outside Counsel Consult

The following items warrant a brief consult with an IP attorney before publication confidence is high. None rise to the level of mandatory engagement (no active litigation, no government inquiry, no demand letter received), but they touch on protected creative works from rights-holders with the resources to enforce.

| Flag | Why It Warrants Consult |
|---|---|
| **Thomas Keller / *Ad Hoc at Home* recipe (Recipe 4)** | Published cookbook from an actively-enforced publisher (Artisan / Workman / Hachette). The instruction text needs side-by-side comparison against the source before publication. An attorney with cookbook-copyright experience can quickly assess whether the rewrite is sufficient. |
| **AI-generated image of Mississippi Pot Roast (Recipe 17)** | AI-image copyright is a fast-moving area: the U.S. Copyright Office's guidance has been refined three times since 2023 (*Thaler* 2023, *Zarya of the Dawn* 2023, the March 2025 report on copyrightability). The substantive infringement risk depends on the reference photo and the visual similarity of the output. An IP attorney can advise on the current safe-harbor framing and any disclosure best practices. |
| **Direct verbatim quote from Al Roker (Recipe 13)** | Fair-use analysis under §107 is fact-specific; an attorney can confirm whether the planned paraphrase is sufficient or whether the entire "Al's tip" framing should be removed. (Note: this is straightforward enough that removing the quote may obviate the need for the consult.) |
| **Food-blog republication terms (Recipes 5, 6, 8, 14, 17)** | Site terms of service can impose contractual restrictions on republication beyond what copyright law requires — and breaching ToS can be actionable separately. An attorney can scan each site's current ToS and advise on whether attribution-only personal republication is permitted. |
| **Recipe 15 (Betty Crocker / General Mills)** | Corporate IP. Risk of enforcement against a personal site is low in practice but General Mills has the legal infrastructure to send takedowns. An attorney can advise on the rewrite threshold for safe republication. |

A single 30-60 minute consult covering all five flags above is likely sufficient. None is individually urgent.

---

## 6. Methodology and Assumptions

- The legal framework applied is U.S. copyright law (Title 17, U.S.C.), specifically the doctrine that recipe ingredient lists and functional preparation steps are unprotectable facts/procedures, while headnotes, expressive descriptions, photographs, illustrations, and creative selection-and-arrangement of compilations are protected.
- Severity and likelihood ratings reflect the practical posture of a non-commercial personal site (chases.house) with no apparent commercial use. Severity ratings would generally trend higher for a monetized site.
- Site terms of service create contractual obligations independent of copyright. The audit flags ToS exposure but does not assess specific terms — each source site's current ToS should be reviewed.
- Image provenance was assessed at the file-listing level only; per-image verification of CC0 licensing (for Unsplash hotlinks) and per-file documentation of source (for locally hosted images) is recommended as part of the remediation queue.
- The Mississippi Pot Roast image is treated as AI-generated per the site owner's representation. The audit assumes the "distinct composition and layout" characterization is accurate; verification via side-by-side comparison to the reference is recommended.
- Attribution is treated throughout as courtesy, not as a license. Crediting a source does not authorize the use of protected expression from that source.

---

## 7. Not Legal Advice

This document is a structured internal audit conducted using the `legal:compliance-check` and `legal:legal-risk-assessment` skill frameworks. It is **not legal advice** and does not establish an attorney-client relationship. Copyright law is fact-specific and jurisdiction-specific; the risk classifications above are starting-point assessments to inform remediation priorities, not legal conclusions. Before publishing in any high-stakes context or in response to any demand letter, takedown notice, or rights-holder inquiry, the site owner should consult a qualified intellectual property attorney admitted in the relevant jurisdiction. Regulatory guidance on AI-generated content is evolving; current U.S. Copyright Office positions should be verified before relying on the AI-image framing in §2 (Recipe 17) and §5.
