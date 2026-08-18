class MonteCarloEngine {
    constructor() {

        this.ranges = {

            ambientTemperature: {
                min: 28,
                max: 45
            },

            humidity: { 
                min: 50,
                max: 90
            },

            passengerCount: {
                min: 40,
                max: 320
            },

            trainSpeed: {
                min: 0,
                max: 110
            },

            supplyVoltage: {
                min: 390,
                max: 420
            }

        };
    }

    randomBetween(min, max) {

        return min + Math.random() * (max - min);

    }

    randomInteger(min, max) {

        return Math.floor(
            this.randomBetween(min, max + 1)
        );

    }

    generateEnvironment() {

        return {

            simulationStartTime: new Date().toISOString(),

            ambientTemperature:
                this.randomBetween(
                    this.ranges.ambientTemperature.min,
                    this.ranges.ambientTemperature.max
                ),

            humidity:
                this.randomBetween(
                    this.ranges.humidity.min,
                    this.ranges.humidity.max
                ),

            passengerCount:
                this.randomInteger(
                    this.ranges.passengerCount.min,
                    this.ranges.passengerCount.max
                ),

            trainSpeed:
                this.randomInteger(
                    this.ranges.trainSpeed.min,
                    this.ranges.trainSpeed.max
                ),

            supplyVoltage:
                this.randomBetween(
                    this.ranges.supplyVoltage.min,
                    this.ranges.supplyVoltage.max
                )

        };
    }
}
module.exports = MonteCarloEngine;