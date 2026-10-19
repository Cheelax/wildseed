# Wildseed

A field naturalist's pocket hatchery: pale sage paper, dark evergreen ink, an intimate pixel diorama, and oversized curious eyes. Each species has a deliberately different silhouette. No borrowed game characters or image assets.

## Tokens
Paper #f1f3e8, ink #203a32, secondary #5b7064, line #cbd5c4, action #294f3b. System sans for labels, Georgia for creature names. Spacing 4, 8, 12, 16, 24, 32, 48 px. Rounded 12 px buttons; minimum hit area 44 px.

## Layout and primitives
Header wordmark and sound toggle. Desktop: central diorama with 320 px field-note card alongside. Seed form immediately below the scene. Mobile stacks scene, form, card, export controls with no horizontal scroll. Error text reserves its row. Stats use labeled numeric meters. Export feedback uses one live status.

## Art and motion
Procedural 3D meshes, six species: bellfin (fins), bramblebun (long ears), lanternmoth (wide wings), pebblepup (floppy ears and tail), sproutling (tall leaf crest), tumbletoad (wide body and squat legs). Palette-driven toon shading, outline shell, pixel-shaped faces. Shared 4 CSS px raster grid for egg, creature, shadows and ground. Nearest-neighbor scaling; no temporal antialiasing. Orbital camera drag, pointer gaze, blink, breathing, tap bounce, genome cry. Rare creatures have a gold orbital halo and altered palette.

## Accessibility and configuration
Native form and buttons, visible focus, explicit input label, readable text contrast, reduced motion keeps expressive eyes but disables bounce. Sound starts only from a gesture and can be muted. Render pixel scale, animation duration and export frames are named constants. Seed validation never discards the current creature.

## Genome compatibility
Version 1 uses UTF-8 FNV-1a plus an explicitly unsigned integer PRNG. Species ids and call order are part of the public format. New rounds append fields; fixture tests protect existing output.
