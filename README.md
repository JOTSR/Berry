# 🫐 Berry

Modern and secure Rapberry PI GPIOs interface.

## Control Digital GPIOs of the rapsberry pi board.

```ts
using pin = Pin.connect({ id: 1, direction: Pin.Direction.INOUT })
await pin.read() //Pin.Value.(LOW | HIGH)
await pin.write(Pin.Value.LOW) //Set pin to LOW
//pin is automatically released and clean outside of the scope
```

## Control PWM GPIOs of the rapsberry pi board.

```ts
using pwm0 = PWM.connect({ id: 12 })
await pwm0.setPeriod(15) //15ns period
await pwm0.setDutyCycle(0.5) //7ns HIGH - 7ns LOW
await pwm0.enable()
//pwm0 is automatically released and clean outside of the scope
```
