import { router } from 'expo-router'
import type { AnimationObject } from 'lottie-react-native'
import { IntroPager, type IntroSlideContent } from '../src/components/intro/IntroPager'
import { useIntroStore } from '../src/stores/intro'
import slide1 from '../assets/splash/slide-1.json'
import slide2 from '../assets/splash/slide-2.json'
import slide3 from '../assets/splash/slide-3.json'

const SLIDES: IntroSlideContent[] = [
  {
    source: slide1 as unknown as AnimationObject,
    eyebrow: 'Your vault',
    headline: 'A private place for what matters to you.',
    body: 'Halo remembers your tastes, routines, and history — encrypted, and yours alone.',
  },
  {
    source: slide2 as unknown as AnimationObject,
    eyebrow: 'Ask anything',
    headline: 'One conversation, fluent in you.',
    body: 'Your agent speaks with outside tools so your raw data never has to leave.',
  },
  {
    source: slide3 as unknown as AnimationObject,
    eyebrow: 'Luzern, for starters',
    headline: 'Local recommendations that actually fit.',
    body: 'Restaurants, spots, and plans shaped by what you already love — and what you already told Halo.',
  },
]

export default function IntroScreen() {
  const markSeen = useIntroStore((s) => s.markSeen)

  const finish = () => {
    markSeen()
    router.replace('/')
  }

  return <IntroPager slides={SLIDES} onFinish={finish} />
}
