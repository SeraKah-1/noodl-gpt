---
name: noodl-visual-learning
description: Use when creating or revising Noodl learning comics, illustrations, diagrams, visualizations, or visual designs. Clarify the user's learning needs and style before design, prioritize factual accuracy, and inspect the actual result before presenting it as reviewed.
---

# Noodl visual learning

## Clarify before design

Before creating a new storyboard, comic, illustration, visualization, or visual design, ask the user a short clarification and wait for the answer. Establish the learning objective and scope, audience and depth, source material, language, desired style or reference, panel count or format, and any character or representation preferences. Reuse details already supplied; ask about missing decisions together. If everything is already explicit, briefly confirm the assembled brief before the first design. A user correction authorizes the requested revision; do not repeatedly ask for unchanged preferences. Clarify a new style direction if a revision leaves it ambiguous.

Do not treat “make a comic” as consent to your favorite style. Do not select minimalism, editorial styling, manga, realism, a palette, or visual density merely because it looks attractive. A user's request for detailed, colorful, dense, realistic, or another style takes priority over generic design heuristics. Accuracy, understandable mechanisms, and the user's chosen style are the success criteria. Avoid removing information just to make a panel cleaner.

Record the real user confirmation in the brief. Never fabricate a quote, approval, source, attachment, or completed check. Silence is not confirmation.

## Plan and create

Read `get_capabilities` and `get_comic_guide` before storing a comic. Read the target bank and its revision. A comic is an artifact with `kind: comic`; `content` is a JSON string matching the returned document schema. Banks still require at least one question. Ask for a target bank if the destination is unclear; do not invent a question to satisfy a storage constraint.

After clarification, develop the factual sequence first. Each panel should teach one connected step, with a caption, readable dialogue, an accessible description, and an illustration. Separate literal anatomy, quantities, and mechanisms from personification or metaphor. Verify factual claims against actual supplied material or appropriate authoritative sources. Cite the specific source/page/section when available. Do not imply that dramatic scale, colors, or talking cells are literal science. Resolve conflicting sources or flag uncertainty.

Use available native image generation when appropriate to the agreed style. Inspect any supplied reference before editing it. Noodl does not call image providers itself. Image generation in chat does not automatically transfer an image into Noodl. Use embedded PNG/JPEG/WebP data only when the actual bytes are available and fit the guide's limit. Never invent a download link or pretend a chat attachment is already stored. Static standalone SVG illustrations are also supported when consistent with the agreed style. Do not silently substitute SVG for requested photographic or hand-painted artwork. If transfer is unavailable, explain it and offer the actual image in chat plus a clearly labeled draft storyboard in Noodl.

Keep dialogue and captions as separate text in the saved document even when the artwork contains lettering. Preserve stable panel IDs for edits. Do not put remote resources or scripts in illustrations. Stay within limits returned by `get_comic_guide`.

## Inspect every result, including revisions

Before declaring completion:

1. Inspect the actual generated image or rendered comic at readable size. A prompt, SVG source, JSON validator, or successful save is not a visual inspection. If the required viewer is unavailable, say so and keep the comic `draft`.
2. Check factual accuracy against sources, causal direction, sequence, anatomy or geometry when relevant, terminology, units, numbers, and misleading analogies.
3. Read every caption, label, and speech bubble. Correct misspellings, clipped text, mismatched speakers, duplicated panels, inconsistent characters, and unreadable lettering.
4. Compare the result with the user's confirmed style, audience, language, and requested format. Do not “improve” it toward an unrequested aesthetic.
5. Fix findings and repeat the affected checks on the revised result. Record unresolved issues plainly. Mark `reviewed` only when all checks are actually complete, every panel has an illustration, actual sources are recorded, and unresolved issues are empty.
6. Save with `create_artifact` or `update_artifact` using the current `expectedRevision` and a fresh `operationId`. Reuse an operation ID only for an identical retry. Read back with `get_artifact` and compare panels, text, sources, style, and review notes. Reopen the saved view when the host permits it. If saved rendering cannot be checked, report that separately.

The review record is a creator report, not an independent scientific certification. Do not claim automated factual verification. Report concrete checks, corrections, and limitations briefly in the final response and link/open the saved bank when available.

Apply the same accuracy-first, user-style, clarify-before-design and inspect-after-creation rules to other Noodl visual artifacts. Pure factual text answers do not require a design clarification. Do not change unrelated data or share private banks as part of making a comic.
