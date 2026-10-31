/**
 * EMBEDX Examination Question Bank
 * SRM TRP Engineering College (Autonomous)
 * Technical Workshop: Basics of Embedded Systems & Embedded Programming Language
 */

const DEFAULT_QUIZZES = [
        {
          id: 'QUIZ-01',
          sessionOrder: 1,
          phase: 'phase-1',
          title: 'Quiz 1: Fundamentals of Embedded Systems',
          desc: 'Microprocessor vs Microcontroller architectures, Harvard vs Von Neumann, and real-time constraints.',
          totalMarks: 10,
          passMarks: 50,
          questions: [
            {
              id: 'Q1-1',
              text: 'What is the primary difference between a microprocessor and a microcontroller?',
              options: [
                { key: 'A', text: 'Microprocessors have built-in RAM and Flash ROM on-chip.' },
                { key: 'B', text: 'Microcontrollers integrate CPU, RAM, ROM, and I/O timers on a single silicon die.' },
                { key: 'C', text: 'Microprocessors consume less electrical power than microcontrollers.' },
                { key: 'D', text: 'Microcontrollers cannot run deterministic real-time control loops.' }
              ],
              correct: 'B',
              exp: 'Microcontrollers integrate the core CPU, RAM, Flash memory, timers, and I/O peripherals onto a single integrated circuit.'
            },
            {
              id: 'Q1-2',
              text: 'Which of the following represents a hard real-time embedded system constraint?',
              options: [
                { key: 'A', text: 'Video buffer streaming frame rate reduction.' },
                { key: 'B', text: 'Automotive airbag deployment mechanism during a collision event.' },
                { key: 'C', text: 'Periodic weather widget sync on a smartphone.' },
                { key: 'D', text: 'Smart home cloud logging of room temperature.' }
              ],
              correct: 'B',
              exp: 'Hard real-time systems have strict deadline bounds where missing a deadline causes total, catastrophic system failure.'
            },
            {
              id: 'Q1-3',
              text: 'What is the defining architectural feature of Harvard Architecture?',
              options: [
                { key: 'A', text: 'Shared single bus for both instruction and data memory.' },
                { key: 'B', text: 'Physically separate memories and buses for program instructions and data.' },
                { key: 'C', text: 'Elimination of all cache memories to reduce instruction latency.' },
                { key: 'D', text: 'Execution of multiple threads without hardware interrupts.' }
              ],
              correct: 'B',
              exp: 'Harvard architecture features separate buses and memory spaces for instructions and data, allowing simultaneous fetch and data read/write.'
            },
            {
              id: 'Q1-4',
              text: 'A Watchdog Timer (WDT) in microcontrollers is primarily used to:',
              options: [
                { key: 'A', text: 'Generate high-frequency PWM audio frequencies.' },
                { key: 'B', text: 'Recover the microcontroller in case of software deadlock or firmware hang.' },
                { key: 'C', text: 'Measure the ambient temperature inside the silicon package.' },
                { key: 'D', text: 'Act as an external clock crystal oscillator.' }
              ],
              correct: 'B',
              exp: 'The watchdog timer resets the processor if the firmware loop freezes or fails to reset the counter before overflow.'
            },
            {
              id: 'Q1-5',
              text: 'In Embedded C, declaring a variable as "volatile" ensures that:',
              options: [
                { key: 'A', text: 'The compiler optimizes away redundant reads of the memory address.' },
                { key: 'B', text: 'The variable is read directly from memory every time because hardware or an ISR may alter it.' },
                { key: 'C', text: 'The variable is strictly read-only and immutable.' },
                { key: 'D', text: 'The variable is saved in non-volatile Flash ROM permanently.' }
              ],
              correct: 'B',
              exp: 'Volatile informs the compiler that the value can change unexpectedly outside the current thread, preventing register caching optimizations.'
            }
          ]
        },
        {
          id: 'QUIZ-02',
          sessionOrder: 2,
          phase: 'phase-1',
          title: 'Quiz 2: Microcontrollers, Sensors & Actuators',
          desc: 'ADC resolution, pull-up resistors, sensor transducers, and H-Bridge actuation circuits.',
          totalMarks: 10,
          passMarks: 50,
          questions: [
            {
              id: 'Q2-1',
              text: 'A 10-bit Analog-to-Digital Converter (ADC) with a 5.0V reference has a resolution of approximately:',
              options: [
                { key: 'A', text: '4.88 mV per count' },
                { key: 'B', text: '9.76 mV per count' },
                { key: 'C', text: '1.22 mV per count' },
                { key: 'D', text: '19.53 mV per count' }
              ],
              correct: 'A',
              exp: 'Resolution = Vref / (2^10 - 1) = 5.0V / 1023 ≈ 4.887 mV per digital count.'
            },
            {
              id: 'Q2-2',
              text: 'Why are pull-up or pull-down resistors necessary on microcontroller input pins?',
              options: [
                { key: 'A', text: 'To increase the operating clock frequency of the I/O bus.' },
                { key: 'B', text: 'To prevent floating inputs and undefined logic states caused by electromagnetic noise.' },
                { key: 'C', text: 'To protect the internal ADC from negative voltages.' },
                { key: 'D', text: 'To store digital values when the system enters sleep mode.' }
              ],
              correct: 'B',
              exp: 'Without pull resistors, high-impedance input pins float unpredictably between HIGH and LOW due to stray static and electrical noise.'
            },
            {
              id: 'Q2-3',
              text: 'Which circuit configuration is used to drive a DC motor in both forward and reverse directions?',
              options: [
                { key: 'A', text: 'Voltage Divider' },
                { key: 'B', text: 'H-Bridge Configuration' },
                { key: 'C', text: 'Schmitt Trigger' },
                { key: 'D', text: 'RC Low-Pass Filter' }
              ],
              correct: 'B',
              exp: 'An H-Bridge allows voltage to be applied across a motor in either polarity, reversing rotational direction.'
            },
            {
              id: 'Q2-4',
              text: 'Which type of sensor produces an electrical output signal without requiring an external excitation power source?',
              options: [
                { key: 'A', text: 'Passive sensor (e.g., LDR or Thermistor)' },
                { key: 'B', text: 'Active / Self-generating sensor (e.g., Thermocouple or Piezoelectric)' },
                { key: 'C', text: 'Capacitive touch pad' },
                { key: 'D', text: 'Strain gauge bridge' }
              ],
              correct: 'B',
              exp: 'Active sensors convert physical energy directly into electricity (like the Seebeck effect in thermocouples).'
            },
            {
              id: 'Q2-5',
              text: 'In AVR and ARM microcontrollers, which register sets whether an I/O pin acts as an INPUT or an OUTPUT?',
              options: [
                { key: 'A', text: 'PIN / IDR Register' },
                { key: 'B', text: 'DDR (Data Direction Register) / MODER' },
                { key: 'C', text: 'PORT / ODR Register' },
                { key: 'D', text: 'SREG (Status Register)' }
              ],
              correct: 'B',
              exp: 'The Data Direction Register (DDR) configures pin electrical direction: 0 for input, 1 for output.'
            }
          ]
        },
        {
          id: 'QUIZ-03',
          sessionOrder: 3,
          phase: 'phase-2',
          title: 'Quiz 3: Embedded C & Firmware Programming',
          desc: 'Bitwise bit-masking, Interrupt Service Routines (ISRs), and memory-mapped pointers.',
          totalMarks: 10,
          passMarks: 50,
          questions: [
            {
              id: 'Q3-1',
              text: 'Which C bitwise expression correctly SETS bit 4 of register PORTB to 1 without altering any other bits?',
              options: [
                { key: 'A', text: 'PORTB &= ~(1 << 4);' },
                { key: 'B', text: 'PORTB |= (1 << 4);' },
                { key: 'C', text: 'PORTB ^= (1 << 4);' },
                { key: 'D', text: 'PORTB = (1 << 4);' }
              ],
              correct: 'B',
              exp: 'Bitwise OR with a shifted bit mask sets the target bit to 1 while leaving all other bits unaffected.'
            },
            {
              id: 'Q3-2',
              text: 'What is a critical rule when designing an Interrupt Service Routine (ISR)?',
              options: [
                { key: 'A', text: 'Always include delay loops like delay_ms(100) inside the ISR.' },
                { key: 'B', text: 'Keep the ISR as brief and fast as possible; never perform blocking I/O.' },
                { key: 'C', text: 'ISRs must always return a float value to main().' },
                { key: 'D', text: 'Always call malloc() inside the ISR.' }
              ],
              correct: 'B',
              exp: 'ISRs interrupt regular execution and must complete quickly without blocking delays to avoid starvation of other tasks.'
            },
            {
              id: 'Q3-3',
              text: 'How is a memory-mapped peripheral register accessed directly in Embedded C?',
              options: [
                { key: 'A', text: 'Through SQL query statements.' },
                { key: 'B', text: 'Using a typecasted pointer: *(volatile uint32_t *)(0x40021000)' },
                { key: 'C', text: 'Using system() shell commands.' },
                { key: 'D', text: 'Through HTML form submissions.' }
              ],
              correct: 'B',
              exp: 'Memory-mapped registers reside at specific physical memory addresses and are accessed by dereferencing volatile pointers.'
            },
            {
              id: 'Q3-4',
              text: 'Which bitwise operator is used to CLEAR bit 3 of a register to 0?',
              options: [
                { key: 'A', text: 'REG |= (1 << 3);' },
                { key: 'B', text: 'REG &= ~(1 << 3);' },
                { key: 'C', text: 'REG = ~(1 << 3);' },
                { key: 'D', text: 'REG += (1 << 3);' }
              ],
              correct: 'B',
              exp: 'Bitwise AND with the bitwise NOT of the mask clears the specific bit to 0 while keeping others unchanged.'
            },
            {
              id: 'Q3-5',
              text: 'In an embedded bare-metal control system, why does main() contain an infinite while(1) loop?',
              options: [
                { key: 'A', text: 'Because returning from main() causes undefined microcontroller behavior or continuous reboots.' },
                { key: 'B', text: 'To consume battery power as fast as possible.' },
                { key: 'C', text: 'To wait for the operating system desktop manager to boot.' },
                { key: 'D', text: 'It is optional; microcontrollers naturally stop running code when main ends.' }
              ],
              correct: 'A',
              exp: 'There is no operating system to return to. When main returns, the CPU executes arbitrary flash memory, crashing or rebooting.'
            }
          ]
        },
        {
          id: 'QUIZ-04',
          sessionOrder: 4,
          phase: 'phase-2',
          title: 'Quiz 4: Programming & Interfacing I/O Devices',
          desc: 'Switch debouncing, 7-Segment multiplexing, LCD display drivers, and matrix keypads.',
          totalMarks: 10,
          passMarks: 50,
          questions: [
            {
              id: 'Q4-1',
              text: 'What causes mechanical switch contact bounce in embedded inputs?',
              options: [
                { key: 'A', text: 'Rapid mechanical oscillations of metal switch contacts making and breaking connection for several milliseconds.' },
                { key: 'B', text: 'High voltage surges from the AC power mains.' },
                { key: 'C', text: 'Software stack overflows in the interrupt table.' },
                { key: 'D', text: 'Thermal expansion of the silicon substrate.' }
              ],
              correct: 'A',
              exp: 'Switch contacts vibrate physically for 5-20 ms when pressed, generating dozens of false digital transitions unless debounced in hardware or software.'
            },
            {
              id: 'Q4-2',
              text: 'In a 4x4 matrix keypad, how are 16 keys read using only 8 microcontroller pins?',
              options: [
                { key: 'A', text: 'Using 16 separate ADC channels.' },
                { key: 'B', text: 'Row-column scanning: sequentially driving rows LOW and reading column states.' },
                { key: 'C', text: 'High-frequency capacitive audio modulation.' },
                { key: 'D', text: 'Through USB enumeration.' }
              ],
              correct: 'B',
              exp: 'Matrix scanning connects keys at intersections of 4 output row pins and 4 input column pins, reading 16 switches with just 8 pins.'
            },
            {
              id: 'Q4-3',
              text: 'On an HD44780 standard character LCD, what is the role of the RS (Register Select) pin?',
              options: [
                { key: 'A', text: 'Selects between Command register (RS=0) and Display Data register (RS=1).' },
                { key: 'B', text: 'Controls the display contrast voltage.' },
                { key: 'C', text: 'Toggles between 5V and 3.3V operating modes.' },
                { key: 'D', text: 'Turns the LED backlight on and off.' }
              ],
              correct: 'A',
              exp: 'RS=0 sends commands (like clear screen or set cursor position); RS=1 writes ASCII characters to the display RAM.'
            },
            {
              id: 'Q4-4',
              text: 'What principle allows a multi-digit 7-segment display to appear continuously lit while driving only one digit at a time?',
              options: [
                { key: 'A', text: 'Persistence of Vision (POV) multiplexing at a refresh rate greater than 50 Hz.' },
                { key: 'B', text: 'High-current supercapacitor storage inside each segment.' },
                { key: 'C', text: 'Superconducting LED phosphor decay.' },
                { key: 'D', text: 'Electromagnetic induction from adjacent digits.' }
              ],
              correct: 'A',
              exp: 'By rapidly cycling through each digit faster than the human eye can resolve, the display appears fully and steadily illuminated.'
            },
            {
              id: 'Q4-5',
              text: 'Which display technology emits its own light per pixel and does not require a separate backlight panel?',
              options: [
                { key: 'A', text: 'TN Liquid Crystal Display (LCD)' },
                { key: 'B', text: 'Organic Light-Emitting Diode (OLED)' },
                { key: 'C', text: 'Electronic Paper Display' },
                { key: 'D', text: 'Color TFT LCD' }
              ],
              correct: 'B',
              exp: 'OLED pixels are self-emissive, providing superior contrast, thinner modules, and lower power consumption for dark screens.'
            }
          ]
        },
        {
          id: 'QUIZ-05',
          sessionOrder: 5,
          phase: 'phase-2',
          title: 'Quiz 5: Hardware Interfacing & Serial Protocols',
          desc: 'UART framing, I2C pull-up addressing, SPI Chip Select, PWM duty cycles, and optocouplers.',
          totalMarks: 10,
          passMarks: 50,
          questions: [
            {
              id: 'Q5-1',
              text: 'Which serial communication protocol uses two bidirectional open-drain lines (SDA and SCL) with pull-up resistors?',
              options: [
                { key: 'A', text: 'SPI (Serial Peripheral Interface)' },
                { key: 'B', text: 'I2C (Inter-Integrated Circuit)' },
                { key: 'C', text: 'UART (Universal Asynchronous Receiver-Transmitter)' },
                { key: 'D', text: 'CAN Bus' }
              ],
              correct: 'B',
              exp: 'I2C uses SDA (Serial Data) and SCL (Serial Clock) with open-drain outputs pulled HIGH by external resistors.'
            },
            {
              id: 'Q5-2',
              text: 'In SPI communication, which signal line is driven LOW by the master to select a specific slave device?',
              options: [
                { key: 'A', text: 'MOSI (Master Out Slave In)' },
                { key: 'B', text: 'MISO (Master In Slave Out)' },
                { key: 'C', text: 'SCK (Serial Clock)' },
                { key: 'D', text: 'SS / CS (Slave Select / Chip Select)' }
              ],
              correct: 'D',
              exp: 'The Chip Select (CS) line is active LOW: pulling it LOW wakes up the selected slave for data exchange.'
            },
            {
              id: 'Q5-3',
              text: 'In UART asynchronous transmission, how do sender and receiver agree on bit timing without a shared clock line?',
              options: [
                { key: 'A', text: 'Both devices are pre-configured with the same Baud Rate and synchronize on the Start Bit.' },
                { key: 'B', text: 'They use GPS atomic clock signals.' },
                { key: 'C', text: 'The receiver continuously transmits clock pulses on the ground line.' },
                { key: 'D', text: 'They only send one byte per minute.' }
              ],
              correct: 'A',
              exp: 'UART is asynchronous: both devices must share an agreed baud rate (e.g., 9600 or 115200) and synchronize phase on the falling edge of the Start bit.'
            },
            {
              id: 'Q5-4',
              text: 'If a PWM signal has a period of 20 ms and is HIGH for 2 ms, what is its duty cycle?',
              options: [
                { key: 'A', text: '50%' },
                { key: 'B', text: '25%' },
                { key: 'C', text: '10%' },
                { key: 'D', text: '5%' }
              ],
              correct: 'C',
              exp: 'Duty Cycle = (Time HIGH / Period) * 100 = (2 ms / 20 ms) * 100 = 10%.'
            },
            {
              id: 'Q5-5',
              text: 'An Optocoupler (Opto-isolator) provides galvanic isolation by transferring signals between circuits using:',
              options: [
                { key: 'A', text: 'Magnetic transformers' },
                { key: 'B', text: 'Light (LED emitting to a Phototransistor)' },
                { key: 'C', text: 'High-voltage copper traces' },
                { key: 'D', text: 'Conductive thermal paste' }
              ],
              correct: 'B',
              exp: 'An optocoupler uses an infrared LED and photodetector across a physical air gap to electrically isolate noisy high-voltage circuits from sensitive MCUs.'
            }
          ]
        }
      ];

// Enable both browser and node module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_QUIZZES };
}
