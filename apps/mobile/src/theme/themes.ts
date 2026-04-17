import { createThemes, defaultComponentThemes } from '@tamagui/theme-builder'
import { yellow, yellowDark, red, redDark, green, greenDark } from '@tamagui/colors'

const darkPalette = [
  'hsla(205, 20%, 8%, 1)',
  'hsla(205, 20%, 12%, 1)',
  'hsla(205, 19%, 17%, 1)',
  'hsla(205, 19%, 21%, 1)',
  'hsla(205, 18%, 25%, 1)',
  'hsla(205, 18%, 62%, 1)',
  'hsla(205, 19%, 70%, 1)',
  'hsla(205, 19%, 78%, 1)',
  'hsla(205, 20%, 49%, 1)',
  'hsla(205, 20%, 55%, 1)',
  'hsla(205, 15%, 85%, 1)',
  'hsla(205, 10%, 95%, 1)',
]
const lightPalette = [
  'hsla(260, 30%, 93%, 1)', // 1  — light lavender (backgrounds)
  'hsla(260, 20%, 97%, 1)', // 2  — near-white (input bg, cards)
  'hsla(260, 18%, 96%, 1)', // 3  — subtle bg (appearance box, etc.)
  'hsla(205, 13%, 88%, 1)', // 4  — border
  'hsla(205, 12%, 83%, 1)', // 5  — muted border / outline button
  'hsla(205, 13%, 53%, 1)', // 6  — placeholder text
  'hsla(205, 13%, 42%, 1)', // 7  — secondary text
  'hsla(205, 14%, 32%, 1)', // 8  — mid contrast
  'hsla(205, 15%, 43%, 1)', // 9  — body text
  'hsla(205, 17%, 35%, 1)', // 10 — strong text
  'hsla(205, 22%, 22%, 1)', // 11 — heading text
  'hsla(205, 28%, 11%, 1)', // 12 — highest contrast
]

// ALZ Purple accent — derived from Alzheimer's Association brand
// #0F1633 (hsla(228, 55%, 13%)) as deep anchor
// #4A0D66 / R74 G13 B102 / Pantone 2617 (hsla(281, 77%, 23%)) as hero purple
// Hue shifts from 260° (indigo-violet) in subtle steps to 275° (rich purple)
// in hero steps, blending the navy anchor with ALZ Purple
const accentLight = [
  'hsla(260, 30%, 97%, 1)', // 1  — faintest violet tint (backgrounds)
  'hsla(262, 36%, 93%, 1)', // 2  — subtle hover bg
  'hsla(264, 40%, 88%, 1)', // 3  — light border
  'hsla(266, 44%, 82%, 1)', // 4  — selected bg
  'hsla(264, 52%, 71%, 1)', // 5  — muted fill / outline border
  'hsla(264, 56%, 62%, 1)', // 6  — secondary text / disabled fill
  'hsla(263, 60%, 54%, 1)', // 7  — focus ring / hover border
  'hsla(262, 65%, 46%, 1)', // 8  — button fill (vibrant hero purple)
  'hsla(266, 68%, 38%, 1)', // 9  — solid indicator (progress, badges)
  'hsla(274, 68%, 34%, 1)', // 10 — deep accent (near ALZ Purple)
  'hsla(278, 74%, 24%, 1)', // 11 — high-contrast text (links, labels)
  'hsla(281, 77%, 14%, 1)', // 12 — ultra-high-contrast (anchored to #0F1633 depth)
]

const accentDark = [
  'hsla(260, 30%, 97%, 1)', // 1  — light foreground on solid accent fills (matches accentLight[0])
  'hsla(262, 42%, 16%, 1)', // 2  — subtle hover bg
  'hsla(264, 44%, 20%, 1)', // 3  — light border
  'hsla(266, 46%, 25%, 1)', // 4  — selected bg
  'hsla(268, 48%, 31%, 1)', // 5  — muted fill
  'hsla(270, 50%, 37%, 1)', // 6  — secondary text
  'hsla(272, 52%, 44%, 1)', // 7  — focus ring / hover border
  'hsla(275, 54%, 52%, 1)', // 8  — button fill
  'hsla(275, 50%, 62%, 1)', // 9  — solid indicator
  'hsla(272, 48%, 70%, 1)', // 10 — vivid accent
  'hsla(268, 42%, 86%, 1)', // 11 — high-contrast text (light on dark)
  'hsla(264, 36%, 94%, 1)', // 12 — ultra-high-contrast text
]

// Override step 1 in dark child palettes so $color1 stays light for
// foreground on solid fills (buttons/badges) in both light and dark modes.
const redDarkValues = Object.values(redDark)
const errorDarkPalette = [red.red1, ...redDarkValues.slice(1)]

const builtThemes = createThemes({
  componentThemes: defaultComponentThemes,
  base: {
    palette: { light: lightPalette, dark: darkPalette },
  },
  accent: {
    palette: { light: accentLight, dark: accentDark },
  },
  childrenThemes: {
    warning: { palette: { light: Object.values(yellow), dark: Object.values(yellowDark) } },
    error: { palette: { light: Object.values(red), dark: errorDarkPalette } },
    success: { palette: { light: Object.values(green), dark: Object.values(greenDark) } },
  },
})

export type Themes = typeof builtThemes

// the process.env conditional here is optional but saves web client-side bundle
// size by leaving out themes JS. tamagui automatically hydrates themes from CSS
// back into JS for you, and the bundler plugins set TAMAGUI_ENVIRONMENT. so
// long as you are using the Vite, Next, Webpack plugins this should just work,
// but if not you can just export builtThemes directly as themes:
export const themes: Themes =
  process.env.TAMAGUI_ENVIRONMENT === 'client' && process.env.NODE_ENV === 'production'
    ? ({} as Themes)
    : builtThemes
