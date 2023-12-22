import { constructKey, GlobalPinLock, globalPinLock } from '../../utils.ts'
import { gpioPaths } from '../gpio/src/gpio_paths.ts'

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

/**
 * See {@link https://www.kernel.org/doc/Documentation/pwm.txt} for details.
 */
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
type percentage = number

/**
 * Control PWM GPIOs of the rapsberry pi board.
 *
 * @example
 * ```ts
 * using pwm0 = PWM.connect({ id: 12 })
 *
 * await pwm0.setPeriod(15) //15ns period
 * await pwm0.setDutyCycle(0.5) //7ns HIGH - 7ns LOW
 * await pwm0.enable()
 *
 * //pwm0 is automatically released and clean outside of the scope
 * ```
 */
export class PWM {
	#period: ns = 0
	#dutyCycle: ns = 0
	#enabled = false
	#id: PwmId
	#lock: GlobalPinLock

	/**
	 * Connect to the PWM channel.
	 * @param {{id: PwmId}} config - Configuration of the PWM channel.
	 * @returns PWM
	 *
	 * @example
	 * ```ts
	 * using pwm0 = PWM.connect({ id: 12 })
	 *
	 * await pwm0.setPeriod(15) //15ns period
	 * await pwm0.setDutyCycle(0.5) //7ns HIGH - 7ns LOW
	 * await pwm0.enable()
	 *
	 * //pwm0 is automatically released and clean outside of the scope
	 * ```
	 */
	static async connect({ id }: { id: PwmId }) {
		const lock = globalPinLock(id)
		await Deno.writeTextFile(
			pwnPaths.pwm(id).export,
			pinToChannel(id).toString(),
		)
		return new PWM({ id }, constructKey, lock)
	}

	/**
	 * @throws pwm cannot be instancied manually, use PWM.connect instead.
	 */
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

	/**
	 * Set the dutycycle of the PWM channel
	 * @param {percentage} duration - Dutycycle percentage of the period. ⚠️ Must be between 0 and 1 includes.
	 *
	 * @example
	 * ```ts
	 * await pwm0.setDutyCycle(0.5) //50% of the period HIGH - 50% of the period LOW
	 * ```
	 */
	setDutyCycle(percentage: percentage) {
		if (percentage < 0 || percentage > 1) {
			throw new RangeError(
				`dutycyle must be between 0 and 1, not ${percentage}`,
			)
		}
		this.#dutyCycle = percentage
		return Deno.writeTextFile(
			pwnPaths.pwm(this.#id).dutyCycle,
			(percentage * this.#period).toString(),
		)
	}

	/**
	 * Set the period of the PWM channel
	 * @param {ns} duration - Period duration in nanoseconds.
	 *
	 * @example
	 * ```ts
	 * await pwm0.setPeriod(15) //15ns period
	 * ```
	 */
	async setPeriod(duration: ns) {
		// If period increase we can update dutycycle here
		if (duration > this.#period) this.setDutyCycle(this.#dutyCycle)
		this.#period = duration
		await Deno.writeTextFile(
			pwnPaths.pwm(this.#id).period,
			duration.toString(),
		)
		// If period decrease we update dutycycle here
		return this.setDutyCycle(this.#dutyCycle)
	}

	/**
	 * Get info of the PWM channel
	 */
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

	/**
	 * Enable current PWM channel.
	 *
	 * @example
	 * ```ts
	 * await pwm0.enable() //channel0 is enabled
	 * ```
	 */
	enable() {
		this.#enabled = true
		return Deno.writeTextFile(pwnPaths.pwm(this.#id).enable, '1')
	}

	/**
	 * Disbale current PWM channel.
	 *
	 * @example
	 * ```ts
	 * await pwm0.disable() //channel0 is disabled
	 * ```
	 */
	disable() {
		this.#enabled = false
		return Deno.writeTextFile(pwnPaths.pwm(this.#id).enable, '0')
	}

	[Symbol.asyncDispose]() {
		this.#lock.release()
		return Deno.writeTextFile(gpioPaths.unexport, this.#id.toString())
	}
}
