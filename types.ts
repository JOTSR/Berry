import { GPIOs } from './src/gpio/src/gpios.ts'

export type PinId = (typeof GPIOs)[number]

export type ValueInRecord<T extends Record<string, unknown>> = T[keyof T]
