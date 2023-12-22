import { PinId } from '../../../types.ts'

/**
 * See {@link //https://www.kernel.org/doc/Documentation/gpio/sysfs.txt} for more details.
 */
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
