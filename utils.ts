import { PinId } from './types.ts'

export function globalPinLock(id: PinId) {
	const key = `${import.meta.url}/pin#${id}}`

	if (sessionStorage.getItem(key) !== null) {
		throw new ReferenceError(`pin #${id} is already used`)
	}

	sessionStorage.setItem(key, 'lock')

	return {
		release: () => sessionStorage.removeItem(key),
	}
}

export type GlobalPinLock = ReturnType<typeof globalPinLock>

export const constructKey = Symbol('_constructKey')
