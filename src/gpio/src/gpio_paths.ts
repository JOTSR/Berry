import { PinId } from '../../../types.ts'

export const gpioPaths = {
	main: '/sys/class/gpio',
	export: '/sys/class/gpio/export',
	unexport: '/sys/class/gpio/unexport',
	pin(id: PinId) {
		const pin = `/sys/class/gpio/gpio${id}`
		return {
			active_low: `${pin}/active_low`,
			device: `${pin}/device`,
			direction: `${pin}/direction`,
			edge: `${pin}/edge`,
			subsystem: `${pin}/subsystem`,
			uevent: `${pin}/uevent`,
			value: `${pin}/value`,
		}
	},
}
