import { Apple } from 'lucide-react'
import type { GameMeta } from '@/lib/games/types'

export const game1Meta: GameMeta = {
  slug: 'game-1', code: 'GAME_01', title: '사과 먹기', short: '입을 벌려 움직이는 사과를 먹어보세요', description: '캐릭터 얼굴을 내 얼굴에 맞춘 뒤, 60초 안에 사과 10개를 모두 먹는 웹캠 게임이에요.', tag: 'FACE TRACKING', icon: Apple, accent: '#ff6574', checks: ['웹캠 권한을 허용하기', '얼굴이 화면에 잘 보이게 하기', '캐릭터 이미지의 얼굴 기준점 5곳 지정하기'],
}
