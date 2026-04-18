import { createThemes, defaultComponentThemes } from '@tamagui/theme-builder'
import { yellow, yellowDark, red, redDark, green, greenDark } from '@tamagui/colors'

const darkPalette = [
  'hsla(215, 28%, 7%, 1)',
  'hsla(215, 26%, 11%, 1)',
  'hsla(215, 24%, 15%, 1)',
  'hsla(215, 22%, 19%, 1)',
  'hsla(215, 20%, 24%, 1)',
  'hsla(215, 18%, 60%, 1)',
  'hsla(215, 18%, 70%, 1)',
  'hsla(215, 18%, 78%, 1)',
  'hsla(215, 20%, 49%, 1)',
  'hsla(215, 20%, 55%, 1)',
  'hsla(215, 16%, 86%, 1)',
  'hsla(215, 12%, 95%, 1)',
]
const lightPalette = [
  'hsla(215, 30%, 97%, 1)', // 1  — crisp cool white (backgrounds)
  'hsla(215, 25%, 98%, 1)', // 2  — near-white (input bg, cards)
  'hsla(215, 20%, 96%, 1)', // 3  — subtle bg (appearance box, etc.)
  'hsla(215, 18%, 89%, 1)', // 4  — border
  'hsla(215, 16%, 83%, 1)', // 5  — muted border / outline button
  'hsla(215, 14%, 52%, 1)', // 6  — placeholder text
  'hsla(215, 16%, 40%, 1)', // 7  — secondary text
  'hsla(215, 20%, 30%, 1)', // 8  — mid contrast
  'hsla(215, 22%, 40%, 1)', // 9  — body text
  'hsla(215, 26%, 30%, 1)', // 10 — strong text
  'hsla(218, 34%, 18%, 1)', // 11 — heading text
  'hsla(220, 45%, 9%, 1)', // 12 — highest contrast
]

// Presidential Blue accent — institutional, weighty, diplomatic.
// Anchored on Pantone 287 C (#002A86 ≈ hsla(219, 100%, 26%)) — the blue
// used in the US presidential seal, NATO flag, and UN insignia. Hue 215°–222°,
// saturation pushed to 95–96% on hero/text steps for near-monochromatic depth.
const accentLight = [
  'hsla(218, 60%, 97%, 1)', // 1  — faintest institutional tint (backgrounds)
  'hsla(218, 55%, 94%, 1)', // 2  — subtle hover bg
  'hsla(219, 52%, 88%, 1)', // 3  — light border
  'hsla(219, 55%, 81%, 1)', // 4  — selected bg
  'hsla(219, 58%, 69%, 1)', // 5  — muted fill / outline border
  'hsla(219, 64%, 56%, 1)', // 6  — secondary text / disabled fill
  'hsla(219, 72%, 45%, 1)', // 7  — focus ring / hover border
  'hsla(219, 82%, 34%, 1)', // 8  — button fill (deep presidential)
  'hsla(219, 95%, 26%, 1)', // 9  — solid indicator (Pantone 287 C anchor)
  'hsla(220, 96%, 19%, 1)', // 10 — deep state blue
  'hsla(221, 96%, 13%, 1)', // 11 — high-contrast text (links, labels)
  'hsla(222, 96%, 7%, 1)', // 12 — ultra-high-contrast (near-black seal depth)
]

const accentDark = [
  'hsla(218, 60%, 97%, 1)', // 1  — light foreground on solid accent fills (matches accentLight[0])
  'hsla(220, 42%, 12%, 1)', // 2  — subtle hover bg
  'hsla(220, 46%, 17%, 1)', // 3  — light border
  'hsla(221, 50%, 22%, 1)', // 4  — selected bg
  'hsla(221, 56%, 30%, 1)', // 5  — muted fill
  'hsla(221, 62%, 38%, 1)', // 6  — secondary text
  'hsla(220, 68%, 47%, 1)', // 7  — focus ring / hover border
  'hsla(220, 78%, 56%, 1)', // 8  — button fill
  'hsla(220, 80%, 64%, 1)', // 9  — solid indicator
  'hsla(219, 72%, 74%, 1)', // 10 — vivid accent
  'hsla(218, 56%, 86%, 1)', // 11 — high-contrast text (light on dark)
  'hsla(218, 44%, 94%, 1)', // 12 — ultra-high-contrast text
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
