import { createFont, createTamagui } from 'tamagui'
import { defaultConfig } from '@tamagui/config/v5'
import { animations } from '@tamagui/config/v5-rn'
import { themes } from './src/theme/themes'

// Android system font face mapping — applied on all platforms (harmless on iOS,
// which ignores unrecognized family names and falls back to SF Pro).
// Avoids importing `Platform` from react-native, which breaks the Tamagui
// babel plugin's Node.js config evaluator.
const systemFace = {
  400: { normal: 'sans-serif' },
  600: { normal: 'sans-serif-medium' },
  700: { normal: 'sans-serif-medium' },
  800: { normal: 'sans-serif-bold' },
  900: { normal: 'sans-serif-black' },
}

const brandFont = createFont({
  family: 'BrunoAceSC_400Regular',
  size: defaultConfig.fonts.heading.size,
  lineHeight: defaultConfig.fonts.heading.lineHeight,
  weight: { 4: '400' },
  letterSpacing: defaultConfig.fonts.heading.letterSpacing,
})

const headingFont = createFont({
  ...defaultConfig.fonts.heading,
  face: systemFace,
})

const bodyFont = createFont({
  ...defaultConfig.fonts.body,
  face: systemFace,
})

const config = createTamagui({
  ...defaultConfig,
  themes,
  animations,
  fonts: {
    ...defaultConfig.fonts,
    body: bodyFont,
    heading: headingFont,
    brand: brandFont,
  },
  settings: {
    ...defaultConfig.settings,
    disableSSR: true,
    onlyAllowShorthands: false,
  },
})

type AppConfig = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
