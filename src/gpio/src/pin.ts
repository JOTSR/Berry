import { PinId, ValueInRecord } from '../../../types.ts'
import { constructKey, GlobalPinLock, globalPinLock } from '../../../utils.ts'
import { gpioPaths } from '../src/gpio_paths.ts'

type PinDirection = ValueInRecord<typeof Pin.Direction>
type PinValue = ValueInRecord<typeof Pin.Value>
type PinEdge = ValueInRecord<typeof Pin.Edge>

export interface Pin<Id extends PinId, Direction extends PinDirection> {
	Id: PinId
	Direction: PinDirection
	Value: PinValue
	Edge: PinEdge
}

/**
 * Control Digital GPIOs of the rapsberry pi board.
 *
 * @example
 * ```ts
 * using pin = Pin.connect({ id: 1, direction: Pin.Direction.INOUT })
 *
 * await pin.read() //Pin.Value.(LOW | HIGH)
 * await pin.write(Pin.Value.LOW) //Set pin to LOW
 *
 * //pin is automatically released and clean outside of the scope
 * ```
 */
export class Pin<Id extends PinId, Direction extends PinDirection> {
	static Direction = {
		IN: Symbol('pin_direction_in'),
		OUT: Symbol('pin_direction_out'),
		INOUT: Symbol('pin_direction_inout'),
	} as const

	static Value = {
		HIGH: Symbol('pin_value_high'),
		LOW: Symbol('pin_value_low'),
	}

	static Edge = {
		NONE: Symbol('pin_edge_none'),
		RISING: Symbol('pin_edge_rising'),
		FALLING: Symbol('pin_edge_falling'),
		BOTH: Symbol('pin_edge_both'),
	}

	/**
	 * Connect to the GPIO pin.
	 * @param {{id: PinId, direction: PinDirection}} config - Configuration of the GPIO pin.
	 * @returns Pin
	 *
	 * @example
	 * ```ts
	 * using pin = Pin.connect({ id: 1, direction: Pin.Direction.INOUT })
	 *
	 * await pin.read() //Pin.Value.(LOW | HIGH)
	 * await pin.write(Pin.Value.LOW) //Set pin to LOW
	 *
	 * //pin is automatically released and clean outside of the scope
	 * ```
	 */
	static async connect<Id extends PinId, Direction extends PinDirection>(
		{ id, direction, _activeLow }: {
			id: Pin<Id, Direction>['Id']
			direction: Pin<Id, Direction>['Direction']
			_activeLow?: unknown
		},
	) {
		const lock = globalPinLock(id)
		await this.#openPin({ id })
		await this.#setDirection({ id, direction })
		return new Pin({ id, direction }, constructKey, lock)
	}

	static #openPin({ id }: { id: PinId }) {
		return Deno.writeTextFile(gpioPaths.export, id.toString())
	}

	static #setDirection(
		{ id, direction }: { id: PinId; direction: PinDirection },
	) {
		return Deno.writeTextFile(
			gpioPaths.pin(id).direction,
			paramaterToSys(direction),
		)
	}

	#id: Id
	#direction: Direction
	#lock: GlobalPinLock

	/**
	 * @throws pwm cannot be instancied manually, use PIN.connect instead.
	 */
	constructor(
		{ id, direction }: { id: Id; direction: Direction },
		_constructKey: symbol,
		lock: GlobalPinLock,
	) {
		if (_constructKey !== constructKey) {
			throw new Error(
				'pin cannot be instancied manually, use Pin.connect instead',
			)
		}
		this.#id = id
		this.#direction = direction
		this.#lock = lock
	}

	/**
	 * Get info of the GPIO pin
	 */
	get info() {
		return Object.freeze({
			id: this.#id,
			direction: this.#direction,
		})
	}

	/**
	 * Write value to the pin if configured as output or inout.
	 * @param value PIN.Value.(HIGH | LOW)
	 *
	 * @example
	 * ```ts
	 *
	 * ```
	 */
	write<
		Value extends Direction extends typeof Pin.Direction['OUT'] ? never
			: PinValue,
	>(value: Value) {
		return Deno.writeTextFile(
			gpioPaths.pin(this.#id).value,
			paramaterToSys(value),
		)
	}

	async read<
		Value = Direction extends typeof Pin.Direction['OUT'] ? never
			: PinValue,
	>(): Promise<Value> {
		if (this.#direction === Pin.Direction.OUT) {
			throw new Error(
				'Pin.read() not allowed when pin is configured as "out" mode',
			)
		}
		const value = await Deno.readTextFile(gpioPaths.pin(this.#id).value)
		return sysToParameter(value) as Value
	}

	// async watch({ edge, signal }: { edge: PinEdge, signal?: AbortSignal }) {
	//     await Deno.writeTextFile(gpioPaths.pin(this.#id).edge, edgeSymbolToSys(edge))
	//     // const listener = Deno.listen({ path: gpioPaths.pin(this.#id).value, transport: 'unix' })
	//     // for await (const connection of listener) {
	//         // const value = await connection.read()
	//     // }
	//     // const connection = await Deno.connect({ path: gpioPaths.pin(this.#id).value, transport: 'unix' })
	//     // const reader = connection.readable.getReader()
	//     // reader.read()
	//     // listener.
	// 	throw new Error('not implemented')
	// }

	[Symbol.asyncDispose]() {
		this.#lock.release()
		return Deno.writeTextFile(gpioPaths.unexport, this.#id.toString())
	}
}

function paramaterToSys<T extends PinDirection | PinValue | PinEdge>(
	parameter: T,
): string {
	//Direction
	if (parameter in Pin.Direction) {
		switch (parameter) {
			case Pin.Direction.IN:
				return 'in'
			case Pin.Direction.OUT:
				return 'out'
			case Pin.Direction.INOUT:
				return 'inout'
		}
	}

	//Value
	if (parameter in Pin.Value) {
		switch (parameter) {
			case Pin.Value.HIGH:
				return '1'
			case Pin.Value.LOW:
				return '0'
		}
	}

	//Edge
	if (parameter in Pin.Edge) {
		switch (parameter) {
			case Pin.Edge.BOTH:
				return 'both'
			case Pin.Edge.FALLING:
				return 'falling'
			case Pin.Edge.NONE:
				return 'none'
			case Pin.Edge.RISING:
				return 'rising'
		}
	}
	throw new TypeError(`unknown parameter ${String(parameter)}`)
}

function sysToParameter(parameter: string) {
	//Direction
	if (parameter === 'in') return Pin.Direction.IN
	if (parameter === 'out') return Pin.Direction.OUT
	if (parameter === 'inout') return Pin.Direction.INOUT

	//Value
	if (parameter === '1') return Pin.Value.HIGH
	if (parameter === '0') return Pin.Value.LOW

	//Edge
	if (['both', 'falling', 'none', 'rising'].includes(parameter)) {
		switch (parameter) {
			case 'both':
				return Pin.Edge.BOTH
			case 'falling':
				return Pin.Edge.FALLING
			case 'none':
				return Pin.Edge.NONE
			case 'rising':
				return Pin.Edge.RISING
		}
	}
	throw new TypeError(`unknown parameter ${String(parameter)}`)
}
