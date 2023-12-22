import { gpioPaths } from './src/gpio_paths.ts'
import { PinId } from '../../types.ts'
import { constructKey, GlobalPinLock, globalPinLock } from '../../utils.ts'

//https://www.kernel.org/doc/Documentation/gpio/sysfs.txt

type ValueInRecord<T extends Record<string, unknown>> = T[keyof T]

type PinDirection = ValueInRecord<typeof Pin.Direction>
type PinValue = ValueInRecord<typeof Pin.Value>
type PinEdge = ValueInRecord<typeof Pin.Edge>

export interface Pin<Id extends PinId, Direction extends PinDirection> {
	Id: PinId
	Direction: PinDirection
	Value: PinValue
	Edge: PinEdge
}

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
			direction === Pin.Direction.IN
				? 'in'
				: direction === Pin.Direction.OUT
				? 'out'
				: 'inout',
		)
	}

	#id: Id
	#direction: Direction
	#lock: GlobalPinLock

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

	get info() {
		return Object.freeze({
			id: this.#id,
			direction: this.#direction,
		})
	}

	write<
		Value extends Direction extends typeof Pin.Direction['OUT'] ? never
			: PinValue,
	>(value: Value) {
		return Deno.writeTextFile(
			gpioPaths.pin(this.#id).value,
			value === Pin.Value.HIGH ? '1' : '0',
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
		//@ts-ignore generic is only used as type guard for user
		return value === '1' ? Pin.Value.HIGH : Pin.Value.LOW
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

// function edgeSymbolToSys(edge: PinEdge) {
//     switch (edge) {
//         case Pin.Edge.BOTH:
//             return 'both'
//         case Pin.Edge.FALLING:
//             return 'falling'
//         case Pin.Edge.RISING:
//             return 'rising'
//         default:
//             return 'none'
//     }
// }
