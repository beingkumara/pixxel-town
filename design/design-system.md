# Pixel Town design system

Source: Refero Styles extractions of Discord (faec4b0c…) and MekaVerse (09e43758…), combined as a
Discord-led hybrid. This file is the System critic's only reference.

## Direction

A game world behind a chat bubble. Discord supplies the environment, colour system and controls;
MekaVerse supplies how the world is presented: rendered art framed as a museum piece, hairline edges
and mono chrome.

## Colour

| Token | Hex | Rule |
| --- | --- | --- |
| Cosmic page | `#0E0F2D` | Page environment. Never a white or light-grey page background. |
| App chrome | `#23272A` | Inputs, control trays |
| App surface | `#2C2F33` | Elevated panels, message bubbles |
| Blurple | `#5865F2` | **Primary CTA and focus only.** Never a large background area. Hover `#3442D9`. |
| Spring green | `#57F287` | Online / success only |
| Fuchsia | `#EB459E` | Proximity whisper (DM) semantics |
| Vivid cerulean | `#00B0F4` | Voice/video and room semantics |
| Ember orange | `#FDA220` | Highlights (the town) |
| Ekko red | `#DE2761` | Destructive / alerts |
| Snow | `#FFFFFF` | Primary text on dark |
| Fog | `#BABCD9` | Body text on dark where white would overpower headlines |
| Greyple | `#99AAB5` | Placeholders and metadata only, never primary text |
| Dim grey | `#50555F` | Input borders and dividers, never primary text |
| Frost hairline | `#E2E2E2` at low opacity | 1px borders and dividers |

## Typography

- **Display:** a heavy (800–900), wide geometric grotesk standing in for ABC Ginto Nord. Always
  ALL CAPS, tracking −0.01em, line-height 0.86–1.0. Mixed-case display type is forbidden, and so is
  gradient text on headlines.
- **Body:** a clean grotesk (Ginto / Inter class), 400–500, 16px base (20px for large body),
  line-height 1.4–1.5, tracking about +0.013em.
- **Chrome:** a mono (GT America Mono / JetBrains Mono class), 10–12px, tracking −0.02em, for nav
  labels, micro-labels and metadata.
- Scale (minor third from a 14px base, per the Refero source): body-sm 14 · body 16 · body-lg 20 ·
  heading-sm 36 · heading 48 · display 56–80. body-sm is for secondary copy (subtitles, helper text).
- At most two families plus the mono chrome face.

## Shape and space

- 4px base unit. Spacing: 4 8 12 16 20 24 32 40 48 56 80.
- Radii: buttons 12px (never below), large buttons and cards 16px, feature panels 24px,
  frame/containers 20px, pills 104px.
- **No box-shadows anywhere.** Depth comes from surface contrast, overlap and scale only.

## Components

- **Primary CTA:** blurple fill, white text, 12px radius, generous padding (about 19px 24px). One per view.
- **Secondary CTA:** white fill, `#23272A` text, 12px radius.
- **Ghost/nav button:** transparent, 1px white or hairline border, 12px radius.
- **Nav:** a flat, full-width, transparent strip with no shadow. Logo left, links, action right.
- **Feature panels:** each section gets its own gradient or solid environment to separate it; 24px radius.
- **World art:** full-bleed or framed with a hairline and a 20px radius. Never wrapped in a
  card with padding or a shadow. Content sits over or beside it, left-aligned.
- **Display titles:** left-aligned, never centred.
