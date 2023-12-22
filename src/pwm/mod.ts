//https://www.kernel.org/doc/Documentation/pwm.txt

import { constructKey, GlobalPinLock, globalPinLock } from '../../utils.ts'
import { gpioPaths } from '../gpio/src/gpio_paths.ts'

/*
0: [18, 12]
1: [13, 19]
*/

const pwmId = Object.freeze({
	0: [
		12,
		18,
	] as const,
	1: [
		13,
		19,
	] as const,
})

type PwmId = (typeof pwmId['0'] | typeof pwmId['1'])[number]

function getPinPwmChip(id: PwmId): '0' | '1' {
	//@ts-ignore //TODO type hint to fix
	return Object.entries(pwmId).filter((chip) => chip[1].includes(id))[0][0]
}

function pinToChannel(id: PwmId): 0 | 1 {
	if (id === 12 || id === 18) return 0
	return 1
}

///sys/class/pwm/pwmchip0
const pwnPaths = {
	pwm(id: PwmId) {
		return {
			dutyCycle: `/sys/class/pwm/pwmchip${getPinPwmChip(id)}/pwm${
				pinToChannel(id)
			}/duty_clycle`,
			period: `/sys/class/pwm/pwmchip${getPinPwmChip(id)}/pwm${
				pinToChannel(id)
			}/period`,
			enable: `/sys/class/pwm/pwmchip${getPinPwmChip(id)}/pwm${
				pinToChannel(id)
			}/enable`,
			export: `/sys/class/pwm/pwmchip${getPinPwmChip(id)}/export`,
			unexport: `/sys/class/pwm/pwmchip${getPinPwmChip(id)}/unexport`,
		}
	},
}

type ns = number

export class PWM {
	#period: ns = 0
	#dutyCycle: ns = 0
	#enabled = false
	#id: PwmId
	#lock: GlobalPinLock

	static async connect({ id }: { id: PwmId }) {
		const lock = globalPinLock(id)
		await Deno.writeTextFile(
			pwnPaths.pwm(id).export,
			pinToChannel(id).toString(),
		)
		return new PWM({ id }, constructKey, lock)
	}

	constructor(
		{ id }: { id: PwmId },
		_constructKey: symbol,
		lock: GlobalPinLock,
	) {
		if (_constructKey !== constructKey) {
			throw new Error(
				'pwm cannot be instancied manually, use PWM.connect instead',
			)
		}
		this.#lock = lock
		this.#id = id
	}

	setDutyCycle(duration: ns) {
		this.#dutyCycle = duration
		return Deno.writeTextFile(
			pwnPaths.pwm(this.#id).dutyCycle,
			duration.toString(),
		)
	}

	setPeriod(duration: ns) {
		this.#period = duration
		return Deno.writeTextFile(
			pwnPaths.pwm(this.#id).period,
			duration.toString(),
		)
	}

	get infos() {
		return Object.freeze({
			dutyCycle: this.#dutyCycle,
			period: this.#period,
			enabled: this.#enabled,
			id: this.#id,
			channel: pinToChannel(this.#id),
			chip: getPinPwmChip(this.#id),
		})
	}

	enable() {
		this.#enabled = true
		Deno.writeTextFile(pwnPaths.pwm(this.#id).enable, '1')
	}

	disable() {
		this.#enabled = false
		Deno.writeTextFile(pwnPaths.pwm(this.#id).enable, '0')
	}

	get enabled() {
		return this.#enabled
	}

	[Symbol.asyncDispose]() {
		this.#lock.release()
		return Deno.writeTextFile(gpioPaths.unexport, this.#id.toString())
	}
}
