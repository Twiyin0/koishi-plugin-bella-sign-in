import { Random, Time } from 'koishi'
import crypto from 'crypto'

export type RpsChoice = 'rock' | 'paper' | 'scissors'
export type RpsOutcome = 'win' | 'draw' | 'lose'
export type DiceOutcome = 'lose' | 'draw' | 'win'

export const MAX_DICE_COST = 1000
export const MAX_DICE_REWARD = 4000

export interface DiceNotation {
  count: number
  sides: number
}

export interface DailyProfile {
  title: string
  color: string
  food: string
  activity: string
  avoid: string
  direction: string
}

const rpsAliases: Record<string, RpsChoice> = {
  '石头': 'rock',
  '拳头': 'rock',
  'rock': 'rock',
  'r': 'rock',
  '布': 'paper',
  'paper': 'paper',
  'p': 'paper',
  '剪刀': 'scissors',
  'scissors': 'scissors',
  'scissor': 'scissors',
  's': 'scissors',
}

export const rpsLabels: Record<RpsChoice, string> = {
  rock: '✊ 石头',
  paper: '✋ 布',
  scissors: '✌️ 剪刀',
}

const dailyOptions: Record<keyof DailyProfile, string[]> = {
  title: ['摸鱼大师', '人形锦鲤', '气氛组王牌', '灵感捕手', '甜品鉴赏家', '行动派主角', '好运充电宝', '冷静观察员'],
  color: ['樱花粉', '晴空蓝', '薄荷绿', '葡萄紫', '奶油白', '柠檬黄', '珊瑚橙', '星夜黑'],
  food: ['草莓蛋糕', '拉面', '火锅', '烤肉', '奶茶', '炸鸡', '寿司', '冰淇淋'],
  activity: ['大胆表达想法', '整理桌面', '和朋友聊天', '尝试新事物', '早点休息', '出门散步', '完成拖延的小事', '奖励自己'],
  avoid: ['冲动消费', '熬夜硬撑', '反复内耗', '空腹工作', '和杠精争论', '把话说太满', '临时改需求', '连续抽奖'],
  direction: ['东', '南', '西', '北', '东南', '西南', '东北', '西北'],
}

function stableIndex(seed: string, key: string, length: number): number {
  const digest = crypto.createHash('sha256').update(`${seed}:${key}`).digest()
  return digest.readUInt32BE(0) % length
}

export function getDailyProfile(uid: string | number, date = new Date()): DailyProfile {
  const seed = `${uid}:${Time.template('yyyy-MM-dd', date)}`
  return Object.fromEntries(Object.entries(dailyOptions).map(([key, values]) => [
    key,
    values[stableIndex(seed, key, values.length)],
  ])) as unknown as DailyProfile
}

export function parseDiceNotation(input = '1d6'): DiceNotation | string {
  const notation = input.trim().toLowerCase()
  const plainSides = /^\d+$/.test(notation) ? Number(notation) : undefined
  const matched = /^(\d*)d(\d+)$/.exec(notation)
  const count = plainSides === undefined ? Number(matched?.[1] || 1) : 1
  const sides = plainSides ?? Number(matched?.[2])

  if (!matched && plainSides === undefined) return '格式不对哦，请使用“骰子 2d6”或“骰子 20”。'
  if (!Number.isInteger(count) || count < 1 || count > 20) return '一次可以投 1～20 颗骰子。'
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) return '骰子面数需要在 2～1000 之间。'
  return { count, sides }
}

export function rollDice(notation: DiceNotation): number[] {
  return Array.from({ length: notation.count }, () => Random.int(1, notation.sides + 1))
}

export function getDiceCost(notation: DiceNotation): number {
  return 3 * notation.count + notation.sides
}

export function pickDiceOutcome(): DiceOutcome {
  return Random.weightedPick({ lose: 0.4, draw: 0.4, win: 0.2 }) as DiceOutcome
}

export function getDiceReward(notation: DiceNotation, dice: number[], outcome: DiceOutcome): number {
  const cost = getDiceCost(notation)
  if (outcome === 'lose') return 0
  if (outcome === 'draw') return cost

  const minimumTotal = notation.count
  const maximumTotal = notation.count * notation.sides
  const total = dice.reduce((sum, value) => sum + value, 0)
  const rollRate = maximumTotal === minimumTotal ? 0 : (total - minimumTotal) / (maximumTotal - minimumTotal)
  return Math.min(MAX_DICE_REWARD, Math.floor(cost * (2 + 2 * rollRate)))
}

export function normalizeRpsChoice(input: string): RpsChoice | undefined {
  return rpsAliases[input?.trim().toLowerCase()]
}

export function randomRpsChoice(exclude?: RpsChoice): RpsChoice {
  const choices: RpsChoice[] = ['rock', 'paper', 'scissors']
  const available = exclude ? choices.filter(choice => choice !== exclude) : choices
  return available[crypto.randomInt(available.length)]
}

export function playRps(player: RpsChoice, computer?: RpsChoice): { computer: RpsChoice, outcome: RpsOutcome } {
  computer ??= randomRpsChoice()

  if (player === computer) return { computer, outcome: 'draw' }
  const wins = (player === 'rock' && computer === 'scissors')
    || (player === 'paper' && computer === 'rock')
    || (player === 'scissors' && computer === 'paper')
  return { computer, outcome: wins ? 'win' : 'lose' }
}
