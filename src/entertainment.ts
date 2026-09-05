import { Random, Time } from 'koishi'
import crypto from 'crypto'

export type RpsChoice = 'rock' | 'paper' | 'scissors'
export type RpsOutcome = 'win' | 'draw' | 'lose'
export type DiceOutcome = 'lose' | 'draw' | 'win'

export const MAX_DICE_COST = 1000
export const MAX_DICE_PROFIT = 4000

export interface DiceNotation {
  count: number
  sides: number
}

export interface DiceEvaluation {
  outcome: DiceOutcome
  percentile: number
  profit: number
  reward: number
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
  if (!Number.isInteger(count) || count < 1 || count > 10) return '一次可以投 1～10 颗骰子。'
  if (!Number.isInteger(sides) || sides < 3 || sides > 997) return '骰子面数需要在 3～997 之间。'
  return { count, sides }
}

export function rollDice(notation: DiceNotation): number[] {
  return Array.from({ length: notation.count }, () => Random.int(1, notation.sides + 1))
}

export function getDiceCost(notation: DiceNotation): number {
  return 3 * notation.count + notation.sides
}

function combination(total: number, selected: number): bigint {
  if (selected < 0 || selected > total) return 0n
  selected = Math.min(selected, total - selected)
  let result = 1n
  for (let index = 1; index <= selected; index++) {
    result = result * BigInt(total - selected + index) / BigInt(index)
  }
  return result
}

// n 颗 m 面骰的点数和不超过 sum 的组合数量。
function countDiceAtMost(count: number, sides: number, sum: number): bigint {
  if (count === 0) return sum >= 0 ? 1n : 0n
  if (sum < count) return 0n
  if (sum >= count * sides) return BigInt(sides) ** BigInt(count)

  const shiftedSum = sum - count
  let result = 0n
  for (let excluded = 0; excluded <= Math.floor(shiftedSum / sides) && excluded <= count; excluded++) {
    const ways = combination(count, excluded)
      * combination(shiftedSum - excluded * sides + count, count)
    result += excluded % 2 ? -ways : ways
  }
  return result
}

function countDiceExact(count: number, sides: number, sum: number): bigint {
  return countDiceAtMost(count, sides, sum) - countDiceAtMost(count, sides, sum - 1)
}

// 先按总点数、再按每轮点数进行排名，确保点数越高权重越高，同时每种组合排名唯一。
function getDiceRank(notation: DiceNotation, dice: number[]): { rank: bigint, total: bigint } {
  const total = BigInt(notation.sides) ** BigInt(notation.count)
  const diceSum = dice.reduce((sum, value) => sum + value, 0)
  let rank = countDiceAtMost(notation.count, notation.sides, diceSum - 1)
  let remainingSum = diceSum

  for (let index = 0; index < dice.length; index++) {
    const remainingCount = dice.length - index - 1
    for (let value = 1; value < dice[index]; value++) {
      rank += countDiceExact(remainingCount, notation.sides, remainingSum - value)
    }
    remainingSum -= dice[index]
  }
  return { rank, total }
}

function bigintRatio(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n) return 1
  const precision = 1_000_000n
  return Number(numerator * precision / denominator) / Number(precision)
}

export function evaluateDice(notation: DiceNotation, dice: number[]): DiceEvaluation | undefined {
  const { rank, total } = getDiceRank(notation, dice)
  // 无法被 3 整除时，仅剔除末尾 1～2 个组合并重投，使三个结果区间严格等大。
  const usableTotal = total - total % 3n
  if (rank >= usableTotal) return

  const bucket = Number(rank * 3n / usableTotal)
  const outcome: DiceOutcome = bucket === 0 ? 'lose' : bucket === 1 ? 'draw' : 'win'
  const percentile = bigintRatio(rank, usableTotal - 1n)
  const cost = getDiceCost(notation)

  if (outcome === 'lose') return { outcome, percentile, profit: 0, reward: 0 }
  if (outcome === 'draw') return { outcome, percentile, profit: 0, reward: cost }

  const winStart = usableTotal * 2n / 3n
  const winCount = usableTotal - winStart
  const position = rank - winStart + 1n
  const sumOfCubes = (winCount * (winCount + 1n) / 2n) ** 2n
  // 对胜区使用离散三次权重，并归一化到平均倍率 1，避免小面数骰子额外放大收益。
  const profitRate = bigintRatio(winCount * position ** 3n, sumOfCubes)
  const profit = Math.min(MAX_DICE_PROFIT, Math.max(1, Math.floor(cost * profitRate)))
  return { outcome, percentile, profit, reward: cost + profit }
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
